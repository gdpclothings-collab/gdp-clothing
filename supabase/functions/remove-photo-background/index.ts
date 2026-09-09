import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://gdp-clothing.pages.dev",
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 20 * 1024 * 1024;

function originFor(req: Request) {
  const origin = req.headers.get("origin") || "";
  if (allowedOrigins.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "https://gdpclothing.ca";
}

function headers(req: Request) {
  return {
    "Access-Control-Allow-Origin": originFor(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

function safeName(value: unknown) {
  return String(value || "photo")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "photo";
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { ok: false, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const removeBgKey = Deno.env.get("REMOVE_BG_API_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !removeBgKey) {
    return respond(req, { ok: false, retryable: false, message: "Background removal is not configured yet." }, 503);
  }

  try {
    const form = await req.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) return respond(req, { ok: false, message: "Choose a photo to process." }, 400);
    if (!allowedTypes.has(photo.type)) return respond(req, { ok: false, message: "Use a JPG, PNG, or WEBP photo." }, 400);
    if (photo.size <= 0 || photo.size > maxBytes) return respond(req, { ok: false, message: "The photo must be 20 MB or smaller." }, 413);

    const userId = await currentUserId(req, supabaseUrl, anonKey);
    const jobId = crypto.randomUUID();
    const folder = userId ? `${userId}/background-removal/${jobId}` : `guest/${jobId}`;
    const baseName = safeName(photo.name);
    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const originalPath = `${folder}/${baseName}-original.${extension}`;
    const cleanedPath = `${folder}/${baseName}-transparent.png`;
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

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
