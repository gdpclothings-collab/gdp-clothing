import { GDP_STYLE_TEMPLATES } from './customStudioStyleTemplates.js';
import { paintPremiumTextGlyph, premiumTextPreset } from './customStudioV2PremiumTextStyles.js';
import { getQuickDesignPhaseBLayout, getQuickDesignPhaseBRenderOrder, QUICK_DESIGN_PHASE_B_NAMES } from './quickDesignPhaseBLayout.js';

export { QUICK_DESIGN_PHASE_B_NAMES };

export const QUICK_DESIGN_MAX_PHOTOS = 5;
export const QUICK_DESIGN_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const QUICK_DESIGN_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const QUICK_DESIGN_BACKGROUNDS = GDP_STYLE_TEMPLATES.filter((item) =>
  item.category === 'photo_bootleg' &&
  ['flame-ice', 'flame-neon', 'flame-inferno', 'flame-toxic', 'chrome-galaxy-cosmic-violet', 'chrome-galaxy-emerald-rush', 'cosmic-storm-neon-violet', 'cosmic-storm-toxic-green'].includes(item.id)
);

const PREVIEW_W = 750;
const PREVIEW_H = 1000;
export const QUICK_DESIGN_PRINT_SIZE = Object.freeze({ widthIn: 12, heightIn: 16, targetWidthPx: 3600, targetHeightPx: 4800 });
// Five distinct free OFL-licensed Google Fonts with system fallbacks.
export const QUICK_DESIGN_FONTS = Object.freeze([
  { id: 'impact', label: 'Street Impact', family: 'Anton', css: '"Anton", Impact, sans-serif', weight: '400' },
  { id: 'black', label: 'Retro Block', family: 'Bebas Neue', css: '"Bebas Neue", Impact, sans-serif', weight: '400' },
  { id: 'serif', label: 'Vintage Varsity', family: 'Graduate', css: '"Graduate", Georgia, serif', weight: '400' },
  { id: 'rounded', label: 'Bold Retro', family: 'Bangers', css: '"Bangers", Impact, sans-serif', weight: '400' },
  { id: 'typewriter', label: 'Old School', family: 'Rye', css: '"Rye", Georgia, serif', weight: '400' },
]);

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

// Subject-first Phase B painter. An actual transparent cutout keeps its exact
// alpha silhouette (hair, ears, fur). An opaque photo gets only a soft feather:
// it is never falsely described as a removed background.
function trimmedAlphaBounds(image) {
  const sw = image.naturalWidth || image.width || 1;
  const sh = image.naturalHeight || image.height || 1;
  const preview = document.createElement('canvas');
  preview.width = 160;
  preview.height = 160;
  const sample = preview.getContext('2d', { willReadFrequently: true });
  if (!sample) return null;
  sample.drawImage(image, 0, 0, preview.width, preview.height);
  const pixels = sample.getImageData(0, 0, preview.width, preview.height).data;
  let minX = preview.width, minY = preview.height, maxX = -1, maxY = -1;
  let transparent = 0, visible = 0;
  for (let y = 0; y < preview.height; y += 2) {
    for (let x = 0; x < preview.width; x += 2) {
      const alpha = pixels[(y * preview.width + x) * 4 + 3];
      if (alpha < 24) { transparent += 1; continue; }
      visible += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  // Opaque JPEGs and mostly-solid PNGs must not receive a rectangular
  // silhouette outline. A cutout needs a meaningful visible shape.
  if (transparent < 180 || visible < 16 || maxX < minX || maxY < minY) return null;
  const gutter = 3;
  const x0 = Math.max(0, minX - gutter) / preview.width * sw;
  const y0 = Math.max(0, minY - gutter) / preview.height * sh;
  const x1 = Math.min(preview.width, maxX + gutter + 2) / preview.width * sw;
  const y1 = Math.min(preview.height, maxY + gutter + 2) / preview.height * sh;
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

function paintPhaseBSubject(ctx, image, slot, accent, variant) {
  const x = slot.x * PREVIEW_W;
  const y = slot.y * PREVIEW_H;
  const w = slot.w * PREVIEW_W;
  const h = slot.h * PREVIEW_H;
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.ceil(w));
  layer.height = Math.max(1, Math.ceil(h));
  const layerCtx = layer.getContext('2d', { alpha: true });
  if (!layerCtx) return;
  const sw = image.naturalWidth || image.width || 1;
  const sh = image.naturalHeight || image.height || 1;
  const cutoutBounds = trimmedAlphaBounds(image);
  const crop = cutoutBounds || { x: 0, y: 0, w: sw, h: sh };
  const isCutout = Boolean(cutoutBounds);

  // Never stretch animal or human anatomy. Cutouts are fully contained and
  // trim transparent margins so tiny subjects get a professional hero scale.
  const scale = isCutout
    ? Math.min((layer.width * .985) / crop.w, (layer.height * .985) / crop.h)
    : Math.max(layer.width / crop.w, layer.height / crop.h);
  const actualW = crop.w * scale;
  const actualH = crop.h * scale;
  layerCtx.drawImage(image, crop.x, crop.y, crop.w, crop.h,
    (layer.width - actualW) / 2, (layer.height - actualH) / 2, actualW, actualH);

  if (!isCutout) {
    // A soft blend is an honest fallback, not a pretend photo cutout.
    const radius = Math.max(layer.width, layer.height) * .57;
    layerCtx.save();
    layerCtx.translate(layer.width / 2, layer.height / 2);
    layerCtx.scale(layer.width / Math.max(layer.width, layer.height),
      layer.height / Math.max(layer.width, layer.height));
    const mask = layerCtx.createRadialGradient(0, 0, radius * .40, 0, 0, radius);
    mask.addColorStop(0, 'rgba(255,255,255,1)');
    mask.addColorStop(.61, 'rgba(255,255,255,1)');
    mask.addColorStop(.88, 'rgba(255,255,255,.5)');
    mask.addColorStop(1, 'rgba(255,255,255,0)');
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.fillStyle = mask;
    layerCtx.fillRect(-radius, -radius, radius * 2, radius * 2);
    layerCtx.restore();
  } else {
    // Localized warm highlight contained INSIDE the alpha, not recoloring
    // the GDP backdrop or changing the customer's dog/human features.
    layerCtx.save();
    layerCtx.globalCompositeOperation = 'source-atop';
    const highlight = layerCtx.createLinearGradient(0, 0, layer.width, layer.height);
    highlight.addColorStop(0, 'rgba(255,239,192,.11)');
    highlight.addColorStop(.5, 'rgba(255,255,255,0)');
    highlight.addColorStop(1, 'rgba(0,0,0,.06)');
    layerCtx.fillStyle = highlight;
    layerCtx.fillRect(0, 0, layer.width, layer.height);
    layerCtx.restore();
  }

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(slot.angle);
  const radius = Math.max(w, h) * .62;
  const light = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  light.addColorStop(0, variant === 'B' ? accent + '36' : accent + '25');
  light.addColorStop(.48, accent + '1a');
  light.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = light;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

  if (isCutout) {
    const silhouette = document.createElement('canvas');
    silhouette.width = layer.width;
    silhouette.height = layer.height;
    const sc = silhouette.getContext('2d', { alpha: true });
    if (sc) {
      sc.drawImage(layer, 0, 0);
      sc.globalCompositeOperation = 'source-in';
      sc.fillStyle = '#ffffff';
      sc.fillRect(0, 0, silhouette.width, silhouette.height);
      ctx.save();
      ctx.shadowColor = variant === 'B' ? '#ff28c8' : '#fa59c9';
      ctx.shadowBlur = variant === 'B' ? 28 : 19;
      ctx.globalAlpha = .83;
      ctx.drawImage(silhouette, -w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.save();
      ctx.shadowColor = '#fff7ff';
      ctx.shadowBlur = 6;
      ctx.globalAlpha = .9;
      ctx.drawImage(silhouette, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = variant === 'B' ? 18 : 12;
    ctx.globalAlpha = .63;
    ctx.drawImage(layer, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.drawImage(layer, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function paintPhaseBPortraits(ctx, images, accent, variant) {
  const slots = getQuickDesignPhaseBRenderOrder(variant, images.length);
  slots.forEach((slot) => {
    const image = images[slot.photoIndex];
    if (image) paintPhaseBSubject(ctx, image, slot, accent, variant);
  });
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

// Phase B shares a pure layout spec with regression tests and editorial labels.
export function quickDesignLayoutCount(variant) {
  return getQuickDesignPhaseBLayout(variant, QUICK_DESIGN_MAX_PHOTOS).length;
}

export function quickDesignFont(fontId) {
  return QUICK_DESIGN_FONTS.find((item) => item.id === fontId) || QUICK_DESIGN_FONTS[0];
}

function paintHeadline(ctx, content, y, maxWidth, initialSize, color, {
  fontId = 'impact',
  curve = 'straight',
  fontSizePercent = 100,
  premiumStyle = 'solid',
} = {}) {
  const value = String(content || '').trim().slice(0, 36).toUpperCase();
  if (!value) return;
  const font = quickDesignFont(fontId);
  const safeScale = Math.min(160, Math.max(60, Number(fontSizePercent) || 100)) / 100;
  const fittedWidth = maxWidth * (curve === 'straight' ? 1 : 0.83);
  let fontSize = initialSize * safeScale;
  const trackingRatio = 0.04;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Fit-to-width protects the entire curved or straight name from clipping
  // even if the customer chooses the 160% control on a small canvas.
  for (let attempts = 0; attempts < 160; attempts += 1) {
    ctx.font = font.weight + ' ' + fontSize + 'px ' + font.css;
    const width = ctx.measureText(value).width +
      (curve === 'straight' ? 0 : Math.max(0, [...value].length - 1) * fontSize * trackingRatio);
    if (width <= fittedWidth || fontSize <= 27) break;
    fontSize -= 1.5;
  }

  const premium = premiumStyle !== 'solid' ? premiumTextPreset(premiumStyle) : null;
  const drawText = (content, x, centerY) => {
    if (premium) {
      paintPremiumTextGlyph(ctx, content, x, centerY, fontSize, {
        premiumTextPresetId: premium.id,
        // Name color remains useful as the tint of the featured gradient band.
        premiumAccentColor: color,
        premiumDepthScale: 100,
      });
    } else {
      ctx.lineWidth = Math.max(4, fontSize / 8);
      ctx.strokeStyle = '#07070b';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.strokeText(content, x, centerY);
      ctx.fillText(content, x, centerY);
      ctx.shadowBlur = 0;
    }
  };

  if (curve === 'up' || curve === 'down') {
    const letters = [...value];
    const metrics = letters.map((letter) => ctx.measureText(letter).width);
    const gap = fontSize * trackingRatio;
    const finalWidth = metrics.reduce((sum, width) => sum + width, 0) +
      gap * Math.max(0, letters.length - 1);
    const sign = curve === 'up' ? -1 : 1;
    const arch = Math.min(70, finalWidth * 0.13);
    let x = -finalWidth / 2;
    letters.forEach((letter, index) => {
      const centerX = x + metrics[index] / 2;
      const u = finalWidth ? 2 * centerX / finalWidth : 0;
      const curveY = sign * arch * (1 - u * u);
      const slope = sign * -4 * arch * u / Math.max(1, finalWidth);
      ctx.save();
      ctx.translate(PREVIEW_W / 2 + centerX, y + curveY);
      ctx.rotate(Math.atan(slope));
      drawText(letter, 0, 0);
      ctx.restore();
      x += metrics[index] + gap;
    });
  } else {
    drawText(value, PREVIEW_W / 2, y);
  }
  ctx.restore();
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

export async function renderQuickDesignArtwork({ photos, backgroundUrl, headline, subline, accent = '#f9c846', variant = 'A', fontId = 'impact', curve = 'straight', fontSizePercent = 100, premiumStyle = 'solid' }) {
  if (!Array.isArray(photos) || photos.length === 0) throw new Error('Please upload a photo first.');
  // Font must be ready before canvas measurement/painting, otherwise the preview
  // can show different glyph widths from the customer-facing font selector.
  const chosenFont = quickDesignFont(fontId);
  if (typeof document !== 'undefined' && document.fonts?.load) {
    try { await document.fonts.load(chosenFont.weight + ' 88px "' + chosenFont.family + '"'); }
    catch { /* Offline or blocked CDN: use the system fallback. */ }
  }
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
  // Fill the requested 12 × 16 portrait print ratio, stretching the original GDP artwork down.
  // No crop, recolouring, or independent content edits; resizing may alter aspect ratio.
  ctx.drawImage(background, 0, 0, PREVIEW_W, PREVIEW_H);
  paintPhaseBPortraits(ctx, images, accent, variant);
  // The customer name is at the TOP in both layouts; subtitle is optional.
  if (variant === 'B') {
    paintTextVeil(ctx, PREVIEW_H * 0.14, PREVIEW_H * 0.19);
    paintHeadline(ctx, headline, PREVIEW_H * 0.145, PREVIEW_W * 0.89, 100, accent, { fontId, curve, fontSizePercent, premiumStyle });
    if (subline?.trim()) {
      paintTextVeil(ctx, PREVIEW_H * 0.86, PREVIEW_H * 0.14);
      paintHeadline(ctx, subline, PREVIEW_H * 0.86, PREVIEW_W * 0.85, 46, '#ffffff', { fontId: 'black' });
    }
  } else {
    paintTextVeil(ctx, PREVIEW_H * 0.155, PREVIEW_H * 0.22);
    paintHeadline(ctx, headline, PREVIEW_H * 0.165, PREVIEW_W * 0.89, 96, accent, { fontId, curve, fontSizePercent, premiumStyle });
    if (subline?.trim()) {
      paintTextVeil(ctx, PREVIEW_H * 0.88, PREVIEW_H * 0.12);
      paintHeadline(ctx, subline, PREVIEW_H * 0.88, PREVIEW_W * 0.84, 46, '#ffffff', { fontId: 'black' });
    }
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
  drawContain(ctx, artwork, 184, 179, 232, 310);
  ctx.font = '700 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText('BLACK UNISEX TEE • ILLUSTRATIVE MOCKUP', 300, 700);
  return canvas;
}
