import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function bearerToken(req: Request) {
  const value = req.headers.get("Authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function readJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1] || "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: true, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = bearerToken(req);

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond({ error: true, message: "Server configuration is incomplete." }, 500);
  }
  if (!token) return respond({ error: true, message: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData?.user || null;
  if (userError || !user) return respond({ error: true, message: "Authentication required." }, 401);

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return respond({ error: true, message: "Could not verify admin access." }, 500);
  if (profile?.role !== "admin") return respond({ error: true, message: "Admin access required." }, 403);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return respond({ error: true, message: "Invalid request body." }, 400);
  }

  const action = String(body.action || "");

  try {
    if (action === "get_state") {
      const { error: insertError } = await service
        .from("admin_mfa_enrollment_state")
        .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
      if (insertError) throw insertError;

      const { data: state, error: stateError } = await service
        .from("admin_mfa_enrollment_state")
        .select("user_id,grace_started_at,grace_expires_at,enrolled_at,last_verified_at")
        .eq("user_id", user.id)
        .single();
      if (stateError) throw stateError;

      const expiresAt = state?.grace_expires_at ? new Date(state.grace_expires_at).getTime() : 0;
      return respond({
        data: {
          ...state,
          grace_active: Number.isFinite(expiresAt) && expiresAt > Date.now(),
        },
      });
    }

    if (action === "clear_unverified_totp") {
      const { data: factorData, error: factorError } = await service.auth.admin.mfa.listFactors({
        userId: user.id,
      });
      if (factorError) throw factorError;

      const unverifiedTotp = (factorData?.factors || []).filter(
        (factor: any) => factor?.factor_type === "totp" && factor?.status === "unverified"
      );

      let deleted = 0;
      for (const factor of unverifiedTotp) {
        const { error } = await service.auth.admin.mfa.deleteFactor({
          userId: user.id,
          id: factor.id,
        });
        if (error) throw error;
        deleted += 1;
      }

      return respond({ data: { deleted } });
    }

    if (action === "record_verified") {
      const payload = readJwtPayload(token);
      if (payload.aal !== "aal2") {
        return respond({ error: true, message: "AAL2 verification is required." }, 403);
      }

      const { data: factorData, error: factorError } = await service.auth.admin.mfa.listFactors({
        userId: user.id,
      });
      if (factorError) throw factorError;

      const hasVerifiedFactor = (factorData?.factors || []).some(
        (factor: any) => factor?.status === "verified"
      );
      if (!hasVerifiedFactor) {
        return respond({ error: true, message: "No verified MFA factor was found." }, 409);
      }

      const now = new Date().toISOString();
      const { data: currentState, error: currentStateError } = await service
        .from("admin_mfa_enrollment_state")
        .select("user_id,enrolled_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (currentStateError) throw currentStateError;

      if (currentState) {
        const { error: updateError } = await service
          .from("admin_mfa_enrollment_state")
          .update({
            enrolled_at: currentState.enrolled_at || now,
            last_verified_at: now,
            updated_at: now,
          })
          .eq("user_id", user.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await service
          .from("admin_mfa_enrollment_state")
          .insert({
            user_id: user.id,
            grace_started_at: now,
            grace_expires_at: now,
            enrolled_at: now,
            last_verified_at: now,
            updated_at: now,
          });
        if (insertError) throw insertError;
      }

      return respond({ data: { verified: true, verified_at: now } });
    }

    return respond({ error: true, message: "Unsupported action." }, 400);
  } catch (error) {
    console.error("admin-mfa-security error", error);
    return respond(
      { error: true, message: error instanceof Error ? error.message : "MFA security operation failed." },
      500
    );
  }
});
