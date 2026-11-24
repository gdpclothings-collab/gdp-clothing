import { supabase } from './supabaseClient.js';

// Browser client has ONLY the Supabase publishable key, never remove.bg secrets.
// The server enforces the preview resolution and atomic monthly cap.
// This sends the image to a third party ONLY after the user explicitly opts in.
const KNOWN_CODES = new Set([
  'LIMIT_REACHED', 'RATE_LIMIT', 'SERVICE_UNAVAILABLE', 'INVALID_PHOTO', 'PHOTO_TOO_LARGE', 'READY', 'NETWORK_ERROR',
]);

export async function requestQuickDesignRemoveBgCutout(file) {
  if (!(file instanceof File) || !file.size) {
    return { ok: false, code: 'INVALID_PHOTO', message: 'Please choose a JPG or WebP photo.' };
  }
  const form = new FormData();
  form.set('image_file', file, file.name || 'image');

  try {
    const { data, error } = await supabase.functions.invoke('gdp-quick-design-remove-bg', {
      body: form,
    });
    if (error) {
      let details = {};
      try { details = await error.context?.json?.() || {}; }
      catch { /* A missing server function may return HTML, not JSON. */ }
      const code = KNOWN_CODES.has(details.code) ? details.code : 'SERVICE_UNAVAILABLE';
      // Server controls this message; never expose provider secrets or raw HTTP errors.
      const info = typeof details.message === 'string' && details.message.length <= 240
        ? details.message : fallbackMessage(code);
      return { ok: false, code, message: info };
    }
    if (!(data instanceof Blob) || !data.size || data.size > 5 * 1024 * 1024) {
      return { ok: false, code: 'SERVICE_UNAVAILABLE', message: fallbackMessage('SERVICE_UNAVAILABLE') };
    }
    // Supabase Functions parses application/octet-stream as a Blob. Validate
    // actual PNG magic bytes before creating a displayable image URL.
    const magic = new Uint8Array(await data.slice(0, 8).arrayBuffer());
    if (![137,80,78,71,13,10,26,10].every((value, index) => magic[index] === value)) {
      return { ok: false, code: 'SERVICE_UNAVAILABLE', message: fallbackMessage('SERVICE_UNAVAILABLE') };
    }
    const png = new Blob([data], { type: 'image/png' });
    return { ok: true, cutoutUrl: URL.createObjectURL(png), code: 'OK' };
  } catch {
    return { ok: false, code: 'NETWORK_ERROR', message: fallbackMessage('NETWORK_ERROR') };
  }
}

/** Read-only, no-photo connection check. Does not spend remove.bg credits. */
export async function checkQuickDesignRemoveBgConnection() {
  try {
    const { data, error } = await supabase.functions.invoke('gdp-quick-design-remove-bg', { method: 'GET' });
    if (error) {
      let details = {};
      try { details = await error.context?.json?.() || {}; } catch { /* Ignore malformed response. */ }
      const code = KNOWN_CODES.has(details.code) ? details.code : 'NETWORK_ERROR';
      return { ready: false, code, message: fallbackMessage(code) };
    }
    if (data?.ready === true && data?.code === 'READY') {
      return { ready: true, code: 'READY', message: 'Connected: automatic removal can use the available free previews.' };
    }
    const code = KNOWN_CODES.has(data?.code) ? data.code : 'SERVICE_UNAVAILABLE';
    const message = typeof data?.message === 'string' && data.message.length <= 240
      ? data.message : fallbackMessage(code);
    return { ready: false, code, message };
  } catch {
    return { ready: false, code: 'NETWORK_ERROR', message: fallbackMessage('NETWORK_ERROR') };
  }
}

function fallbackMessage(code) {
  switch (code) {
    case 'LIMIT_REACHED': return 'Free automatic background removal has reached its limit. Open remove.bg separately, save a transparent PNG, then upload it here.';
    case 'RATE_LIMIT': return 'Too many automatic cutouts right now. Please use remove.bg separately or continue with the original photo.';
    case 'NETWORK_ERROR': return 'Cannot reach the background-removal server from this browser. Check your connection or reopen the latest Quick Design preview.';
    case 'INVALID_PHOTO': return 'The uploaded photo could not be processed. Please use JPG or WebP.';
    case 'PHOTO_TOO_LARGE': return 'The photo is too large. Please use a file smaller than 10 MB.';
    default: return 'Automatic remove.bg processing is not configured or available. Your original photos are safe. You can open remove.bg separately.';
  }
}
