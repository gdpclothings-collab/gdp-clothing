import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://gdp-clothing.pages.dev",
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
]);
const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    "Vary": "Origin",
  };
}

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function normalizePaymentMode(value: unknown): "live" | "test" {
  return value === "test" ? "test" : "live";
}

function stripeSecretMatchesMode(secret: string, paymentMode: "live" | "test") {
  if (!secret) return false;
  return paymentMode === "test"
    ? secret.startsWith("sk_test_") || secret.startsWith("rk_test_")
    : secret.startsWith("sk_live_") || secret.startsWith("rk_live_");
}

function stripePublishableKeyMatchesMode(key: string, paymentMode: "live" | "test") {
  if (!key) return false;
  return paymentMode === "test" ? key.startsWith("pk_test_") : key.startsWith("pk_live_");
}

function stripeEnvironment(paymentMode: "live" | "test") {
  const stripeSecret = Deno.env.get(paymentMode === "test" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY") || "";
  const stripePublishableKey = Deno.env.get(paymentMode === "test" ? "STRIPE_TEST_PUBLISHABLE_KEY" : "STRIPE_PUBLISHABLE_KEY") || "";
  return {
    stripeSecret,
    stripePublishableKey,
    valid:
      stripeSecretMatchesMode(stripeSecret, paymentMode) &&
      stripePublishableKeyMatchesMode(stripePublishableKey, paymentMode),
  };
}

async function currentPaymentMode(service: any) {
  const { data, error } = await service
    .from("store_settings")
    .select("payment_mode")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return normalizePaymentMode(data?.payment_mode);
}

async function stripeRequest(
  stripeSecret: string,
  path: string,
  init: RequestInit = {},
  idempotencyKey = "",
) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${stripeSecret}`);
  headers.set("Stripe-Version", "2026-08-26.dahlia");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  const response = await fetch(`https://api.stripe.com${path}`, { ...init, headers });
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { response, data };
}

async function bootstrap(req: Request, service: any) {
  const paymentMode = await currentPaymentMode(service);
  const { stripePublishableKey, valid } = stripeEnvironment(paymentMode);
  if (!valid) {
    return respond(req, {
      error: true,
      configured: false,
      message: "Secure payment is temporarily unavailable. No charge was attempted.",
    }, 503);
  }

  return respond(req, {
    configured: true,
    publishableKey: stripePublishableKey,
    paymentMode,
    paymentFlow: "deferred_payment_intent",
  });
}

async function createIntent(req: Request, service: any, body: any) {
  const orderNumber = String(body?.orderNumber || "").trim();
  const confirmationToken = String(body?.confirmationToken || "").trim();
  const checkoutSessionToken = String(body?.checkoutSessionToken || "").trim();

  if (!orderNumber || !uuidRe.test(confirmationToken) || !uuidRe.test(checkoutSessionToken)) {
    return respond(req, { error: true, message: "The payment session could not be verified." }, 400);
  }

  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id,order_number,confirmation_token,customer_email,payment_mode,payment_status,total,stripe_checkout_session_id,stripe_payment_intent_id")
    .eq("order_number", orderNumber)
    .eq("confirmation_token", confirmationToken)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return respond(req, { error: true, message: "The checkout order could not be found." }, 404);

  if (order.payment_status === "paid") {
    return respond(req, {
      paid: true,
      orderNumber: order.order_number,
      confirmationToken: order.confirmation_token,
    });
  }
  if (order.payment_status !== "pending") {
    return respond(req, { error: true, message: "This checkout is no longer awaiting payment." }, 409);
  }

  const { data: tracked, error: trackedError } = await service
    .from("checkout_sessions")
    .select("id,status,converted_order_id,stripe_checkout_session_id,stripe_client_secret")
    .eq("session_token", checkoutSessionToken)
    .eq("converted_order_id", order.id)
    .maybeSingle();
  if (trackedError) throw trackedError;
  if (!tracked) {
    return respond(req, { error: true, message: "The secure checkout session could not be verified." }, 403);
  }

  const paymentMode = normalizePaymentMode(order.payment_mode);
  const { stripeSecret, stripePublishableKey, valid } = stripeEnvironment(paymentMode);
  if (!valid) {
    return respond(req, {
      error: true,
      message: "The secure payment environment is misconfigured. No charge was attempted.",
    }, 503);
  }

  const expectedAmount = Math.round(Number(order.total || 0) * 100);
  if (!Number.isFinite(expectedAmount) || expectedAmount < 50) {
    return respond(req, { error: true, message: "The order total is not valid for card payment." }, 409);
  }

  let paymentIntent: any = null;
  if (order.stripe_payment_intent_id) {
    const existing = await stripeRequest(
      stripeSecret,
      `/v1/payment_intents/${encodeURIComponent(order.stripe_payment_intent_id)}`,
    );
    if (!existing.response.ok) {
      return respond(req, {
        error: true,
        message: existing.data?.error?.message || "The saved payment could not be resumed.",
      }, 502);
    }
    if (Boolean(existing.data?.livemode) !== (paymentMode === "live")) {
      return respond(req, { error: true, message: "The saved payment environment does not match checkout." }, 409);
    }
    if (existing.data?.status === "succeeded") {
      return respond(req, {
        paid: true,
        orderNumber: order.order_number,
        confirmationToken: order.confirmation_token,
      });
    }
    paymentIntent = existing.data;
  }

  if (!paymentIntent) {
    const legacySessionId = String(order.stripe_checkout_session_id || tracked.stripe_checkout_session_id || "");
    if (legacySessionId) {
      // The legacy Checkout Session was created by the existing authoritative
      // order pipeline. Remove its order metadata before expiring it so the
      // legacy checkout.session.expired webhook cannot release this order's
      // reservations after we switch the order to a PaymentIntent.
      const scrub = new URLSearchParams();
      scrub.set("metadata[order_id]", "");
      scrub.set("metadata[order_number]", "");
      scrub.set("metadata[payment_mode]", "");
      const updated = await stripeRequest(
        stripeSecret,
        `/v1/checkout/sessions/${encodeURIComponent(legacySessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: scrub,
        },
      );
      if (!updated.response.ok) {
        return respond(req, {
          error: true,
          message: updated.data?.error?.message || "The previous payment session could not be retired safely.",
        }, 502);
      }

      if (updated.data?.status === "open") {
        const expired = await stripeRequest(
          stripeSecret,
          `/v1/checkout/sessions/${encodeURIComponent(legacySessionId)}/expire`,
          { method: "POST" },
        );
        if (!expired.response.ok) {
          return respond(req, {
            error: true,
            message: expired.data?.error?.message || "The previous payment session could not be retired safely.",
          }, 502);
        }
      }
    }

    const form = new URLSearchParams();
    form.set("amount", String(expectedAmount));
    form.set("currency", "cad");
    form.set("automatic_payment_methods[enabled]", "true");
    form.set("description", `GDP Clothing Order ${order.order_number}`);
    if (order.customer_email) form.set("receipt_email", String(order.customer_email));
    form.set("metadata[order_id]", order.id);
    form.set("metadata[order_number]", order.order_number);
    form.set("metadata[payment_mode]", paymentMode);

    const created = await stripeRequest(
      stripeSecret,
      "/v1/payment_intents",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      },
      `gdp-order-${order.id}-payment-intent-v1`,
    );
    if (!created.response.ok || !created.data?.client_secret) {
      return respond(req, {
        error: true,
        message: created.data?.error?.message || "Stripe could not prepare the payment.",
      }, 502);
    }
    if (Boolean(created.data?.livemode) !== (paymentMode === "live")) {
      return respond(req, { error: true, message: "Stripe returned the wrong payment environment." }, 502);
    }
    paymentIntent = created.data;
  }

  if (Number(paymentIntent.amount || 0) !== expectedAmount) {
    const update = new URLSearchParams();
    update.set("amount", String(expectedAmount));
    const updated = await stripeRequest(
      stripeSecret,
      `/v1/payment_intents/${encodeURIComponent(paymentIntent.id)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: update,
      },
    );
    if (!updated.response.ok || !updated.data?.client_secret) {
      return respond(req, {
        error: true,
        message: updated.data?.error?.message || "The final payment amount could not be synchronized.",
      }, 502);
    }
    paymentIntent = updated.data;
  }

  const now = new Date().toISOString();
  const { error: orderUpdateError } = await service
    .from("orders")
    .update({
      stripe_payment_intent_id: paymentIntent.id,
      stripe_checkout_session_id: null,
    })
    .eq("id", order.id)
    .eq("payment_status", "pending");
  if (orderUpdateError) throw orderUpdateError;

  const { error: checkoutUpdateError } = await service
    .from("checkout_sessions")
    .update({
      status: "converted",
      stripe_checkout_session_id: null,
      stripe_client_secret: paymentIntent.client_secret,
      processing_started_at: null,
      last_activity_at: now,
    })
    .eq("id", tracked.id)
    .eq("converted_order_id", order.id);
  if (checkoutUpdateError) throw checkoutUpdateError;

  return respond(req, {
    configured: true,
    paymentFlow: "payment_intent",
    paymentMode,
    publishableKey: stripePublishableKey,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: expectedAmount,
    orderNumber: order.order_number,
    confirmationToken: order.confirmation_token,
  });
}

Deno.serve(async (req: Request) => {
  const origin = requestOrigin(req);
  if (!isAllowedOrigin(origin)) return respond(req, { error: true, message: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return respond(req, { error: true, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return respond(req, { error: true, message: "Server configuration is incomplete." }, 500);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const action = String(body?.action || "");
    if (action === "bootstrap") return await bootstrap(req, service);
    if (action === "createIntent") return await createIntent(req, service, body);
    return respond(req, { error: true, message: "Unsupported payment action." }, 400);
  } catch (error) {
    console.error("payment-session", error);
    return respond(req, {
      error: true,
      message: error instanceof Error ? error.message : "Payment session failed.",
    }, 500);
  }
});
