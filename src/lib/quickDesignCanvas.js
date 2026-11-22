import { GDP_STYLE_TEMPLATES } from './customStudioStyleTemplates.js';

export const QUICK_DESIGN_MAX_PHOTOS = 5;
export const QUICK_DESIGN_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const QUICK_DESIGN_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const QUICK_DESIGN_BACKGROUNDS = GDP_STYLE_TEMPLATES.filter((item) =>
  item.category === 'photo_bootleg' &&
  ['flame-ice', 'flame-neon', 'flame-inferno', 'flame-toxic', 'chrome-galaxy-cosmic-violet', 'chrome-galaxy-emerald-rush', 'cosmic-storm-neon-violet', 'cosmic-storm-toxic-green'].includes(item.id)
);

const PREVIEW_W = 750;
const PREVIEW_H = 1061;

export function validateQuickDesignFile(file) {
  if (!file || !QUICK_DESIGN_MIME_TYPES.has(file.type)) return 'Choose a JPG, PNG or WebP image.';
  if (!file.size || file.size > QUICK_DESIGN_MAX_FILE_BYTES) return 'Each photo must be no larger than 10 MB.';
  return '';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('One of the images could not be opened. Please use JPG, PNG or WebP.'));
    image.src = src;
  });
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawContain(ctx, img, x, y, w, h) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const ratio = Math.min(w / sw, h / sh);
  ctx.drawImage(img, x + (w - sw * ratio) / 2, y + (h - sh * ratio) / 2, sw * ratio, sh * ratio);
}

// Soft-edge studio montage: preserve the source pixels and original GDP template.
// This is a feathered photo composite, not AI subject extraction/background removal.
function drawPhoto(ctx, image, box, color, variant = 'A', index = 0) {
  const x = box[0] * PREVIEW_W;
  const y = box[1] * PREVIEW_H;
  const w = box[2] * PREVIEW_W;
  const h = box[3] * PREVIEW_H;
  const angle = box[4] || 0;
  const layer = document.createElement('canvas');
  layer.width = Math.ceil(w);
  layer.height = Math.ceil(h);
  const layerCtx = layer.getContext('2d', { alpha: true });
  if (!layerCtx) return;
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  // Keep the person's proportions; never stretch or apply a facial filter.
  const ratio = Math.max(layer.width / sw, layer.height / sh);
  layerCtx.drawImage(image, (layer.width - sw * ratio) / 2, (layer.height - sh * ratio) / 2, sw * ratio, sh * ratio);

  // Feather a soft oval at the photo edge to avoid hard rectangular collage cards.
  // A source PNG cutout retains its own alpha; this mask only fades outer pixels.
  const radius = Math.max(layer.width, layer.height) / 2;
  layerCtx.save();
  layerCtx.translate(layer.width / 2, layer.height / 2);
  layerCtx.scale(layer.width / Math.max(layer.width, layer.height), layer.height / Math.max(layer.width, layer.height));
  const mask = layerCtx.createRadialGradient(0, 0, radius * 0.31, 0, 0, radius);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.68, 'rgba(255,255,255,1)');
  mask.addColorStop(0.90, 'rgba(255,255,255,0.48)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  layerCtx.globalCompositeOperation = 'destination-in';
  layerCtx.fillStyle = mask;
  layerCtx.fillRect(-radius, -radius, radius * 2, radius * 2);
  layerCtx.restore();

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  const glow = ctx.createRadialGradient(0, 0, w * 0.12, 0, 0, w * 0.7);
  glow.addColorStop(0, variant === 'B' ? color + '45' : color + '28');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.67, h * 0.64, 0, 0, Math.PI * 2);
  ctx.fill();
  // A faint colored rim follows the softened silhouette, not a rectangular border.
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = variant === 'B' ? 29 : 19;
  ctx.globalAlpha = index === 0 ? 0.98 : 0.94;
  ctx.drawImage(layer, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.restore();
}

function paintTextVeil(ctx, centerY, height) {
  const grad = ctx.createLinearGradient(0, centerY - height / 2, 0, centerY + height / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.68)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, centerY - height / 2, PREVIEW_W, height);
}

// A: centered hero with supporting portraits. B: asymmetric editorial spread.
// Both work with just one source photo and remain distinct for 1–5 uploads.
const LAYOUTS = {
  A: [
    [0.15, 0.245, 0.70, 0.465, -0.012],
    [0.025, 0.56, 0.37, 0.245, -0.115],
    [0.64, 0.55, 0.34, 0.255, 0.105],
    [0.31, 0.65, 0.34, 0.19, 0.045],
    [0.03, 0.675, 0.28, 0.15, -0.12],
  ],
  B: [
    [0.06, 0.24, 0.58, 0.59, -0.115],
    [0.53, 0.265, 0.44, 0.44, 0.105],
    [0.39, 0.48, 0.58, 0.35, -0.04],
    [0.025, 0.54, 0.34, 0.25, 0.08],
    [0.71, 0.65, 0.28, 0.18, 0.14],
  ],
};

export function quickDesignLayoutCount(variant) {
  return LAYOUTS[variant === 'B' ? 'B' : 'A'].length;
}

function paintHeadline(ctx, content, y, maxWidth, initialSize, color) {
  const text = String(content || '').trim().slice(0, 36).toUpperCase();
  if (!text) return;
  let fontSize = initialSize;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  do {
    ctx.font = '900 ' + fontSize + 'px Impact, Arial Black, sans-serif';
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize -= 2;
  } while (fontSize > 28);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#07070b';
  ctx.strokeText(text, PREVIEW_W / 2, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, PREVIEW_W / 2, y);
  ctx.shadowBlur = 0;
}

function drawWatermark(ctx) {
  ctx.save();
  ctx.translate(PREVIEW_W / 2, PREVIEW_H / 2);
  ctx.rotate(-0.48);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 51px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.strokeStyle = 'rgba(0,0,0,0.38)';
  ctx.lineWidth = 3;
  [-250, -85, 85, 250].forEach((y) => {
    ctx.strokeText('GDP CLOTHING  •  SAMPLE', 0, y);
    ctx.fillText('GDP CLOTHING  •  SAMPLE', 0, y);
  });
  ctx.restore();
}

export async function renderQuickDesignArtwork({ photos, backgroundUrl, headline, subline, accent = '#f9c846', variant = 'A' }) {
  if (!Array.isArray(photos) || photos.length === 0) throw new Error('Please upload a photo first.');
  const [background, ...images] = await Promise.all([
    loadImage(backgroundUrl),
    ...photos.slice(0, QUICK_DESIGN_MAX_PHOTOS).map((item) => loadImage(item.url)),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_W;
  canvas.height = PREVIEW_H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Your browser does not support artwork previews.');
  ctx.fillStyle = '#08080c';
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
  // Preserve the full original GDP template: no filters, stretching or cropping.
  drawContain(ctx, background, 0, 0, PREVIEW_W, PREVIEW_H);
  const layout = LAYOUTS[variant === 'B' ? 'B' : 'A'];
  images.forEach((image, index) => drawPhoto(ctx, image, layout[index], accent, variant, index));
  // Two deliberate treatments, leaving the GDP template itself unmodified.
  if (variant === 'B') {
    paintTextVeil(ctx, PREVIEW_H * 0.145, PREVIEW_H * 0.115);
    paintHeadline(ctx, subline, PREVIEW_H * 0.145, PREVIEW_W * 0.82, 43, '#ffffff');
    paintTextVeil(ctx, PREVIEW_H * 0.83, PREVIEW_H * 0.185);
    paintHeadline(ctx, headline, PREVIEW_H * 0.83, PREVIEW_W * 0.92, 109, accent);
  } else {
    paintTextVeil(ctx, PREVIEW_H * 0.165, PREVIEW_H * 0.195);
    paintHeadline(ctx, headline, PREVIEW_H * 0.165, PREVIEW_W * 0.90, 94, accent);
    paintTextVeil(ctx, PREVIEW_H * 0.866, PREVIEW_H * 0.13);
    paintHeadline(ctx, subline, PREVIEW_H * 0.866, PREVIEW_W * 0.84, 47, '#ffffff');
  }
  drawWatermark(ctx);
  return canvas;
}

export function renderQuickDesignMockup(artwork) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 720;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Your browser does not support T-shirt previews.');

  const backdrop = ctx.createRadialGradient(290, 230, 35, 300, 350, 680);
  backdrop.addColorStop(0, '#46464b');
  backdrop.addColorStop(0.5, '#222329');
  backdrop.addColorStop(1, '#0b0b0f');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, 600, 720);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, 600, 1);

  const outline = new Path2D('M188 76 L243 43 Q300 87 357 43 L412 76 Q487 101 554 173 L477 327 L425 301 L421 658 Q302 681 179 658 L175 301 L123 327 L46 173 Q110 102 188 76 Z');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 20;
  const fabric = ctx.createLinearGradient(48, 250, 550, 340);
  fabric.addColorStop(0, '#111114');
  fabric.addColorStop(0.15, '#26262a');
  fabric.addColorStop(0.37, '#09090b');
  fabric.addColorStop(0.62, '#17171b');
  fabric.addColorStop(0.84, '#101014');
  fabric.addColorStop(1, '#303036');
  ctx.fillStyle = fabric;
  ctx.fill(outline);
  ctx.restore();
  ctx.save();
  ctx.clip(outline);

  // Subtle fabric lighting, sleeve fall and hem folds for a better visual mockup.
  const fold = ctx.createLinearGradient(175, 180, 425, 610);
  fold.addColorStop(0, 'rgba(255,255,255,0.045)');
  fold.addColorStop(0.44, 'rgba(255,255,255,0)');
  fold.addColorStop(0.65, 'rgba(0,0,0,0.19)');
  fold.addColorStop(1, 'rgba(255,255,255,0.045)');
  ctx.fillStyle = fold;
  ctx.fillRect(170, 140, 260, 550);
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 4;
  for (const [a, b, c, d] of [
    [175, 309, 211, 438], [425, 302, 387, 450],
    [180, 562, 237, 662], [417, 550, 375, 661],
    [121, 141, 160, 258], [478, 148, 445, 264],
  ]) {
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.quadraticCurveTo((a + c) / 2 + 8, (b + d) / 2, c, d);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(240,240,245,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke(outline);
  // Collar ring and stitching; the neckline does not overlap the artwork.
  ctx.beginPath();
  ctx.ellipse(300, 69, 55, 31, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2c2c32';
  ctx.fill();
  ctx.strokeStyle = '#55545b';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(300, 64, 44, 22, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#111115';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(185, 641);
  ctx.quadraticCurveTo(301, 656, 417, 641);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(126, 309);
  ctx.lineTo(51, 175);
  ctx.moveTo(474, 309);
  ctx.lineTo(548, 175);
  ctx.stroke();

  // Approximate chest A3 placement, not a production placement guarantee.
  drawContain(ctx, artwork, 184, 179, 232, 335);
  ctx.font = '700 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText('BLACK UNISEX TEE • ILLUSTRATIVE MOCKUP', 300, 700);
  return canvas;
}
