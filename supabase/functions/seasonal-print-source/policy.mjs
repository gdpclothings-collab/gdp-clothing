// Pure, runtime-neutral guards shared by the Edge Function and Node regression tests.
// These helpers never access storage credentials or expose private artwork paths.
export const MAX_BODY_BYTES = 4096;

export async function readBoundedJson(req) {
  const reader = req.body?.getReader();
  if (!reader) return { ok: false, status: 400, error: "Invalid JSON" };
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: "Invalid request" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(decoded) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  } finally {
    reader.releaseLock();
  }
}

// The production ingest writes a content-addressed filename: ID_SHA256.ext.
// Never sign a different path, even if a future malformed database row contains one.
export function approvedMasterFormat(artwork) {
  const id = String(artwork?.id || "");
  const sha = String(artwork?.source_sha256 || "");
  const path = String(artwork?.production_path || "");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) || !/^[0-9a-f]{64}$/i.test(sha)) return null;
  if (path === `${id}_${sha}.png`) return "png";
  if (path === `${id}_${sha}.svg`) return "svg";
  return null;
}

// Network hints are used ONLY for abuse throttling, never for authorization.
// Some forwarding headers may be spoofable. The shared global budget below
// remains effective if a client rotates/spoofs IP hints.
export function networkHint(req) {
  const direct = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
  const forwarded = req.headers.get("x-forwarded-for") || "";
  return (direct || forwarded.split(",")[0] || "unknown").trim().slice(0, 128) || "unknown";
}

export async function hashQuotaKey(value) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
