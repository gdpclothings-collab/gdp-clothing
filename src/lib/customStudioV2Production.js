import { supabase } from '@/lib/supabaseClient';
import { fitSeasonalArtwork } from '@/lib/seasonalArtwork';
import { renderSeasonalProductionPng } from '@/lib/seasonalProductionRender';

function normalizeToken(value) {
  return String(value || '').toLowerCase().replace(/grey/g, 'gray').replace(/[^a-z0-9]+/g, ' ').trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function pick(map, key, fallback) {
  return map[key] || fallback;
}

export function resolveStudioV2PrintProfile(product, size, side = 'front') {
  const key = normalizeToken([product?.name, product?.type].filter(Boolean).join(' '));
  const normalizedSize = String(size || '').toUpperCase().replace(/\s+/g, '');
  let front;

  if (key.includes('baby') || key.includes('bodysuit') || key.includes('onesie')) {
    front = pick({
      '0-3M': { widthIn: 4.5, heightIn: 5.5 },
      '3-6M': { widthIn: 5, heightIn: 6 },
      '6-12M': { widthIn: 5.5, heightIn: 6.5 },
      '12-18M': { widthIn: 6, heightIn: 7 },
    }, normalizedSize, { widthIn: 5.5, heightIn: 6.5 });
  } else if (key.includes('toddler')) {
    front = pick({
      '2T': { widthIn: 6, heightIn: 7 },
      '3T': { widthIn: 6.5, heightIn: 7.5 },
      '4T': { widthIn: 7, heightIn: 8 },
      '5T': { widthIn: 7.5, heightIn: 8.5 },
    }, normalizedSize, { widthIn: 7, heightIn: 8 });
  } else if (key.includes('youth') || key.includes('kids')) {
    front = pick({
      XS: { widthIn: 7.5, heightIn: 9.5 },
      S: { widthIn: 8.5, heightIn: 10.5 },
      M: { widthIn: 9, heightIn: 11 },
      L: { widthIn: 9.5, heightIn: 11.5 },
      XL: { widthIn: 10, heightIn: 12 },
    }, normalizedSize, { widthIn: 9, heightIn: 11 });
  } else if (key.includes('hoodie')) {
    front = pick({
      S: { widthIn: 10, heightIn: 11.5 },
      M: { widthIn: 10.5, heightIn: 12 },
      L: { widthIn: 11, heightIn: 12.5 },
      XL: { widthIn: 11.5, heightIn: 13 },
      '2XL': { widthIn: 11.5, heightIn: 13 },
      '3XL': { widthIn: 11.5, heightIn: 13 },
      '4XL': { widthIn: 11.5, heightIn: 13 },
      '5XL': { widthIn: 11.5, heightIn: 13 },
    }, normalizedSize, { widthIn: 11, heightIn: 12.5 });
  } else if (key.includes('sweatshirt') || key.includes('sweater') || key.includes('crewneck') || (key.includes('crew neck') && !key.includes('t shirt'))) {
    front = pick({
      S: { widthIn: 10.5, heightIn: 13 },
      M: { widthIn: 11, heightIn: 13.5 },
      L: { widthIn: 11.5, heightIn: 14 },
      XL: { widthIn: 12, heightIn: 15 },
    }, normalizedSize, { widthIn: 11.5, heightIn: 14 });
  } else {
    front = pick({
      S: { widthIn: 10.5, heightIn: 13.5 },
      M: { widthIn: 11, heightIn: 14 },
      L: { widthIn: 11.5, heightIn: 14.5 },
      XL: { widthIn: 12, heightIn: 15 },
      '2XL': { widthIn: 12, heightIn: 15 },
      '3XL': { widthIn: 12, heightIn: 15 },
      '4XL': { widthIn: 12, heightIn: 15 },
      '5XL': { widthIn: 12, heightIn: 15 },
    }, normalizedSize, { widthIn: 11, heightIn: 14 });
  }

  if (side !== 'back') return { ...front, side: 'front', dpi: 300 };

  let back;
  if (key.includes('baby') || key.includes('bodysuit') || key.includes('onesie')) {
    back = pick({
      '0-3M': { widthIn: 3.5, heightIn: 4.5 },
      '3-6M': { widthIn: 4, heightIn: 5 },
      '6-12M': { widthIn: 4.5, heightIn: 5.5 },
      '12-18M': { widthIn: 5, heightIn: 6 },
    }, normalizedSize, { widthIn: 4, heightIn: 5 });
  } else if (key.includes('toddler')) {
    back = pick({
      '2T': { widthIn: 5.5, heightIn: 7 },
      '3T': { widthIn: 6, heightIn: 7.5 },
      '4T': { widthIn: 6, heightIn: 8 },
      '5T': { widthIn: 6.5, heightIn: 8.5 },
    }, normalizedSize, { widthIn: 6, heightIn: 8 });
  } else if (key.includes('youth') || key.includes('kids')) {
    back = pick({
      XS: { widthIn: 7.5, heightIn: 9 },
      S: { widthIn: 8, heightIn: 10 },
      M: { widthIn: 8.5, heightIn: 10.5 },
      L: { widthIn: 9, heightIn: 11 },
      XL: { widthIn: 9.5, heightIn: 11.5 },
    }, normalizedSize, { widthIn: 8.5, heightIn: 10.5 });
  } else if (key.includes('hoodie')) {
    back = pick({
      S: { widthIn: 10, heightIn: 11 },
      M: { widthIn: 10.5, heightIn: 11.5 },
      L: { widthIn: 11, heightIn: 12 },
      XL: { widthIn: 11.5, heightIn: 12.5 },
      '2XL': { widthIn: 11.5, heightIn: 12.5 },
      '3XL': { widthIn: 12, heightIn: 13 },
      '4XL': { widthIn: 12, heightIn: 13 },
      '5XL': { widthIn: 12, heightIn: 13 },
    }, normalizedSize, { widthIn: 11, heightIn: 12 });
  } else if (key.includes('sweatshirt') || key.includes('sweater') || key.includes('crewneck') || (key.includes('crew neck') && !key.includes('t shirt'))) {
    back = pick({
      S: { widthIn: 10, heightIn: 12 },
      M: { widthIn: 10.5, heightIn: 12.5 },
      L: { widthIn: 11, heightIn: 13 },
      XL: { widthIn: 11.5, heightIn: 14 },
      '2XL': { widthIn: 12, heightIn: 14.5 },
      '3XL': { widthIn: 12, heightIn: 14.5 },
    }, normalizedSize, { widthIn: 11, heightIn: 13 });
  } else {
    back = pick({
      XS: { widthIn: 10, heightIn: 12.5 },
      S: { widthIn: 10.5, heightIn: 13 },
      M: { widthIn: 11, heightIn: 14 },
      L: { widthIn: 11.5, heightIn: 14.5 },
      XL: { widthIn: 12, heightIn: 15 },
      '2XL': { widthIn: 12, heightIn: 15 },
      '3XL': { widthIn: 12, heightIn: 15 },
      '4XL': { widthIn: 12, heightIn: 15 },
      '5XL': { widthIn: 12, heightIn: 15 },
    }, normalizedSize, { widthIn: 11, heightIn: 14 });
  }
  return { ...back, side: 'back', dpi: 300 };
}

async function loadImage(source, message = 'A production asset could not be reopened.') {
  const url = String(source || '').trim();
  if (!url) throw new Error(message);
  const response = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  if (!response.ok) throw new Error(message);
  const blob = await response.blob();
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
  }
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = 'async';
  image.src = objectUrl;
  await new Promise((resolve, reject) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', () => reject(new Error(message)), { once: true });
  });
  return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(objectUrl) };
}

function canvasPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the 300 DPI production PNG.')), 'image/png');
  });
}

function createProductionCanvas(profile, dpi = 300) {
  const safeDpi = Math.max(72, Math.min(600, Math.round(Number(dpi) || 300)));
  const widthPx = Math.max(1, Math.round(Number(profile.widthIn) * safeDpi));
  const heightPx = Math.max(1, Math.round(Number(profile.heightIn) * safeDpi));
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('This browser cannot build the production file.');
  context.clearRect(0, 0, widthPx, heightPx);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return { canvas, context, widthPx, heightPx, safeDpi };
}

function clipZone(context, zone, widthPx, heightPx) {
  const x = Number(zone.x || 0) / 100 * widthPx;
  const y = Number(zone.y || 0) / 100 * heightPx;
  const width = Number(zone.width || 100) / 100 * widthPx;
  const height = Number(zone.height || 100) / 100 * heightPx;
  context.beginPath();
  if (zone.shape === 'circle' || zone.shape === 'oval') {
    context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (typeof context.roundRect === 'function' && zone.shape === 'rounded') {
    context.roundRect(x, y, width, height, Math.min(width, height) * clamp(zone.radius || 0, 0, 50) / 100);
  } else {
    context.rect(x, y, width, height);
  }
  context.clip();
  return { x, y, width, height };
}

function drawCoverImage(context, loaded, rect, transform = {}) {
  const baseScale = Math.max(rect.width / Math.max(1, loaded.width), rect.height / Math.max(1, loaded.height));
  const userScale = clamp(transform.scale || 100, 55, 180) / 100;
  const drawWidth = loaded.width * baseScale * userScale;
  const drawHeight = loaded.height * baseScale * userScale;
  const centerX = rect.x + rect.width / 2 + clamp(transform.x || 0, -42, 42) / 100 * rect.width;
  const centerY = rect.y + rect.height / 2 + clamp(transform.y || 0, -42, 42) / 100 * rect.height;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(clamp(transform.rotation || 0, -180, 180) * Math.PI / 180);
  context.drawImage(loaded.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

function fitTextSize(context, text, maxWidth, startSize, minSize) {
  let size = startSize;
  while (size > minSize) {
    context.font = `900 ${size}px Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawProtectedText(context, text = {}, zone = {}, widthPx, heightPx) {
  const x = Number(zone.x || 10) / 100 * widthPx;
  const y = Number(zone.y || 78) / 100 * heightPx;
  const width = Number(zone.width || 80) / 100 * widthPx;
  const height = Number(zone.height || 18) / 100 * heightPx;
  const headline = String(text.headline || '').trim();
  const subline = String(text.subline || '').trim();
  const message = String(text.message || '').trim();
  if (!headline && !subline && !message) return;

  context.save();
  context.textAlign = zone.align === 'left' ? 'left' : zone.align === 'right' ? 'right' : 'center';
  context.textBaseline = 'middle';
  context.fillStyle = zone.tone === 'dark' ? '#201f1d' : '#ffffff';
  context.shadowColor = 'rgba(0,0,0,.85)';
  context.shadowBlur = Math.max(2, widthPx * 0.004);
  context.shadowOffsetY = Math.max(1, heightPx * 0.002);
  const anchorX = zone.align === 'left' ? x : zone.align === 'right' ? x + width : x + width / 2;
  let cursorY = y + height * 0.28;

  if (headline) {
    const size = fitTextSize(context, headline.toUpperCase(), width * 0.95, Math.round(height * 0.24), Math.round(height * 0.09));
    context.font = `900 ${size}px Arial, sans-serif`;
    context.fillText(headline.toUpperCase(), anchorX, cursorY, width * 0.95);
    cursorY += size * 1.2;
  }
  if (subline) {
    const size = fitTextSize(context, subline, width * 0.95, Math.round(height * 0.15), Math.round(height * 0.07));
    context.font = `700 ${size}px Arial, sans-serif`;
    context.fillText(subline, anchorX, cursorY, width * 0.95);
    cursorY += size * 1.25;
  }
  if (message) {
    const size = fitTextSize(context, message, width * 0.92, Math.round(height * 0.11), Math.round(height * 0.055));
    context.font = `600 ${size}px Arial, sans-serif`;
    context.fillText(message, anchorX, Math.min(y + height * 0.86, cursorY), width * 0.92);
  }
  context.restore();
}

export async function renderProtectedStudioV2Png({ product, size, side, editor, template, dpi = 300 }) {
  if (!editor?.photo?.url || !editor?.photo?.path) throw new Error('The customer photo is unavailable.');
  if (!template?.assetUrl) throw new Error('The locked GDP template is unavailable.');
  const profile = resolveStudioV2PrintProfile(product, size, side);
  const output = createProductionCanvas(profile, dpi);
  const photo = await loadImage(editor.photo.url, 'The customer photo could not be reopened.');
  const artwork = await loadImage(template.assetUrl, 'The locked GDP template could not be reopened.');
  try {
    output.context.save();
    const rect = clipZone(output.context, template.photoZone || {}, output.widthPx, output.heightPx);
    drawCoverImage(output.context, photo, rect, editor.transform || {});
    output.context.restore();
    output.context.drawImage(artwork.image, 0, 0, output.widthPx, output.heightPx);
    drawProtectedText(output.context, editor.text || {}, template.textZone || {}, output.widthPx, output.heightPx);
  } finally {
    photo.close();
    artwork.close();
  }
  return {
    blob: await canvasPng(output.canvas),
    widthPx: output.widthPx,
    heightPx: output.heightPx,
    widthIn: profile.widthIn,
    heightIn: profile.heightIn,
    dpi: output.safeDpi,
    mimeType: 'image/png',
    profile,
  };
}

export async function renderUploadStudioV2Png({ product, size, side, editor, dpi = 300 }) {
  if (!editor?.artwork?.url || !editor?.artwork?.path) throw new Error('The uploaded artwork is unavailable.');
  const profile = resolveStudioV2PrintProfile(product, size, side);
  const output = createProductionCanvas(profile, dpi);
  const loaded = await loadImage(editor.artwork.url, 'The uploaded artwork could not be reopened.');
  try {
    const boxWidth = output.widthPx * 0.72;
    const boxHeight = output.heightPx * 0.72;
    const containScale = Math.min(boxWidth / Math.max(1, loaded.width), boxHeight / Math.max(1, loaded.height));
    const userScale = clamp(editor.transform?.scale || 100, 30, 180) / 100;
    const drawWidth = loaded.width * containScale * userScale;
    const drawHeight = loaded.height * containScale * userScale;
    const centerX = output.widthPx / 2 + clamp(editor.transform?.x || 0, -42, 42) / 100 * boxWidth;
    const centerY = output.heightPx / 2 + clamp(editor.transform?.y || 0, -42, 42) / 100 * boxHeight;
    output.context.save();
    output.context.translate(centerX, centerY);
    output.context.rotate(clamp(editor.transform?.rotation || 0, -180, 180) * Math.PI / 180);
    output.context.drawImage(loaded.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    output.context.restore();
  } finally {
    loaded.close();
  }
  return {
    blob: await canvasPng(output.canvas),
    widthPx: output.widthPx,
    heightPx: output.heightPx,
    widthIn: profile.widthIn,
    heightIn: profile.heightIn,
    dpi: output.safeDpi,
    mimeType: 'image/png',
    profile,
  };
}

export async function buildSeasonalStudioV2Snapshot({ productId, size, color, layers }) {
  const { data, error } = await supabase.rpc('list_seasonal_artworks', { p_product: productId, p_size: size });
  if (error) throw error;
  const area = data?.area;
  if (!area?.width || !area?.height) throw new Error('The Seasonal print area is unavailable.');
  const artworkById = new Map((data?.artworks || []).map((artwork) => [String(artwork.id), artwork]));
  const printableLayers = (layers || []).filter((layer) => layer.visible !== false).map((layer, order) => {
    const artwork = artworkById.get(String(layer.artworkId));
    if (!artwork?.preview) throw new Error(`Seasonal artwork ${layer.artworkTitle || layer.artworkId} is unavailable.`);
    const fitted = fitSeasonalArtwork(artwork, area, Number(layer.requested || 0), Number(layer.position?.x || 0), Number(layer.position?.y || 0));
    if (!fitted) throw new Error('A Seasonal artwork layer has invalid geometry.');
    return {
      layerId: layer.id,
      artworkId: artwork.id,
      artworkTitle: artwork.title,
      x: fitted.x,
      y: fitted.y,
      width: fitted.width,
      height: fitted.height,
      rotation: Number(layer.rotation || 0),
      order,
      area_width: Number(area.width),
      area_height: Number(area.height),
      previewUrl: artwork.preview,
    };
  });
  if (!printableLayers.length) throw new Error('The Seasonal design has no visible printable layers.');
  return {
    version: 6,
    designPath: 'seasonal',
    garment: { productId, size, color },
    printArea: { width: Number(area.width), height: Number(area.height), dpi: 300 },
    layers: printableLayers,
  };
}

export async function renderSeasonalStudioV2Png(snapshot, dpi = 300) {
  return renderSeasonalProductionPng(snapshot, [], dpi);
}

export async function digestStudioV2Snapshot(snapshot) {
  const stable = JSON.stringify(snapshot, (key, value) => key === 'previewUrl' ? undefined : value);
  if (!globalThis.crypto?.subtle) return `v2-${stable.length}-${stable.split('').reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0).toString(16)}`;
  const bytes = new TextEncoder().encode(stable);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
