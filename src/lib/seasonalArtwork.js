export const SEASONAL_BUCKET = 'artwork-production';

export const SEASONAL_TEXT_FONTS = ['Arial', 'Trebuchet MS', 'Georgia', 'Impact', 'Courier New'];

const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

const cleanHex = (value, fallback = '#111111') => {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) return `#${raw.slice(1).split('').map((char) => char + char).join('')}`.toLowerCase();
  return fallback;
};

export function normalizeSeasonalTextStyle(style = {}, fallbackColor = '#111111') {
  return {
    fontFamily: SEASONAL_TEXT_FONTS.includes(style.fontFamily) ? style.fontFamily : 'Arial',
    scale: clamp(style.scale, 65, 150, 100),
    weight: [400, 600, 700, 900].includes(Number(style.weight)) ? Number(style.weight) : 700,
    italic: Boolean(style.italic),
    align: ['left', 'center', 'right'].includes(style.align) ? style.align : 'center',
    letterSpacing: clamp(style.letterSpacing, -1, 6, 0),
    curve: clamp(style.curve, -40, 40, 0),
    outlineWidth: clamp(style.outlineWidth, 0, 4, 0),
    outlineColor: cleanHex(style.outlineColor, '#ffffff'),
    shadow: Boolean(style.shadow),
    uppercase: Boolean(style.uppercase),
    color: cleanHex(style.color, cleanHex(fallbackColor, '#111111')),
  };
}

export function fitSeasonalArtwork(artwork, area, requestedWidth, x = 0, y = 0) {
  const ratio = Number(artwork?.aspect_ratio);
  const maxWidth = Math.min(Number(area?.width), Number(artwork?.max_width_in));
  const maxHeight = Math.min(Number(area?.height), Number(artwork?.max_height_in));
  if (![ratio, maxWidth, maxHeight].every(n => Number.isFinite(n) && n > 0)) return null;
  const limit = Math.min(maxWidth, maxHeight * ratio);
  const width = Math.max(Math.min(0.5, limit), Math.min(Number(requestedWidth) || limit * .8, limit));
  const height = width / ratio;
  return { width, height, x: Math.max(0, Math.min(Number(x) || 0, area.width - width)), y: Math.max(0, Math.min(Number(y) || 0, area.height - height)), maxWidth: limit };
}

export function seasonalSelection(artwork, layout, text, area, rotation = 0) {
  if (!artwork || !layout) throw new Error('Choose an available artwork.');
  const legacyColor = cleanHex(text?.color, '#111111');
  const nameStyle = normalizeSeasonalTextStyle(text?.nameStyle, legacyColor);
  const messageStyle = normalizeSeasonalTextStyle(text?.messageStyle, legacyColor);
  return {
    version: 2,
    artwork_id: artwork.id,
    source_sha256: artwork.source_sha256,
    placement: 'front',
    width: layout.width,
    height: layout.height,
    x: layout.x,
    y: layout.y,
    rotation: Math.max(-180, Math.min(180, Number(rotation) || 0)),
    area_width: area.width,
    area_height: area.height,
    name: artwork.customizable ? String(text?.name || '').trim().slice(0, 32) : '',
    message: artwork.customizable ? String(text?.message || '').trim().slice(0, 60) : '',
    // Keep the legacy fields for existing production/admin readers.
    text_color: legacyColor === '#ffffff' ? '#ffffff' : '#111111',
    text_font: nameStyle.fontFamily,
    text_styles: {
      name: nameStyle,
      message: messageStyle,
    },
  };
}

// Derive an ink-only preview while preserving the uploaded production file.
export async function inspectSeasonalPng(file) {
  if (file.size > 100 * 1024 * 1024) throw new Error('Choose a PNG smaller than 100 MB.');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (![137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) throw new Error('Upload a transparent PNG production file.');
  const view = new DataView(buffer);
  const w = view.getUint32(16), h = view.getUint32(20);
  if (!w || !h || w * h > 65000000) throw new Error('PNG dimensions exceed the 65 megapixel limit.');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
  const pixels = ctx.getImageData(0, 0, w, h).data;
  let left = w, top = h, right = 0, bottom = 0, transparent = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const alpha = pixels[(y * w + x) * 4 + 3];
    if (alpha < 255) transparent = true;
    if (alpha > 0) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); }
  }
  if (!transparent || right <= left || bottom <= top) throw new Error('Use artwork with a transparent background and visible content.');
  const iw = right - left, ih = bottom - top;
  const thumb = document.createElement('canvas'); const scale = Math.min(1, 720 / Math.max(iw, ih));
  thumb.width = Math.max(1, Math.round(iw * scale)); thumb.height = Math.max(1, Math.round(ih * scale));
  thumb.getContext('2d').drawImage(canvas, left, top, iw, ih, 0, 0, thumb.width, thumb.height);
  const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(v => v.toString(16).padStart(2, '0')).join('');
  return { preview: thumb.toDataURL('image/webp', .9), sha, aspect_ratio: iw / ih,
    max_width_in: iw / 300, max_height_in: ih / 300, ink_bbox_px: [left, top, right, bottom], canvas_px: [w, h] };
}
