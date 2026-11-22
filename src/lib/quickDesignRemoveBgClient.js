import { supabase } from './supabaseClient.js';

// Browser client has ONLY the Supabase publishable key, never remove.bg secrets.
// The server enforces the preview resolution and atomic monthly cap.
// This sends the image to a third party ONLY after the user explicitly opts in.
const KNOWN_CODES = new Set([
  'LIMIT_REACHED', 'RATE_LIMIT', 'SERVICE_UNAVAILABLE', 'INVALID_PHOTO', 'PHOTO_TOO_LARGE',
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
      return { ok: false, code, message: fallbackMessage(code) };
    }
    if (!(data instanceof Blob) || !data.size || !data.type.startsWith('image/png')) {
      return { ok: false, code: 'SERVICE_UNAVAILABLE', message: fallbackMessage('SERVICE_UNAVAILABLE') };
    }
    return { ok: true, cutoutUrl: URL.createObjectURL(data), code: 'OK' };
  } catch {
    return { ok: false, code: 'SERVICE_UNAVAILABLE', message: fallbackMessage('SERVICE_UNAVAILABLE') };
  }
}

function fallbackMessage(code) {
  switch (code) {
    case 'LIMIT_REACHED': return 'Free automatic background removal has reached its limit. Open remove.bg separately, save a transparent PNG, then upload it here.';
    case 'RATE_LIMIT': return 'Too many automatic cutouts right now. Please use remove.bg separately or continue with the original photo.';
    case 'INVALID_PHOTO': return 'The uploaded photo could not be processed. Please use JPG or WebP.';
    case 'PHOTO_TOO_LARGE': return 'The photo is too large. Please use a file smaller than 10 MB.';
    default: return 'Automatic remove.bg processing is not configured or available. Your original photos are safe. You can open remove.bg separately.';
  }
}
