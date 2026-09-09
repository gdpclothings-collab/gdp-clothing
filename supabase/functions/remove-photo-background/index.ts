import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://gdp-clothing.pages.dev",
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 20 * 1024 * 1024;
const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function requestOrigin(req: Request) {
  return req.headers.get("origin") || "";
}

function isAllowedOrigin(origin: string) {
  return !origin || allowedOrigins.has(origin) || localOriginPattern.test(origin);
}

function headers(req: Request, extra: Record<string, string> = {}) {
  const origin = requestOrigin(req);
  return {
    ...(origin && isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
    ...extra,
  };
}

function respond(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: headers(req, extraHeaders) });
}

function safeName(value: unknown) {
  return String(value || "photo")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "photo";
}

function positiveIntEnv(name: string, fallback: number) {
  const raw = Number(Deno.env.get(name) || fallback);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function clientIp(req: Request) {
  const direct = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
  if (direct) return direct.trim().slice(0, 128);
  const forwarded = req.headers.get("x-forwarded-for") || "";
  return (forwarded.split(",")[0] || "unknown").trim().slice(0, 128);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function currentUserId(req: Request, url: string, anonKey: string) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.auth.getUser();
  return data?.user?.is_anonymous === true ? null : data?.user?.id || null;
}

type QuotaRule = {
  scope: string;
  keyHash: string;
  windowSeconds: number;
  limit: number;
  cooldownSeconds?: number;
};

async function consumeQuota(service: any, rule: QuotaRule) {
  const { data, error } = await service.rpc("consume_background_removal_quota", {
    p_scope: rule.scope,
    p_key_hash: rule.keyHash,
    p_window_seconds: rule.windowSeconds,
    p_limit: rule.limit,
    p_cooldown_seconds: rule.cooldownSeconds || 0,
  });
  if (error) throw new Error(`Background-removal quota check failed: ${error.message}`);
  return data || { allowed: false, retry_after_seconds: 30, reason: "quota_unavailable" };
}

Deno.serve(async (req: Request) => {
  const origin = requestOrigin(req);
  if (!isAllowedOrigin(origin)) {
    return respond(req, { ok: false, retryable: false, message: "Origin not allowed." }, 403);
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { ok: false, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const removeBgKey = Deno.env.get("REMOVE_BG_API_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !removeBgKey) {
    return respond(req, { ok: false, retryable: false, message: "Background removal is not configured yet." }, 503);
  }

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const ip = clientIp(req);
    const ipHash = await sha256(`ip:${ip}`);
    const globalHash = await sha256("gdp-background-removal-global");
    const globalDailyLimit = positiveIntEnv("BG_REMOVE_GLOBAL_DAILY_LIMIT", 250);
    const ipHourlyLimit = positiveIntEnv("BG_REMOVE_IP_HOURLY_LIMIT", 25);
    const ipDailyLimit = positiveIntEnv("BG_REMOVE_IP_DAILY_LIMIT", 100);

    for (const rule of [
      { scope: "global_day", keyHash: globalHash, windowSeconds: 86400, limit: globalDailyLimit },
      { scope: "ip_hour", keyHash: ipHash, windowSeconds: 3600, limit: ipHourlyLimit, cooldownSeconds: 2 },
      { scope: "ip_day", keyHash: ipHash, windowSeconds: 86400, limit: ipDailyLimit },
    ]) {
      const result = await consumeQuota(service, rule);
      if (!result.allowed) {
        const retryAfter = Math.max(1, Number(result.retry_after_seconds || 30));
        return respond(req, {
          ok: false,
          retryable: true,
          rateLimited: true,
          message: result.scope === "global_day"
            ? "Background removal has reached today's safety limit. Please try again later."
            : "Too many background-removal requests. Please wait and try again.",
        }, 429, { "Retry-After": String(retryAfter) });
      }
    }

    const userId = await currentUserId(req, supabaseUrl, anonKey);
    const userAgent = (req.headers.get("user-agent") || "unknown").slice(0, 180);
    const sessionHash = await sha256(userId ? `user:${userId}` : `guest:${ip}:${userAgent}`);
    const sessionTenMinuteLimit = positiveIntEnv("BG_REMOVE_SESSION_10M_LIMIT", 5);
    const sessionDailyLimit = positiveIntEnv("BG_REMOVE_SESSION_DAILY_LIMIT", 30);

    for (const rule of [
      { scope: "session_10m", keyHash: sessionHash, windowSeconds: 600, limit: sessionTenMinuteLimit, cooldownSeconds: 8 },
      { scope: "session_day", keyHash: sessionHash, windowSeconds: 86400, limit: sessionDailyLimit },
    ]) {
      const result = await consumeQuota(service, rule);
      if (!result.allowed) {
        const retryAfter = Math.max(1, Number(result.retry_after_seconds || 30));
        return respond(req, {
          ok: false,
          retryable: true,
          rateLimited: true,
          message: result.reason === "cooldown"
            ? "Please wait a few seconds before processing another photo."
            : "This editing session has reached its background-removal limit. Please try again later.",
        }, 429, { "Retry-After": String(retryAfter) });
      }
    }

    const form = await req.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) return respond(req, { ok: false, message: "Choose a photo to process." }, 400);
    if (!allowedTypes.has(photo.type)) return respond(req, { ok: false, message: "Use a JPG, PNG, or WEBP photo." }, 400);
    if (photo.size <= 0 || photo.size > maxBytes) return respond(req, { ok: false, message: "The photo must be 20 MB or smaller." }, 413);

    const jobId = crypto.randomUUID();
    const folder = userId ? `${userId}/background-removal/${jobId}` : `guest/${jobId}`;
    const baseName = safeName(photo.name);
    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const originalPath = `${folder}/${baseName}-original.${extension}`;
    const cleanedPath = `${folder}/${baseName}-transparent.png`;

    const { error: originalError } = await service.storage
      .from("customer-uploads")
      .upload(originalPath, photo, { contentType: photo.type, upsert: false });
    if (originalError) throw originalError;

    const providerForm = new FormData();
    providerForm.append("image_file", photo, photo.name);
    providerForm.append("size", "auto");
    providerForm.append("format", "png");
    const provider = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": removeBgKey },
      body: providerForm,
    });

    if (!provider.ok) {
      const detail = (await provider.text()).slice(0, 500);
      const { data: originalSigned } = await service.storage.from("customer-uploads").createSignedUrl(originalPath, 3600);
      console.error("remove.bg failed", provider.status, detail);
      return respond(req, {
        ok: false,
        retryable: provider.status === 429 || provider.status >= 500,
        originalPath,
        originalUrl: originalSigned?.signedUrl || "",
        message: provider.status === 429
          ? "Background removal is busy. Please retry in a moment."
          : "The background could not be removed. Retry or refine the original manually.",
      });
    }

    const cleanedBytes = await provider.arrayBuffer();
    if (!cleanedBytes.byteLength) throw new Error("The background removal service returned an empty image.");
    const { error: cleanedError } = await service.storage
      .from("customer-uploads")
      .upload(cleanedPath, cleanedBytes, { contentType: "image/png", upsert: false });
    if (cleanedError) throw cleanedError;

    const { data: signed } = await service.storage
      .from("customer-uploads")
      .createSignedUrls([originalPath, cleanedPath], 3600);
    const urlByPath = new Map((signed || []).map((entry: any) => [entry.path, entry.signedUrl]));
    return respond(req, {
      ok: true,
      provider: "remove.bg",
      originalPath,
      originalUrl: urlByPath.get(originalPath) || "",
      cleanedPath,
      cleanedUrl: urlByPath.get(cleanedPath) || "",
    });
  } catch (error) {
    console.error("remove-photo-background", error);
    return respond(req, { ok: false, retryable: true, message: "Background removal failed. Please retry." }, 500);
  }
});
