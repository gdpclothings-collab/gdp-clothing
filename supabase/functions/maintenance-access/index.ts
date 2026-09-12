import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import bcrypt from "npm:bcryptjs@2.4.3";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: true, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond({ error: true, message: "Server configuration is incomplete." }, 500);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return respond({ error: true, message: "Invalid request body." }, 400);
  }

  const action = String(body.action || "");
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  async function getPasswordRow() {
    const { data, error } = await service
      .from("maintenance_access_control")
      .select("password_hash,password_configured_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function requireAdmin() {
    const token = bearerToken(req);
    if (!token) {
      return {
        ok: false as const,
        response: respond({ error: true, message: "Authentication required." }, 401),
      };
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData?.user || null;
    if (userError || !user) {
      return {
        ok: false as const,
        response: respond({ error: true, message: "Authentication required." }, 401),
      };
    }

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "admin") {
      return {
        ok: false as const,
        response: respond({ error: true, message: "Admin access required." }, 403),
      };
    }

    return { ok: true as const, user };
  }

  try {
    if (action === "status") {
      const row = await getPasswordRow();
      return respond({
        data: {
          configured: Boolean(row?.password_hash),
          configuredAt: row?.password_configured_at || null,
        },
      });
    }

    if (action === "verify") {
      const password = typeof body.password === "string" ? body.password : "";
      if (!password || password.length > 128) {
        return respond({ error: true, message: "Enter the maintenance access password." }, 400);
      }

      const row = await getPasswordRow();
      if (!row?.password_hash) {
        return respond({ error: true, message: "Maintenance access is not configured." }, 409);
      }

      const valid = await bcrypt.compare(password, row.password_hash);
      if (!valid) {
        return respond({ error: true, message: "Incorrect maintenance password." }, 401);
      }

      return respond({ data: { verified: true } });
    }

    if (action === "set_password") {
      const admin = await requireAdmin();
      if (!admin.ok) return admin.response;

      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 10) {
        return respond({ error: true, message: "Use at least 10 characters for the maintenance password." }, 400);
      }
      if (password.length > 128) {
        return respond({ error: true, message: "Maintenance password must be 128 characters or fewer." }, 400);
      }

      const now = new Date().toISOString();
      const passwordHash = await bcrypt.hash(password, 12);
      const { error } = await service
        .from("maintenance_access_control")
        .upsert(
          {
            id: 1,
            password_hash: passwordHash,
            password_configured_at: now,
            updated_at: now,
          },
          { onConflict: "id" }
        );
      if (error) throw error;

      return respond({ data: { configured: true, configuredAt: now } });
    }

    if (action === "clear_password") {
      const admin = await requireAdmin();
      if (!admin.ok) return admin.response;

      const now = new Date().toISOString();
      const { error } = await service
        .from("maintenance_access_control")
        .update({
          password_hash: null,
          password_configured_at: null,
          updated_at: now,
        })
        .eq("id", 1);
      if (error) throw error;

      return respond({ data: { configured: false, configuredAt: null } });
    }

    return respond({ error: true, message: "Unsupported action." }, 400);
  } catch (error) {
    console.error("maintenance-access error", error);
    return respond(
      {
        error: true,
        message: error instanceof Error ? error.message : "Maintenance access operation failed.",
      },
      500
    );
  }
});
