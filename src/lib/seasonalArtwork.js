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

// The approved production master records source-ink inches at 300 PPI.
// DTF production recommends 300 PPI, but allows a carefully bounded 200 PPI minimum.
// The source pixels are never modified or silently represented as 300 native PPI.
export const SEASONAL_SOURCE_DPI = 300;
export const SEASONAL_MIN_PRINT_DPI = 200;

export function fitSeasonalArtwork(artwork, area, requestedWidth, x = 0, y = 0) {
  const ratio = Number(artwork?.aspect_ratio);
  const sourceWidthIn = Number(artwork?.max_width_in);
  const sourceHeightIn = Number(artwork?.max_height_in);
  const areaWidth = Number(area?.width);
  const areaHeight = Number(area?.height);
  if (![ratio, sourceWidthIn, sourceHeightIn, areaWidth, areaHeight].every(n => Number.isFinite(n) && n > 0)) return null;

  const enlargement = SEASONAL_SOURCE_DPI / SEASONAL_MIN_PRINT_DPI;
  const maxWidth = Math.min(areaWidth, sourceWidthIn * enlargement);
  const maxHeight = Math.min(areaHeight, sourceHeightIn * enlargement);
  const limit = Math.min(maxWidth, maxHeight * ratio);
  const requested = Number(requestedWidth);
  const width = Math.max(Math.min(0.5, limit), Math.min(Number.isFinite(requested) && requested > 0 ? requested : limit * .8, limit));
  const height = width / ratio;
  const effectiveDpi = Math.floor(SEASONAL_SOURCE_DPI * Math.min(sourceWidthIn / width, sourceHeightIn / height));
  return {
    width, height,
    x: Math.max(0, Math.min(Number(x) || 0, areaWidth - width)),
    y: Math.max(0, Math.min(Number(y) || 0, areaHeight - height)),
    maxWidth: limit, effectiveDpi,
  };
}

/** Rotation-safe non-uniform Seasonal width/height printing.
 * Preserve original master source and enforce >=200 effective PPI on both axes.
 */
export function constrainSeasonalArtworkLayer(layer, artwork, area) {
  if (!layer || !artwork || !area) return layer;
  const initial = fitSeasonalArtwork(artwork, area, Number(layer.requested || 0), Number(layer.position?.x || 0), Number(layer.position?.y || 0));
  if (!initial) return layer;
  const rotation = clamp(layer.rotation, -180, 180, 0);
  const angle = rotation * Math.PI / 180;
  const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
  const maxHeight = Math.min(Number(area.height), Number(artwork.max_height_in) * SEASONAL_SOURCE_DPI / SEASONAL_MIN_PRINT_DPI) * 0.99999;
  let heightScale = clamp(layer.heightScale, 1, 1000, 100);
  heightScale = Math.min(heightScale, Math.max(1, 100 * maxHeight / Math.max(0.001, initial.height)));
  const stretchedHeight = initial.height * heightScale / 100;
  const rotatedWidth = initial.width * cos + stretchedHeight * sin;
  const rotatedHeight = initial.width * sin + stretchedHeight * cos;
  const reduction = Math.min(1, Number(area.width) / Math.max(0.001, rotatedWidth), Number(area.height) / Math.max(0.001, rotatedHeight));
  const requested = reduction < 1 ? initial.width * reduction * 0.99999 : initial.width;
  const fitted = fitSeasonalArtwork(artwork, area, requested, 0, 0);
  if (!fitted) return layer;
  heightScale = Math.min(heightScale, Math.max(1, maxHeight / Math.max(0.001, fitted.height) * 100));
  const finalHeight = fitted.height * heightScale / 100;
  const boundingWidth = fitted.width * cos + finalHeight * sin;
  const boundingHeight = fitted.width * sin + finalHeight * cos;
  const desiredCenterX = initial.x + initial.width / 2;
  const desiredCenterY = Number(layer.position?.y || 0) + stretchedHeight / 2;
  const centerX = clamp(desiredCenterX, boundingWidth / 2, Math.max(boundingWidth / 2, Number(area.width) - boundingWidth / 2));
  const centerY = clamp(desiredCenterY, boundingHeight / 2, Math.max(boundingHeight / 2, Number(area.height) - boundingHeight / 2));
  return {
    ...layer, requested: fitted.width, heightScale, rotation,
    position: { x: Math.max(0, centerX - fitted.width / 2), y: Math.max(0, centerY - finalHeight / 2) },
  };
}

/** Drawing and the production snapshot use these exact physical dimensions. */
export function resolveSeasonalReshapedLayout(artwork, area, layer) {
  const base = fitSeasonalArtwork(artwork, area, Number(layer?.requested || 0), Number(layer?.position?.x || 0), Number(layer?.position?.y || 0));
  if (!base) return null;
  const height = base.height * clamp(layer?.heightScale, 1, 1000, 100) / 100;
  const effectiveDpi = Math.floor(SEASONAL_SOURCE_DPI * Math.min(
    Number(artwork.max_width_in) / base.width, Number(artwork.max_height_in) / height
  ));
  return { ...base, y: Number(layer?.position?.y ?? base.y), height, effectiveDpi };
}

export function seasonalSelection(artwork, layout, _text, area, rotation = 0) {
  if (!artwork || !layout) throw new Error('Choose an available artwork.');
  const legacyStyle = normalizeSeasonalTextStyle({}, '#111111');
  return {
    version: 3,
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
    // Seasonal Design Lab is artwork-only. Keep empty legacy fields so older
    // production/admin readers remain compatible without accepting customer text.
    name: '',
    message: '',
    text_color: '#111111',
    text_font: 'Arial',
    text_styles: {
      name: legacyStyle,
      message: legacyStyle,
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
