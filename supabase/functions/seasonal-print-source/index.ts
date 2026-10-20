import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { approvedMasterFormat, hashQuotaKey, networkHint, readBoundedJson } from "./policy.mjs";

// This function is intentionally isolated from checkout and Stripe.
// Guest studio orders require public invocation, but only ACTIVE, licensed,
// approved, visible artwork masters may be signed. Never trust client paths.
const BUCKET = "artwork-production";
const MAX_SOURCES = 10;
const EXPIRY_SECONDS = 120;
const IP_WINDOW_SECONDS = 600;
const IP_MAX_REQUESTS = 120;
// Shared budget protects against forged or rapidly rotating client IP headers.
const GLOBAL_MAX_REQUESTS = 5000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedOrigin(origin: string): boolean {
  if (!origin) return true; // Non-browser probes still need to reach method checks.
  try {
    const url = new URL(origin);
    if (url.origin !== origin) return false;
    if (url.protocol === "https:" && (
      url.hostname === "gdpclothing.ca" ||
      url.hostname === "www.gdpclothing.ca" ||
      url.hostname === "gdp-clothing.pages.dev" ||
      /^[a-z0-9-]+\.gdp-clothing\.pages\.dev$/i.test(url.hostname)
    )) return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}
function headers(origin = "") {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    ...(allowedOrigin(origin) && origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Expose-Headers": "Retry-After",
  };
}
const respond = (body: unknown, status = 200, origin = "", extraHeaders = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers(origin), ...extraHeaders } });

async function enforceGuestRateLimit(db: ReturnType<typeof createClient>, req: Request, origin: string) {
  // The existing atomic quota RPC is callable only by service_role, not by
  // anon/authenticated users. No new public database grants are necessary.
  const limits = [
    { scope: "seasonal-print-source-ip-v1", hash: await hashQuotaKey(`seasonal:ip:${networkHint(req)}`), limit: IP_MAX_REQUESTS },
    { scope: "seasonal-print-source-global-v1", hash: await hashQuotaKey("seasonal:global"), limit: GLOBAL_MAX_REQUESTS },
  ];
  for (const quota of limits) {
    const { data, error } = await db.rpc("consume_background_removal_quota", {
      p_scope: quota.scope,
      p_key_hash: quota.hash,
      p_window_seconds: IP_WINDOW_SECONDS,
      p_limit: quota.limit,
      p_cooldown_seconds: 0,
    });
    if (error || typeof data?.allowed !== "boolean") throw new Error("Seasonal quota unavailable");
    if (!data.allowed) {
      const wait = Math.max(1, Math.min(IP_WINDOW_SECONDS, Number(data.retry_after_seconds) || 60));
      return respond({ error: "Too many Seasonal source requests. Please retry shortly." }, 429, origin, {
        "Retry-After": String(Math.ceil(wait)),
      });
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!allowedOrigin(origin)) return respond({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, origin);
  if (Number(req.headers.get("content-length") || 0) > 4096) return respond({ error: "Invalid request" }, 413, origin);

  const parsed = await readBoundedJson(req);
  if (!parsed.ok) return respond({ error: parsed.error }, parsed.status, origin);
  const body = parsed.value;
  const input = body?.artworkIds;
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_SOURCES ||
      !input.every((id: unknown) => typeof id === "string" && uuid.test(id))) {
    return respond({ error: "Invalid artwork identifiers" }, 400, origin);
  }
  const ids = [...new Set(input as string[])];
  if (ids.length !== input.length) return respond({ error: "Duplicate artwork identifiers" }, 400, origin);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return respond({ error: "Source service unavailable" }, 503, origin);

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const rateLimited = await enforceGuestRateLimit(db, req, origin);
    if (rateLimited) return rateLimited;

    const { data, error } = await db
      .from("artwork_library")
      .select("id,production_path,source_sha256,ink_bbox_px,aspect_ratio,max_width_in,max_height_in,ready_print,customizable")
      .in("id", ids)
      .eq("status", "active")
      .eq("studio_visible", true)
      .eq("rights_status", "confirmed")
      .or("proof_approved.eq.true,digital_approved.eq.true");
    if (error) throw error;
    const lookup = new Map((data || []).map((artwork) => [String(artwork.id), artwork]));
    const eligible = ids.map((id) => lookup.get(id));
    if (eligible.some((item) =>
      !item || (!item.ready_print && !item.customizable) ||
      !approvedMasterFormat(item) ||
      ![item.aspect_ratio, item.max_width_in, item.max_height_in].every((number) => Number.isFinite(Number(number)) && Number(number) > 0)
    )) {
      return respond({ error: "Seasonal source is not published or is unavailable" }, 404, origin);
    }

    const sources = [];
    for (const artwork of eligible) {
      // A signed URL is only valid briefly; no long-lived raw production URLs
      // are included in saved designs, previews, receipts or frontend bundles.
      const { data: signed, error: signError } = await db.storage
        .from(BUCKET).createSignedUrl(artwork!.production_path, EXPIRY_SECONDS);
      if (signError || !signed?.signedUrl) throw new Error("Signing unavailable");
      sources.push({
        artworkId: artwork!.id,
        signedUrl: signed.signedUrl,
        sourceSha256: artwork!.source_sha256,
        inkBboxPx: artwork!.ink_bbox_px,
        format: approvedMasterFormat(artwork),
      });
    }
    return respond({ sources }, 200, origin);
  } catch {
    // Fail closed: never issue a thumbnail URL or raw storage path as fallback.
    return respond({ error: "The approved print source could not be prepared. Please retry." }, 503, origin);
  }
});
