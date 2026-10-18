import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

// Google OAuth callback runs BEFORE admin MFA. This endpoint only answers
// whether the currently authenticated user previously accepted this policy.
// It must never reveal someone else's receipts or privileged profile data.
const POLICY_VERSION = "2026-09-07";
const origins = new Set([
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
  "https://gdp-clothing.pages.dev",
]);
const localOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  const isAllowed = origins.has(origin) || localOrigin.test(origin);
  return {
    ...(isAllowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !origins.has(origin) && !localOrigin.test(origin)) {
    return respond(req, { error: "Origin not allowed" }, 403);
  }

  const token = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!token) return respond(req, { error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const publishable = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !publishable || !secret) {
    return respond(req, { error: "Service configuration incomplete" }, 503);
  }

  try {
    const auth = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: verified, error: userError } = await auth.auth.getUser(token);
    const userId = verified?.user?.id;
    if (userError || !userId) return respond(req, { error: "Authentication required" }, 401);

    // Only the server can bypass the table's restrictive admin-MFA RLS gate.
    // Scope the query to the JWT-verified caller; never accept a userId from input.
    const service = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: rows, error: receiptError } = await service
      .from("policy_acceptances")
      .select("policy_key")
      .eq("user_id", userId)
      .eq("policy_version", POLICY_VERSION)
      .in("policy_key", ["terms_conditions", "privacy_policy"])
      .limit(100);
    if (receiptError) throw receiptError;

    const accepted = new Set((rows || []).map((row) => row.policy_key));
    return respond(req, {
      data: {
        policyVersion: POLICY_VERSION,
        termsAccepted: accepted.has("terms_conditions"),
        privacyAccepted: accepted.has("privacy_policy"),
      },
    });
  } catch (error) {
    console.error("own-policy-acceptance-status failed", error instanceof Error ? error.message : "unknown");
    return respond(req, { error: "Could not verify existing policy acceptance" }, 500);
  }
});
