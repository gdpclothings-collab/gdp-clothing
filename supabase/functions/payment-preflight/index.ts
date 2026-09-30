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

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
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
    return respond(req, { error: true, ready: false, message: "Production payment preflight is not configured." }, 503);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
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

    const payload = {
      ready,
      checkedAt: new Date().toISOString(),
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
    return respond(req, {
      error: true,
      ready: false,
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
