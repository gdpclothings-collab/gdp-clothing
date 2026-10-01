import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://gdp-clothing.pages.dev",
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
]);
const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const postalCodeRe = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;

const TOKEN_URL = "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token";
const RATING_URL = "https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/rating/v1/rates";
const CACHE_TTL_SECONDS = 300;
const IP_LIMIT = 120;
const IP_WINDOW_SECONDS = 600;
const GLOBAL_MISS_LIMIT = 2500;
const GLOBAL_MISS_WINDOW_SECONDS = 3600;

function origin(req: Request) { return req.headers.get("origin") || ""; }
function allowed(value: string) { return !value || allowedOrigins.has(value) || localOriginPattern.test(value); }
function headers(req: Request, extra: Record<string, string> = {}) {
  const requestOrigin = origin(req);
  return {
    ...(requestOrigin && allowed(requestOrigin) ? { "Access-Control-Allow-Origin": requestOrigin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    ...extra,
  };
}
function respond(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: headers(req, extra) });
}
function postalCode(value: unknown) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return postalCodeRe.test(compact) ? compact : "";
}
function positive(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}
function rateRows(payload: any) {
  const candidates = payload?.rates || payload?.services || payload?.priceQuotes || payload?.items || payload?.data || [];
  const rows = Array.isArray(candidates) ? candidates : [];
  return rows.map((row: any) => ({
    serviceCode: String(row?.serviceCode || row?.service_code || row?.code || ""),
    serviceName: String(row?.serviceName || row?.service_name || row?.name || row?.serviceCode || "Canada Post"),
    price: money(row?.price ?? row?.totalPrice ?? row?.total ?? row?.due ?? row?.priceDetails?.due ?? row?.pricing?.total),
    expectedDeliveryDate: row?.expectedDeliveryDate || row?.expected_delivery_date || row?.deliveryDate || null,
    transitDays: Number(row?.transitDays ?? row?.transit_days ?? row?.deliveryDays ?? 0) || null,
  })).filter((row: any) => row.price != null);
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
async function consumeRateLimit(service: any, key: string, limit: number, windowSeconds: number) {
  const { data, error } = await service.rpc("consume_checkout_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`Canada Post rate limit check failed: ${error.message}`);
  return data || { allowed: false, retry_after: 60 };
}
async function accessToken(key: string, secret: string) {
  const body = new URLSearchParams({ scope: "merchant", grant_type: "client_credentials" });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "X-IBM-Client-Id": key, "X-IBM-Client-Secret": secret, "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    console.error("Canada Post OAuth failed", response.status, payload?.code || payload?.error || "unknown");
    throw new Error("Canada Post authentication is temporarily unavailable.");
  }
  return String(payload.access_token);
}

Deno.serve(async (req: Request) => {
  const requestOrigin = origin(req);
  if (!allowed(requestOrigin)) return respond(req, { error: true, message: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { error: true, message: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const key = Deno.env.get("CANADA_POST_API_KEY") || "";
    const secret = Deno.env.get("CANADA_POST_API_SECRET") || "";
    const customerNumber = Deno.env.get("CANADA_POST_CUSTOMER_NUMBER") || "";
    const originPostalCode = postalCode(Deno.env.get("CANADA_POST_ORIGIN_POSTAL_CODE"));
    if (!supabaseUrl || !serviceKey || !key || !secret || !customerNumber || !originPostalCode) {
      return respond(req, { configured: false, rates: [], message: "Canada Post live rating is not fully configured." }, 503);
    }

    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const ipHash = await sha256Hex(`canada-post:ip:${clientIp(req)}`);
    const ipRate = await consumeRateLimit(service, ipHash, IP_LIMIT, IP_WINDOW_SECONDS);
    if (!ipRate.allowed) {
      const retryAfter = Math.max(1, Number(ipRate.retry_after || 60));
      return respond(req, {
        error: true,
        rateLimited: true,
        rates: [],
        message: "Too many shipping-rate requests. Please wait a moment and try again.",
      }, 429, { "Retry-After": String(retryAfter) });
    }

    const body = await req.json();
    const destinationPostalCode = postalCode(body?.destinationPostalCode || body?.postalCode);
    if (!destinationPostalCode) return respond(req, { error: true, message: "Enter a valid Canadian postal code." }, 400);
    const weight = positive(body?.weightKg, 0.5, 0.05, 30);
    const length = positive(body?.lengthCm, 30, 1, 200);
    const width = positive(body?.widthCm, 25, 1, 200);
    const height = positive(body?.heightCm, 5, 1, 200);

    const cacheKey = await sha256Hex([
      originPostalCode,
      destinationPostalCode,
      weight.toFixed(3),
      length.toFixed(2),
      width.toFixed(2),
      height.toFixed(2),
    ].join("|"));

    const { data: cached, error: cacheReadError } = await service
      .from("canada_post_rate_cache")
      .select("response_payload,expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (cacheReadError) console.error("Canada Post cache read failed", cacheReadError.message);
    if (cached?.response_payload && new Date(cached.expires_at).getTime() > Date.now()) {
      return respond(req, { ...cached.response_payload, cached: true });
    }

    const globalKey = await sha256Hex("canada-post:global:external-miss");
    const globalRate = await consumeRateLimit(service, globalKey, GLOBAL_MISS_LIMIT, GLOBAL_MISS_WINDOW_SECONDS);
    if (!globalRate.allowed) {
      const retryAfter = Math.max(1, Number(globalRate.retry_after || 60));
      return respond(req, {
        configured: true,
        available: false,
        rates: [],
        fallbackRecommended: true,
        rateLimited: true,
        message: "Live Canada Post rates are temporarily busy. Please try again shortly.",
      }, 429, { "Retry-After": String(retryAfter) });
    }

    const token = await accessToken(key, secret);
    const ratingResponse = await fetch(RATING_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Accept": "application/json", "Content-Type": "application/json", "Accept-Language": "en-CA" },
      body: JSON.stringify({ customerNumber, originPostalCode, parcelCharacteristics: { weight, dimensions: { length, width, height } }, destination: { domestic: { postalCode: destinationPostalCode } } }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await ratingResponse.json().catch(() => ({}));
    if (!ratingResponse.ok) {
      console.error("Canada Post Rating failed", ratingResponse.status, payload?.code || payload?.error?.code || "unknown");
      return respond(req, { configured: true, available: false, rates: [], fallbackRecommended: true, message: "Live Canada Post rates are temporarily unavailable." }, 502);
    }

    const rates = rateRows(payload).sort((a: any, b: any) => Number(a.price) - Number(b.price));
    const responsePayload = { configured: true, available: rates.length > 0, rates, fallbackRecommended: rates.length === 0, source: "canada_post" };
    const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString();
    const { error: cacheWriteError } = await service
      .from("canada_post_rate_cache")
      .upsert({ cache_key: cacheKey, response_payload: responsePayload, expires_at: expiresAt, updated_at: new Date().toISOString() }, { onConflict: "cache_key" });
    if (cacheWriteError) console.error("Canada Post cache write failed", cacheWriteError.message);

    return respond(req, { ...responsePayload, cached: false });
  } catch (error) {
    console.error("canada-post-rates", error instanceof Error ? error.message : error);
    return respond(req, { configured: true, available: false, rates: [], fallbackRecommended: true, message: "Live Canada Post rates are temporarily unavailable." }, 502);
  }
});
