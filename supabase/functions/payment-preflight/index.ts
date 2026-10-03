import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://gdp-clothing.pages.dev",
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
]);
const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function requestOrigin(req: Request) {
  return req.headers.get("origin") || "";
}

function isAllowedOrigin(origin: string) {
  return !origin || allowedOrigins.has(origin) || localOriginPattern.test(origin);
}

function corsHeaders(req: Request) {
  const origin = requestOrigin(req);
  return {
    ...(origin && isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function respond(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), ...extraHeaders },
  });
}

function clientIp(req: Request) {
  const direct = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
  if (direct) return direct.trim().slice(0, 128);
  const forwarded = req.headers.get("x-forwarded-for") || "";
  return (forwarded.split(",")[0] || "unknown").trim().slice(0, 128);
}

function bearer(req: Request) {
  return (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
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

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(service: any, req: Request) {
  const key = await sha256Hex(`payment-preflight:ip:${clientIp(req)}`);
  const { data, error } = await service.rpc("consume_checkout_rate_limit", {
    p_key: key,
    p_limit: 60,
    p_window_seconds: 600,
  });
  if (error) throw error;
  return data || { allowed: false, retry_after: 60 };
}

async function isAdminRequest(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
  service: any,
) {
  const token = bearer(req);
  if (!token) return false;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData?.user || null;
  if (userError || !user || user.is_anonymous === true) return false;

  // The JWT has been validated by auth.getUser above. Detailed payment
  // diagnostics are privileged data, so an admin role alone is not enough.
  const payload = readJwtPayload(token);
  if (payload.aal !== "aal2") return false;

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return false;
  return profile?.role === "admin";
}

function normalizePaymentMode(value: unknown): "test" | "live" {
  return value === "test" ? "test" : "live";
}

function stripeSecretMatchesMode(secret: string, paymentMode: "test" | "live") {
  if (!secret) return false;
  return paymentMode === "test"
    ? secret.startsWith("sk_test_") || secret.startsWith("rk_test_")
    : secret.startsWith("sk_live_") || secret.startsWith("rk_live_");
}

function stripePublishableKeyMatchesMode(key: string, paymentMode: "test" | "live") {
  if (!key) return false;
  return paymentMode === "test" ? key.startsWith("pk_test_") : key.startsWith("pk_live_");
}

async function safeFetch(url: string, init: RequestInit = {}) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const origin = requestOrigin(req);
  if (!isAllowedOrigin(origin)) return respond(req, { error: true, ready: false, message: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return respond(req, { error: true, ready: false, message: "Method not allowed." }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }
  if (body.action !== "preflight") {
    return respond(req, { error: true, ready: false, message: "Unsupported preflight action." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond(req, { ready: false, checkedAt: new Date().toISOString() }, 503);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let adminAccess = false;
  try {
    const rate = await consumeRateLimit(service, req);
    if (!rate.allowed) {
      const retryAfter = Math.max(1, Number(rate.retry_after || 60));
      return respond(
        req,
        { ready: false, checkedAt: new Date().toISOString(), rateLimited: true },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    adminAccess = await isAdminRequest(req, supabaseUrl, anonKey, service);

    const { data: storeSettings, error: settingsError } = await service
      .from("store_settings")
      .select("payment_mode")
      .eq("id", 1)
      .maybeSingle();
    if (settingsError) throw settingsError;

    const paymentMode = normalizePaymentMode(storeSettings?.payment_mode);
    const stripeSecret = Deno.env.get(paymentMode === "test" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY") || "";
    const stripePublishable = Deno.env.get(paymentMode === "test" ? "STRIPE_TEST_PUBLISHABLE_KEY" : "STRIPE_PUBLISHABLE_KEY") || "";
    const webhookSecret = Deno.env.get(paymentMode === "test" ? "STRIPE_TEST_WEBHOOK_SECRET" : "STRIPE_WEBHOOK_SECRET") || "";

    const secretModeAligned = stripeSecretMatchesMode(stripeSecret, paymentMode);
    const publishableModeAligned = stripePublishableKeyMatchesMode(stripePublishable, paymentMode);
    const webhookConfigured = webhookSecret.startsWith("whsec_");

    let stripeConnected = false;
    let chargesEnabled = false;
    if (secretModeAligned) {
      const stripeResponse = await safeFetch("https://api.stripe.com/v1/account", {
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          "Stripe-Version": "2026-08-26.dahlia",
        },
      });
      if (stripeResponse?.ok) {
        const stripeAccount = await stripeResponse.json().catch(() => null);
        stripeConnected = Boolean(stripeAccount && !stripeAccount.error);
        chargesEnabled = paymentMode === "test" ? stripeConnected : stripeAccount?.charges_enabled === true;
      }
    }

    const functionHeaders = {
      apikey: anonKey,
      Origin: "https://gdpclothing.ca",
    };
    const [gatewayResponse, checkoutResponse, webhookResponse] = await Promise.all([
      safeFetch(`${supabaseUrl}/functions/v1/checkout-gateway`, {
        method: "OPTIONS",
        headers: functionHeaders,
      }),
      safeFetch(`${supabaseUrl}/functions/v1/checkout`, {
        method: "OPTIONS",
        headers: functionHeaders,
      }),
      safeFetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
        method: "GET",
        headers: { apikey: anonKey },
      }),
    ]);

    const checkoutGatewayReachable = gatewayResponse?.ok === true;
    const checkoutCoreReachable = checkoutResponse?.ok === true;
    const webhookEndpointReachable = webhookResponse?.status === 405;

    const ready = secretModeAligned
      && publishableModeAligned
      && webhookConfigured
      && stripeConnected
      && chargesEnabled
      && checkoutGatewayReachable
      && checkoutCoreReachable
      && webhookEndpointReachable;
    const checkedAt = new Date().toISOString();

    if (!adminAccess) {
      return respond(req, { ready, checkedAt }, ready ? 200 : 503);
    }

    const payload = {
      ready,
      checkedAt,
      paymentMode,
      stripe: {
        secretModeAligned,
        publishableModeAligned,
        connected: stripeConnected,
        chargesEnabled,
      },
      checkout: {
        gatewayReachable: checkoutGatewayReachable,
        coreReachable: checkoutCoreReachable,
      },
      webhook: {
        configured: webhookConfigured,
        endpointReachable: webhookEndpointReachable,
      },
      safety: {
        databaseWrites: false,
        orderCreated: false,
        stripeSessionCreated: false,
        paymentIntentCreated: false,
        chargeAttempted: false,
      },
    };

    return respond(req, payload, ready ? 200 : 503);
  } catch (error) {
    console.error("payment-preflight", error);
    const checkedAt = new Date().toISOString();
    if (!adminAccess) return respond(req, { ready: false, checkedAt }, 503);
    return respond(req, {
      error: true,
      ready: false,
      checkedAt,
      message: "Production payment preflight could not complete.",
      safety: {
        databaseWrites: false,
        orderCreated: false,
        stripeSessionCreated: false,
        paymentIntentCreated: false,
        chargeAttempted: false,
      },
    }, 503);
  }
});
