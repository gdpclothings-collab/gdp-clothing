// GDP Quick Design / Phase B: preview-resolution remove.bg proxy.
// Activated on the existing GDP Supabase project for guarded preview processing.
// Uses EXISTING Custom Studio REMOVE_BG_API_KEY project secret, never another account.
// Only provider-confirmed FREE preview calls are permitted. Fail closed otherwise.
// NEVER put the remove.bg key or Supabase secret key in the web bundle.
// The API returns one PNG and stores no photo or output on our servers.
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_MONTHLY_PREVIEW_CALLS = 50;
const FREE_CALLS_SAFETY_BUFFER = 5;
const REMOVE_BG_ACCOUNT = 'https://api.remove.bg/v1.0/account';
const REMOVE_BG_API = 'https://api.remove.bg/v1.0/removebg';
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// This read-only account check never sends a photo and never spends a credit.
// Reuse the same check for the on-demand status button and actual uploads.
type FreeBalance = { ready: boolean; code: 'READY' | 'LIMIT_REACHED' | 'SERVICE_UNAVAILABLE' };
async function checkFreeBalance(key: string): Promise<FreeBalance> {
  try {
    const response = await fetch(REMOVE_BG_ACCOUNT, {
      method: 'GET',
      headers: { 'X-API-Key': key, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ready: false, code: 'SERVICE_UNAVAILABLE' };
    const balance = await response.json();
    const freeCalls = balance?.data?.attributes?.api?.free_calls;
    if (!Number.isInteger(freeCalls)) return { ready: false, code: 'SERVICE_UNAVAILABLE' };
    if (freeCalls <= FREE_CALLS_SAFETY_BUFFER) return { ready: false, code: 'LIMIT_REACHED' };
    return { ready: true, code: 'READY' };
  } catch {
    return { ready: false, code: 'SERVICE_UNAVAILABLE' };
  }
}

function balanceMessage(code: FreeBalance['code']): string {
  if (code === 'READY') return 'Free preview removal is available. Upload a photo to create a cutout.';
  if (code === 'LIMIT_REACHED') return 'This remove.bg account has too few free calls remaining. Your original photos will stay unchanged. Use the external option.';
  return 'The remove.bg account or its free allowance could not be verified. No photo has been sent and no paid processing will be attempted.';
}


function allowedOrigin(origin: string) {
  const official = origin === 'https://gdpclothing.ca' || origin === 'https://www.gdpclothing.ca';
  const branch = /^https:\/\/[a-z0-9-]+\.gdp-clothing\.pages\.dev$/i.test(origin);
  return official || branch;
}

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Vary': 'Origin',
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
  };
}

function json(origin: string, status: number, code: string, message: string) {
  return new Response(JSON.stringify({ code, message, fallback: 'https://www.remove.bg/' }), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function validSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.length > 8 && [137,80,78,71,13,10,26,10].every((byte,i)=>bytes[i]===byte);
  if (mime === 'image/webp') return bytes.length > 12
    && String.fromCharCode(...bytes.subarray(0,4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8,12)) === 'WEBP';
  return false;
}

function getServerKey() {
  const old = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (old) return old;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return typeof keys.default === 'string' ? keys.default : '';
  } catch {
    return '';
  }
}

async function identityHash(request: Request) {
  // Store only an opaque salted hash for the hourly rate limit; never retain IPs.
  // Use the existing Supabase service secret as the HMAC salt if a dedicated
  // hash salt has not been provisioned. This never leaves the server.
  const salt = Deno.env.get('GDP_REMOVEBG_HASH_SALT') || getServerKey();
  if (salt.length < 24) return '';
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
    || '';
  // Even if provider omits forwarding headers, a global 50-call ceiling still applies.
  const encoded = new TextEncoder().encode(salt + ':' + (ip || 'unknown'));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  const isReadOnlyStatus = request.method === 'GET';
  if (!allowedOrigin(origin) && !(isReadOnlyStatus && !origin)) {
    // Allow originless read-only status probes, never originless photo uploads.
    // An Origin allow-list is a browser privacy boundary, NOT caller authentication.
    return new Response('Origin not allowed', { status: 403 });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== 'POST' && !isReadOnlyStatus) {
    return json(origin, 405, 'METHOD_NOT_ALLOWED', 'Only upload or status requests are supported.');
  }

  // Reuse the SAME project-level remove.bg secret that Custom Studio's active
  // remove-photo-background function already reads. No second account/key.
  const key = Deno.env.get('REMOVE_BG_API_KEY') || '';
  const adminKey = getServerKey();
  const projectUrl = Deno.env.get('SUPABASE_URL') || '';
  // Deploying this dedicated function activates Quick Design. It will only
  // make a removal request when the provider confirms enough free API calls
  // are still available. No new secrets, payment methods or paid upgrades.
  if (!key || !adminKey || !projectUrl) {
    return json(origin, 503, 'SERVICE_UNAVAILABLE', 'The shared remove.bg configuration is not available. Use the external option.');
  }

  if (isReadOnlyStatus) {
    const result = await checkFreeBalance(key);
    return new Response(JSON.stringify({
      ready: result.ready,
      code: result.code,
      message: balanceMessage(result.code),
    }), {
      status: 200,
      headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const limit = Math.max(0, Math.min(MAX_MONTHLY_PREVIEW_CALLS,
    Number(Deno.env.get('GDP_REMOVEBG_MONTHLY_CALL_LIMIT') || 50)));
  if (limit === 0) return json(origin, 503, 'SERVICE_UNAVAILABLE', 'Free preview removal is disabled.');
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BYTES + 10_000) {
    return json(origin, 413, 'PHOTO_TOO_LARGE', 'Photos must be at most 10 MB.');
  }

  let image: File;
  let signature: Uint8Array;
  try {
    const form = await request.formData();
    const candidate = form.get('image_file');
    if (!(candidate instanceof File) || !ALLOWED_MIMES.has(candidate.type) ||
        candidate.size < 32 || candidate.size > MAX_BYTES) {
      return json(origin, 400, 'INVALID_PHOTO', 'Upload a valid JPG, PNG or WebP file up to 10 MB.');
    }
    image = candidate;
    signature = new Uint8Array(await image.slice(0, 16).arrayBuffer());
    if (!validSignature(signature, image.type)) {
      return json(origin, 400, 'INVALID_PHOTO', 'The photo file type could not be verified.');
    }
  } catch {
    return json(origin, 400, 'INVALID_PHOTO', 'The selected photo could not be read.');
  }

  const hash = await identityHash(request);
  if (!hash) return json(origin, 503, 'SERVICE_UNAVAILABLE', 'Automatic cutouts are temporarily unavailable.');

  // Atomic DB reservation BEFORE the third-party call: no concurrency races
  // or retries may exceed the free global ceiling. Failed requests consume
  // the reservation conservatively, preventing accidental extra calls.
  let allowed = false;
  try {
    const admin = createClient(projectUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc('reserve_quick_design_removebg_preview', {
      p_identity_hash: hash,
      p_monthly_limit: limit,
    });
    if (error || !data) {
      return json(origin, 503, 'SERVICE_UNAVAILABLE', 'The free-use safety limit cannot be verified.');
    }
    if (data.allowed !== true) {
      const isMonth = data.reason === 'MONTHLY_LIMIT';
      return json(origin, 429, isMonth ? 'LIMIT_REACHED' : 'RATE_LIMIT',
        isMonth ? 'The free automatic-cutout allowance has been reached. Open remove.bg instead.'
          : 'Too many automatic cutouts. Please use remove.bg separately.');
    }
    allowed = true;
  } catch {
    return json(origin, 503, 'SERVICE_UNAVAILABLE', 'The free-use safety limit cannot be verified.');
  }
  if (!allowed) return json(origin, 503, 'SERVICE_UNAVAILABLE', 'Automatic cutouts are unavailable.');

  // Same free-only read check as GET diagnostics. This is a shared account,
  // so never infer eligibility from Quick Design's private monthly counters.
  const balanceCheck = await checkFreeBalance(key);
  if (!balanceCheck.ready) {
    return json(origin, balanceCheck.code === 'LIMIT_REACHED' ? 429 : 503,
      balanceCheck.code, balanceMessage(balanceCheck.code));
  }

  // size=preview caps output to 0.25MP; paid resolutions never requested.
  // No retries, upgrades, or paid credits requested by this function.
  const form = new FormData();
  form.set('image_file', image, 'customer-image');
  form.set('size', 'preview');
  form.set('format', 'png');
  form.set('crop', 'true');
  try {
    const upstream = await fetch(REMOVE_BG_API, {
      method: 'POST',
      headers: { 'X-API-Key': key },
      body: form,
      signal: AbortSignal.timeout(25000),
    });
    if (!upstream.ok) {
      if ([402, 403, 429].includes(upstream.status)) {
        return json(origin, 429, 'LIMIT_REACHED', 'Automatic free cutouts are unavailable. Open remove.bg instead.');
      }
      return json(origin, 502, 'SERVICE_UNAVAILABLE', 'Automatic cutout could not be completed.');
    }
    const type = upstream.headers.get('content-type') || '';
    if (!type.startsWith('image/png')) {
      return json(origin, 502, 'SERVICE_UNAVAILABLE', 'The cutout service returned an unexpected format.');
    }
    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > 5 * 1024 * 1024) {
      return json(origin, 502, 'SERVICE_UNAVAILABLE', 'The transparent cutout could not be verified.');
    }
    return new Response(buffer, {
      status: 200,
      headers: { ...cors(origin), 'Content-Type': 'application/octet-stream', 'X-GDP-Image-Type': 'image/png' },
    });
  } catch {
    return json(origin, 502, 'SERVICE_UNAVAILABLE', 'Automatic cutout timed out. Keep your original photo or open remove.bg.');
  }
});
