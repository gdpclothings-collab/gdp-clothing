import { GDP_STYLE_TEMPLATES } from './customStudioStyleTemplates';

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

function drawPhoto(ctx, image, box, color) {
  const x = box[0] * PREVIEW_W;
  const y = box[1] * PREVIEW_H;
  const w = box[2] * PREVIEW_W;
  const h = box[3] * PREVIEW_H;
  const angle = box[4] || 0;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 5;
  roundedRect(ctx, -w / 2, -h / 2, w, h, 17);
  ctx.fillStyle = '#101010';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.save();
  roundedRect(ctx, -w / 2, -h / 2, w, h, 17);
  ctx.clip();
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  const ratio = Math.max(w / sw, h / sh);
  ctx.drawImage(image, -sw * ratio / 2, -sh * ratio / 2, sw * ratio, sh * ratio);
  ctx.restore();
  ctx.strokeStyle = '#f8f6f1';
  ctx.lineWidth = 7;
  roundedRect(ctx, -w / 2, -h / 2, w, h, 17);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundedRect(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 13);
  ctx.stroke();
  ctx.restore();
}

const LAYOUTS = {
  A: [
    [0.13, 0.24, 0.74, 0.43, -0.015],
    [0.06, 0.47, 0.37, 0.25, -0.10],
    [0.59, 0.48, 0.35, 0.25, 0.09],
    [0.29, 0.60, 0.36, 0.19, 0.03],
    [0.08, 0.66, 0.30, 0.16, -0.07],
  ],
  B: [
    [0.07, 0.31, 0.48, 0.37, -0.08],
    [0.48, 0.27, 0.46, 0.41, 0.075],
    [0.26, 0.51, 0.49, 0.27, -0.025],
    [0.05, 0.62, 0.33, 0.18, -0.06],
    [0.66, 0.63, 0.29, 0.19, 0.09],
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
  images.forEach((image, index) => drawPhoto(ctx, image, layout[index], accent));
  // The editable typography sits above the collage on both layout options.
  ctx.fillStyle = 'rgba(0,0,0,0.68)';
  ctx.fillRect(0, PREVIEW_H * 0.095, PREVIEW_W, PREVIEW_H * 0.13);
  paintHeadline(ctx, headline, PREVIEW_H * 0.164, PREVIEW_W * 0.89, 96, accent);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, PREVIEW_H * 0.835, PREVIEW_W, PREVIEW_H * 0.085);
  paintHeadline(ctx, subline, PREVIEW_H * 0.878, PREVIEW_W * 0.87, 47, '#ffffff');
  drawWatermark(ctx);
  return canvas;
}

export function renderQuickDesignMockup(artwork) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 720;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Your browser does not support T-shirt previews.');
  const gradient = ctx.createLinearGradient(0, 0, 600, 720);
  gradient.addColorStop(0, '#22232a');
  gradient.addColorStop(1, '#08090e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 720);
  ctx.save();
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 28;
  const shirt = new Path2D('M192 75 L242 42 Q300 89 358 42 L408 75 L547 166 L473 315 L417 291 L417 660 Q300 680 183 660 L183 291 L127 315 L53 166 Z');
  ctx.fillStyle = '#101014';
  ctx.fill(shirt);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#34343a';
  ctx.stroke(shirt);
  ctx.beginPath();
  ctx.ellipse(300, 71, 49, 26, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#24242b';
  ctx.fill();
  ctx.restore();
  // Approximate black unisex shirt silhouette; artwork is not a guaranteed print placement.
  drawContain(ctx, artwork, 181, 180, 238, 336);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 17px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ILLUSTRATIVE BLACK T-SHIRT MOCKUP', 300, 700);
  return canvas;
}
