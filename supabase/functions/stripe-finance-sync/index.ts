import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

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

function headers(req: Request) {
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
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
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

function asIsoFromUnix(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function toMoney(value: unknown) {
  const cents = Number(value || 0);
  return Number.isFinite(cents) ? Math.round(cents) / 100 : 0;
}

function cleanText(value: unknown, max = 160) {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

function unixBoundary(value: unknown) {
  if (!value) return null;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

async function stripeList(
  path: string,
  secret: string,
  params: Array<[string, string]>,
  maxPages = 20,
) {
  const data: any[] = [];
  let startingAfter = "";
  let truncated = false;

  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams();
    query.set("limit", "100");
    for (const [key, value] of params) query.append(key, value);
    if (startingAfter) query.set("starting_after", startingAfter);

    const response = await fetch(`https://api.stripe.com/v1/${path}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });

    if (!response.ok) {
      let message = "Stripe settlement sync failed.";
      try {
        const body = await response.json();
        message = body?.error?.message || message;
      } catch {
        // Keep the safe fallback message.
      }
      throw new Error(message);
    }

    const body = await response.json();
    const rows = Array.isArray(body?.data) ? body.data : [];
    data.push(...rows);

    if (!body?.has_more || !rows.length) return { data, truncated: false };
    startingAfter = String(rows[rows.length - 1]?.id || "");
    if (!startingAfter) return { data, truncated: false };
    truncated = true;
  }

  return { data, truncated };
}

Deno.serve(async (req: Request) => {
  if (!isAllowedOrigin(requestOrigin(req))) {
    return respond(req, { error: true, message: "Origin not allowed." }, 403);
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { error: true, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const token = bearer(req);

  if (!supabaseUrl || !anonKey || !serviceKey || !stripeSecret) {
    return respond(req, { error: true, message: "Stripe finance sync is not configured." }, 503);
  }
  if (!token) return respond(req, { error: true, message: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData?.user || null;
  if (userError || !user) return respond(req, { error: true, message: "Authentication required." }, 401);
  if (readJwtPayload(token).aal !== "aal2") {
    return respond(req, { error: true, message: "MFA verification required." }, 403);
  }

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return respond(req, { error: true, message: "Could not verify admin access." }, 500);
  if (profile?.role !== "admin") return respond(req, { error: true, message: "Admin access required." }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }

  const fromUnix = unixBoundary(body.from);
  const toUnix = unixBoundary(body.to);
  const createdParams: Array<[string, string]> = [];
  if (fromUnix) createdParams.push(["created[gte]", String(fromUnix)]);
  if (toUnix) createdParams.push(["created[lt]", String(toUnix)]);

  try {
    const [balanceResult, payoutResult] = await Promise.all([
      stripeList("balance_transactions", stripeSecret, [
        ...createdParams,
        ["expand[]", "data.source"],
      ]),
      stripeList("payouts", stripeSecret, createdParams),
    ]);

    const balanceRows = balanceResult.data;
    const paymentIntentIds = [...new Set(balanceRows.map((row: any) => {
      const source = row?.source && typeof row.source === "object" ? row.source : null;
      const paymentIntent = source?.payment_intent;
      return typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
    }).filter(Boolean))];

    const metadataOrderIds = [...new Set(balanceRows.map((row: any) => {
      const source = row?.source && typeof row.source === "object" ? row.source : null;
      const orderId = source?.metadata?.order_id;
      return uuidRe.test(String(orderId || "")) ? String(orderId) : null;
    }).filter(Boolean))];

    const orderByPaymentIntent = new Map<string, string>();
    const validOrderIds = new Set<string>();

    if (paymentIntentIds.length) {
      const { data: orders, error } = await service
        .from("orders")
        .select("id,stripe_payment_intent_id,payment_mode")
        .in("stripe_payment_intent_id", paymentIntentIds)
        .eq("payment_mode", "live");
      if (error) throw error;
      for (const order of orders || []) {
        if (order.stripe_payment_intent_id) orderByPaymentIntent.set(order.stripe_payment_intent_id, order.id);
        validOrderIds.add(order.id);
      }
    }

    if (metadataOrderIds.length) {
      const { data: orders, error } = await service
        .from("orders")
        .select("id,payment_mode")
        .in("id", metadataOrderIds)
        .eq("payment_mode", "live");
      if (error) throw error;
      for (const order of orders || []) validOrderIds.add(order.id);
    }

    const now = new Date().toISOString();
    const settlementRows = balanceRows.map((row: any) => {
      const source = row?.source && typeof row.source === "object" ? row.source : null;
      const paymentIntent = source?.payment_intent;
      const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id || null;
      const metadataOrderId = uuidRe.test(String(source?.metadata?.order_id || ""))
        ? String(source.metadata.order_id)
        : null;
      const orderId = (metadataOrderId && validOrderIds.has(metadataOrderId))
        ? metadataOrderId
        : paymentIntentId
          ? orderByPaymentIntent.get(paymentIntentId) || null
          : null;

      return {
        stripe_balance_transaction_id: String(row.id),
        order_id: orderId,
        stripe_source_id: typeof row.source === "string" ? row.source : source?.id || null,
        stripe_payment_intent_id: paymentIntentId,
        transaction_type: String(row.type || row.reporting_category || "unknown"),
        reporting_category: cleanText(row.reporting_category),
        amount: toMoney(row.amount),
        fee: toMoney(row.fee),
        net: toMoney(row.net),
        currency: String(row.currency || "cad").toUpperCase().slice(0, 3),
        payment_mode: "live",
        stripe_created_at: asIsoFromUnix(row.created) || now,
        available_on: asIsoFromUnix(row.available_on),
        updated_at: now,
      };
    });

    const payoutRows = payoutResult.data.map((row: any) => ({
      stripe_payout_id: String(row.id),
      stripe_balance_transaction_id: typeof row.balance_transaction === "string"
        ? row.balance_transaction
        : row.balance_transaction?.id || null,
      amount: toMoney(row.amount),
      currency: String(row.currency || "cad").toUpperCase().slice(0, 3),
      status: String(row.status || "pending"),
      method: cleanText(row.method, 40),
      payout_type: cleanText(row.type, 40),
      automatic: Boolean(row.automatic),
      arrival_date: asIsoFromUnix(row.arrival_date)?.slice(0, 10) || null,
      failure_code: cleanText(row.failure_code, 100),
      payment_mode: "live",
      stripe_created_at: asIsoFromUnix(row.created) || now,
      updated_at: now,
    }));

    if (settlementRows.length) {
      const { error } = await service
        .from("finance_stripe_balance_transactions")
        .upsert(settlementRows, { onConflict: "stripe_balance_transaction_id" });
      if (error) throw error;
    }

    if (payoutRows.length) {
      const { error } = await service
        .from("finance_stripe_payouts")
        .upsert(payoutRows, { onConflict: "stripe_payout_id" });
      if (error) throw error;
    }

    return respond(req, {
      ok: true,
      syncedAt: now,
      balanceTransactions: settlementRows.length,
      payouts: payoutRows.length,
      truncated: Boolean(balanceResult.truncated || payoutResult.truncated),
    });
  } catch (error) {
    console.error("stripe finance sync failed", error);
    return respond(req, { error: true, message: error?.message || "Stripe finance sync failed." }, 502);
  }
});