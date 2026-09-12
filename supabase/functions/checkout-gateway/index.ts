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

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeMoney(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(Math.min(number, 1_000_000) * 100) / 100;
}

async function consumeRateLimit(
  service: any,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await service.rpc("consume_checkout_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data || { allowed: false, retry_after: 60 };
}

async function optionalUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.auth.getUser();
  return data?.user?.is_anonymous === true ? null : data?.user || null;
}

async function releaseClaim(service: any, sessionToken: string) {
  const { error } = await service.rpc("release_checkout_session_claim", {
    p_session_token: sessionToken,
  });
  if (error) console.error("checkout gateway claim release failed", error);
}

async function trackCheckout(
  req: Request,
  service: any,
  supabaseUrl: string,
  anonKey: string,
  body: any,
) {
  const rateKey = await sha256Hex(`checkout:track:ip:${clientIp(req)}`);
  const rate = await consumeRateLimit(service, rateKey, 300, 3600);
  if (!rate.allowed) {
    const retryAfter = Math.max(1, Number(rate.retry_after || 60));
    return respond(
      req,
      {
        error: true,
        retryable: true,
        rateLimited: true,
        message: "Checkout tracking is temporarily rate limited. Please try again shortly.",
      },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  const user = await optionalUser(req, supabaseUrl, anonKey);
  const incomingToken = String(body?.sessionToken || "").trim();
  const sessionToken = uuidRe.test(incomingToken) ? incomingToken : crypto.randomUUID();
  const cart = Array.isArray(body?.cart) ? body.cart.slice(0, 100) : [];
  const customer = body?.customer || {};
  const totals = body?.totals || {};
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: existing, error: existingError } = await service
    .from("checkout_sessions")
    .select("id,status,converted_order_id")
    .eq("session_token", sessionToken)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.status === "converted") {
    return respond(req, {
      sessionToken,
      status: "converted",
      convertedOrderId: existing.converted_order_id,
    });
  }
  if (existing?.status === "processing") {
    return respond(req, {
      sessionToken,
      status: "processing",
      convertedOrderId: existing.converted_order_id,
    });
  }

  const customerName = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const shippingAddress = {
    address: customer.address || "",
    address2: customer.address2 || "",
    city: customer.city || "",
    province: customer.province || "",
    postalCode: customer.postalCode || "",
    country: customer.country || "Canada",
  };

  const payload = {
    user_id: user?.id || null,
    session_token: sessionToken,
    customer_email: String(customer.email || user?.email || "").trim() || null,
    customer_name: customerName || null,
    cart,
    shipping_address: shippingAddress,
    billing_address: shippingAddress,
    currency: "CAD",
    subtotal: safeMoney(totals.subtotal),
    discount: safeMoney(totals.discount),
    shipping: safeMoney(totals.shipping),
    tax: safeMoney(totals.tax),
    total: safeMoney(totals.total),
    status: "active",
    processing_started_at: null,
    last_activity_at: now,
    expires_at: expiresAt,
  };

  const { error } = await service
    .from("checkout_sessions")
    .upsert(payload, { onConflict: "session_token" });
  if (error) throw error;

  return respond(req, { sessionToken, status: "active" });
}

async function resumeConvertedCheckout(
  req: Request,
  service: any,
  sessionToken: string,
  orderId: string,
) {
  const [{ data: order, error: orderError }, { data: tracked, error: trackedError }] = await Promise.all([
    service
      .from("orders")
      .select("id,order_number,confirmation_token,payment_mode,payment_status,subtotal,discount,shipping,tax,total,shipping_address,stripe_checkout_session_id")
      .eq("id", orderId)
      .maybeSingle(),
    service
      .from("checkout_sessions")
      .select("stripe_client_secret,stripe_checkout_session_id")
      .eq("session_token", sessionToken)
      .eq("converted_order_id", orderId)
      .maybeSingle(),
  ]);
  if (orderError) throw orderError;
  if (trackedError) throw trackedError;
  if (!order) {
    return respond(req, { error: true, retryable: true, message: "The previous checkout could not be found. Please try again." }, 409);
  }

  if (order.payment_status === "paid") {
    return respond(req, {
      paid: true,
      orderNumber: order.order_number,
      confirmationToken: order.confirmation_token,
    });
  }

  const paymentMode = order.payment_mode === "test" ? "test" : "live";
  const stripePublishableKey = Deno.env.get(paymentMode === "test" ? "STRIPE_TEST_PUBLISHABLE_KEY" : "STRIPE_PUBLISHABLE_KEY");
  const stripeSecret = Deno.env.get(paymentMode === "test" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY");
  if (!stripePublishableKey || !stripeSecret) {
    return respond(req, { error: true, retryable: true, message: "The secure payment session is not configured." }, 503);
  }

  let clientSecret = tracked?.stripe_client_secret || "";
  const stripeSessionId = tracked?.stripe_checkout_session_id || order.stripe_checkout_session_id || "";
  if (!clientSecret && stripeSessionId) {
    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(stripeSessionId)}`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          "Stripe-Version": "2026-08-26.dahlia",
        },
      },
    );
    const stripeSession = await stripeResponse.json();
    if (!stripeResponse.ok) {
      return respond(
        req,
        { error: true, retryable: true, message: stripeSession?.error?.message || "The secure payment session could not be resumed." },
        502,
      );
    }
    if (stripeSession.status === "expired") {
      return respond(req, { error: true, retryable: true, message: "This secure payment session expired. Please try checkout again." }, 409);
    }
    clientSecret = String(stripeSession.client_secret || "");
    if (clientSecret) {
      await service
        .from("checkout_sessions")
        .update({ stripe_client_secret: clientSecret, stripe_checkout_session_id: stripeSessionId })
        .eq("session_token", sessionToken);
    }
  }

  if (!clientSecret) {
    return respond(req, { error: true, retryable: true, message: "The secure payment session could not be resumed. Please try again." }, 409);
  }

  const taxBase = Math.max(0, Number(order.total || 0) - Number(order.tax || 0));
  const taxRate = taxBase > 0 ? Number(order.tax || 0) / taxBase : 0;
  return respond(req, {
    orderNumber: order.order_number,
    confirmationToken: order.confirmation_token,
    clientSecret,
    publishableKey: stripePublishableKey,
    configured: true,
    paymentMode,
    uiMode: "custom",
    resumed: true,
    pricing: {
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      shipping: Number(order.shipping || 0),
      tax: Number(order.tax || 0),
      total: Number(order.total || 0),
      taxRate,
      taxName: "Tax",
    },
  });
}

async function forwardCreateOrder(
  req: Request,
  service: any,
  supabaseUrl: string,
  anonKey: string,
  body: any,
) {
  const sessionToken = String(body?.checkoutSessionToken || "").trim();
  const customerEmail = String(body?.customer?.email || "").trim().toLowerCase();
  if (!uuidRe.test(sessionToken)) {
    return respond(req, { error: true, retryable: true, message: "Your checkout session is not ready yet. Please try again." }, 409);
  }
  if (!customerEmail || !customerEmail.includes("@")) {
    return respond(req, { error: true, message: "Enter a valid email address." }, 400);
  }

  const [ipRate, emailRate] = await Promise.all([
    consumeRateLimit(service, await sha256Hex(`checkout:create:ip:${clientIp(req)}`), 20, 600),
    consumeRateLimit(service, await sha256Hex(`checkout:create:email:${customerEmail}`), 8, 600),
  ]);
  const blocked = !ipRate.allowed ? ipRate : !emailRate.allowed ? emailRate : null;
  if (blocked) {
    const retryAfter = Math.max(1, Number(blocked.retry_after || 60));
    return respond(
      req,
      { error: true, retryable: true, rateLimited: true, message: "Too many checkout attempts. Please wait a moment and try again." },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  const { data: claim, error: claimError } = await service.rpc("claim_checkout_session", {
    p_session_token: sessionToken,
  });
  if (claimError) throw claimError;

  if (!claim?.claimed) {
    if (claim?.status === "converted" && claim?.converted_order_id) {
      return resumeConvertedCheckout(req, service, sessionToken, String(claim.converted_order_id));
    }
    if (claim?.status === "processing") {
      return respond(
        req,
        { error: true, retryable: true, message: "Checkout is already being prepared. Please wait a moment and try again." },
        409,
        { "Retry-After": "2" },
      );
    }
    return respond(req, { error: true, retryable: true, message: "This checkout session expired. Refresh checkout and try again." }, 409);
  }

  const origin = requestOrigin(req);
  const forwardHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anonKey,
    Origin: origin || "https://gdpclothing.ca",
  };
  const authorization = req.headers.get("Authorization");
  if (authorization) forwardHeaders.Authorization = authorization;

  let upstream: Response;
  try {
    upstream = await fetch(`${supabaseUrl}/functions/v1/checkout`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("checkout gateway upstream network error", error);
    return respond(
      req,
      { error: true, retryable: true, message: "Checkout is still being prepared. Please retry shortly." },
      502,
      { "Retry-After": "2" },
    );
  }

  let data: any = null;
  try {
    data = await upstream.json();
  } catch {
    data = { error: true, message: "Checkout returned an invalid response." };
  }

  if (!upstream.ok || data?.error) {
    await releaseClaim(service, sessionToken);
    return respond(req, data || { error: true, message: "Checkout failed." }, upstream.status || 502);
  }

  if (data?.orderNumber) {
    const { data: order } = await service
      .from("orders")
      .select("id,stripe_checkout_session_id")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (order?.id) {
      await service
        .from("checkout_sessions")
        .update({
          status: "converted",
          converted_order_id: order.id,
          stripe_checkout_session_id: order.stripe_checkout_session_id || null,
          stripe_client_secret: data.clientSecret || null,
          processing_started_at: null,
          last_activity_at: new Date().toISOString(),
        })
        .eq("session_token", sessionToken);
    }
  }

  return respond(req, data, upstream.status);
}

Deno.serve(async (req: Request) => {
  const origin = requestOrigin(req);
  if (!isAllowedOrigin(origin)) {
    return respond(req, { error: true, message: "Origin not allowed." }, 403);
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return respond(req, { error: true, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond(req, { error: true, message: "Server configuration is incomplete." }, 500);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const action = String(body?.action || "");
    if (action === "trackCheckout") {
      return await trackCheckout(req, service, supabaseUrl, anonKey, body);
    }
    if (action === "createOrder") {
      return await forwardCreateOrder(req, service, supabaseUrl, anonKey, body);
    }
    return respond(req, { error: true, message: "Unsupported checkout gateway action." }, 400);
  } catch (error) {
    console.error("checkout-gateway", error);
    return respond(req, { error: true, message: error instanceof Error ? error.message : "Checkout gateway failed." }, 500);
  }
});
