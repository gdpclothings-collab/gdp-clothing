import { createClient } from "npm:@supabase/supabase-js@2";
import { handleStripeDispute } from "./disputes.ts";

const jsonHeaders = { "Content-Type": "application/json" };
const allowedEvents = new Set([
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
]);

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const expected = hex(digest);
  return signatures.some((signature) => timingSafeEqual(expected, signature));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return respond({ error: "Invalid JSON" }, 400);
  }

  if (typeof event?.livemode !== "boolean") return respond({ error: "Stripe event mode is missing" }, 400);
  if (!allowedEvents.has(String(event?.type || ""))) return respond({ error: "Unsupported Stripe event" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return respond({ error: "Server configuration missing" }, 503);

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const matchedMode: "live" | "test" = event.livemode ? "live" : "test";
  const { data: signingConfig, error: signingError } = await service
    .from("stripe_webhook_signing_secrets")
    .select("signing_secret,endpoint_id")
    .eq("mode", matchedMode)
    .maybeSingle();

  if (signingError) {
    console.error("dispute webhook signing config lookup failed", signingError);
    return respond({ error: "Webhook signing configuration unavailable" }, 503);
  }
  if (!signingConfig?.signing_secret) return respond({ error: "Webhook signing secret is not configured" }, 503);

  const signature = req.headers.get("stripe-signature") || "";
  const signatureValid = await verifyStripeSignature(rawBody, signature, signingConfig.signing_secret);
  if (!signatureValid) return respond({ error: "Invalid Stripe signature" }, 400);

  try {
    const result = await handleStripeDispute(service, event, matchedMode);
    return respond({ received: true, ...result });
  } catch (error) {
    console.error("stripe dispute webhook processing error", error);
    return respond({ error: error?.message || "Webhook processing failed" }, 500);
  }
});
