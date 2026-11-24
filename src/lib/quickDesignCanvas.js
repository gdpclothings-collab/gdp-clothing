import { GDP_STYLE_TEMPLATES } from './customStudioStyleTemplates.js';
import { paintPremiumTextGlyph, premiumTextPreset } from './customStudioV2PremiumTextStyles.js';
import { getQuickDesignPhaseCLayout, getQuickDesignPhaseCRenderOrder } from './quickDesignPhaseCLayout.js';

export const QUICK_DESIGN_MAX_PHOTOS = 5;
export const QUICK_DESIGN_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const QUICK_DESIGN_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const QUICK_DESIGN_BACKGROUNDS = GDP_STYLE_TEMPLATES.filter((item) =>
  item.category === 'photo_bootleg' &&
  ['flame-ice', 'flame-neon', 'flame-heatwave', 'flame-inferno', 'flame-toxic', 'chrome-galaxy-cosmic-violet', 'chrome-galaxy-emerald-rush', 'cosmic-storm-neon-violet', 'cosmic-storm-toxic-green', 'cosmic-storm-firestorm', 'cosmic-storm-ice-storm', 'cosmic-storm-solar-gold'].includes(item.id)
);

// A3 portrait at 300 pixels per inch. Preview shares its aspect ratio.
const PREVIEW_W = 750;
const PREVIEW_H = 1061;
export const QUICK_DESIGN_PRINT_SIZE = Object.freeze({
  widthMm: 297, heightMm: 420,
  widthIn: 297 / 25.4, heightIn: 420 / 25.4,
  targetWidthPx: 3508, targetHeightPx: 4961,
  previewWidthPx: PREVIEW_W, previewHeightPx: PREVIEW_H,
});

/**
 * Place the customized name directly ABOVE the upper photo, not floating
 * in the old large empty area. Use the actual 1–5 image hero layout so that
 * changing the number of photos preserves a visually connected composition.
 * A curved headline's last letter strokes can sit close to the subject glow.
 */
// Physical A3 target: 12.7 mm (0.5 in) between the VISIBLE bottom of the
// name and the top of the photo cutout. 420 mm / 1061 preview pixels.
export const QUICK_DESIGN_NAME_PHOTO_GAP_IN = 0.5;
export const QUICK_DESIGN_NAME_PHOTO_GAP_PX = Math.round(PREVIEW_H * 12.7 / 420);

export function getQuickDesignHeadlineY(photoCount = 1, metrics = null) {
  const hero = getQuickDesignPhaseCLayout(photoCount)[0];
  const baseY = Math.round(PREVIEW_H * (hero.y - .047));
  const top = metrics?.photoTop;
  const bottom = metrics?.nameBottom;
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return baseY;
  // Measure the REAL curved/straight glyph edge, not an assumed baseline:
  // letter contours and font size can change considerably with each choice.
  const adjustedY = baseY + top - QUICK_DESIGN_NAME_PHOTO_GAP_PX - bottom;
  return Math.round(Math.max(90, Math.min(PREVIEW_H * .54, adjustedY)));
}
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

/**
 * Fit a complete source photograph into its allotted subject slot without
 * cropping. For true transparent cutouts, first trim empty alpha padding.
 * This prevents clipped faces from cover-style scaling on tall/wide photos.
 * Face recognition is not implied: review is still necessary.
 */
export function getQuickDesignSubjectFit(sourceWidth, sourceHeight, targetWidth, targetHeight, bounds = null) {
  const sourceW = Math.max(1, Number(sourceWidth) || 1);
  const sourceH = Math.max(1, Number(sourceHeight) || 1);
  const width = Math.max(1, Number(targetWidth) || 1);
  const height = Math.max(1, Number(targetHeight) || 1);
  const crop = bounds || { x: 0, y: 0, w: sourceW, h: sourceH };
  const scale = Math.min(width * .98 / Math.max(1, crop.w), height * .98 / Math.max(1, crop.h));
  const imageW = crop.w * scale;
  const imageH = crop.h * scale;
  return { crop, imageW, imageH, x: (width - imageW) / 2, y: (height - imageH) / 2 };
}

// Subject-first Phase E painter. Both opaque photos and transparent cutouts
// preserve their complete visible anatomy; only empty alpha margins are trimmed.

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
  // High-resolution A3 output must rasterize the original photo directly at
  // export resolution, not upscale a tiny intermediate 750px preview layer.
  const detailScale = Math.max(1, ctx.getTransform().a);
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.ceil(w * detailScale));
  layer.height = Math.max(1, Math.ceil(h * detailScale));
  const layerCtx = layer.getContext('2d', { alpha: true });
  if (!layerCtx) return;
  layerCtx.scale(detailScale, detailScale);
  const sw = image.naturalWidth || image.width || 1;
  const sh = image.naturalHeight || image.height || 1;
  const cutoutBounds = trimmedAlphaBounds(image);
  const crop = cutoutBounds || { x: 0, y: 0, w: sw, h: sh };
  const isCutout = Boolean(cutoutBounds);

  // Preserve FULL face/subject framing even for opaque portrait images.
  // Never use cover/crop for pet or human source photos.
  const fitted = getQuickDesignSubjectFit(sw, sh, w, h, crop);
  layerCtx.drawImage(image, fitted.crop.x, fitted.crop.y, fitted.crop.w, fitted.crop.h,
    fitted.x, fitted.y, fitted.imageW, fitted.imageH);

  if (!isCutout) {
    // A soft blend is an honest fallback, not a pretend photo cutout.
    const radius = Math.max(w, h) * .57;
    layerCtx.save();
    layerCtx.translate(w / 2, h / 2);
    layerCtx.scale(w / Math.max(w, h),
      h / Math.max(w, h));
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
    const highlight = layerCtx.createLinearGradient(0, 0, w, h);
    highlight.addColorStop(0, 'rgba(255,239,192,.11)');
    highlight.addColorStop(.5, 'rgba(255,255,255,0)');
    highlight.addColorStop(1, 'rgba(0,0,0,.06)');
    layerCtx.fillStyle = highlight;
    layerCtx.fillRect(0, 0, w, h);
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
    // HENRY-style keyline: create solid-colored silhouettes from actual alpha,
    // then spread them only a few pixels around the dog's/person's shape.
    // This is not a rectangular photo border and never changes GDP background.
    const stencil = (color) => {
      const silhouette = document.createElement('canvas');
      silhouette.width = layer.width;
      silhouette.height = layer.height;
      const sc = silhouette.getContext('2d', { alpha: true });
      if (!sc) return null;
      sc.drawImage(layer, 0, 0);
      sc.globalCompositeOperation = 'source-in';
      sc.fillStyle = color;
      sc.fillRect(0, 0, silhouette.width, silhouette.height);
      return silhouette;
    };
    const pink = stencil(variant === 'B' ? '#ff209e' : '#ed3fae');
    const white = stencil('#fff9ff');
    if (pink && white) {
      ctx.save();
      ctx.shadowColor = '#ff2ea8';
      ctx.shadowBlur = variant === 'B' ? 22 : 15;
      ctx.globalAlpha = .92;
      for (let step = 0; step < 8; step += 1) {
        const theta = Math.PI * step / 4;
        const radius = variant === 'B' ? 6.4 : 5.1;
        ctx.drawImage(pink, -w / 2 + Math.cos(theta) * radius,
          -h / 2 + Math.sin(theta) * radius, w, h);
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = .96;
      for (let step = 0; step < 8; step += 1) {
        const theta = Math.PI * step / 4;
        const radius = 2.5;
        ctx.drawImage(white, -w / 2 + Math.cos(theta) * radius,
          -h / 2 + Math.sin(theta) * radius, w, h);
      }
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

/**
 * Apply print-aware alpha cleanup exclusively to the selected storm BACKGROUND
 * layer. The source GDP art remains unchanged; pets, lettering, lightning and
 * subsequent photo/keyline layers are never processed.
 *
 * Wide rectangular fades create low-alpha "clouds" that a DTF RIP may place
 * white underbase beneath. A curved top shoulder and alpha floor prevent
 * unwanted boxy edges while preserving the brighter intended storm effects.
 *
 * This does NOT certify RIP white-underbase behavior or print-ready pixels.
 */
export function getQuickDesignDTFStormAlpha(alpha, normalizedX, normalizedY) {
  const a = Math.max(0, Math.min(255, Number(alpha) || 0));
  if (!a) return 0;
  const x = Math.max(0, Math.min(1, Number(normalizedX) || 0));
  const y = Math.max(0, Math.min(1, Number(normalizedY) || 0));
  const smoothstep = (lo, hi, value) => {
    const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  };
  const shoulder = Math.pow(Math.max(0, (0.30 - Math.min(x, 1 - x)) / 0.30), 2);
  const topStart = 0.39 + shoulder * 0.09;
  const topEnd = 0.60 + shoulder * 0.05;
  const topMask = smoothstep(topStart, topEnd, y);
  const sideMask = smoothstep(0.012, 0.13, x) *
    (1 - smoothstep(0.87, 0.988, x));
  const retained = a * topMask * sideMask;
  if (retained <= 22) return 0;
  if (retained < 78) return Math.round(78 * smoothstep(22, 78, retained));
  return Math.round(retained);
}

function cleanQuickDesignDTFStormLayer(bg, width, height) {
  // Small row strips avoid a single 70MB+ getImageData allocation during A3.
  // Pixel-coordinate masks have the SAME proportions on preview and A3.
  const stripHeight = 128;
  for (let y0 = 0; y0 < height; y0 += stripHeight) {
    const rows = Math.min(stripHeight, height - y0);
    const strip = bg.getImageData(0, y0, width, rows);
    const rgba = strip.data;
    for (let row = 0; row < rows; row++) {
      const ny = (y0 + row + 0.5) / height;
      for (let col = 0; col < width; col++) {
        const i = (row * width + col) * 4 + 3;
        const alpha = rgba[i];
        if (!alpha) continue;
        rgba[i] = getQuickDesignDTFStormAlpha(alpha, (col + .5) / width, ny);
      }
    }
    bg.putImageData(strip, 0, y0);
  }
}

/**
 * STORM-reference texture: use ONLY the selected EXISTING GDP background
 * graphic, contained in a separate layer and feathered at its top/side edges.
 * No baked-in customer faces, no opaque rectangular backdrop and no external
 * art generation. Actual names are always ABOVE the pets.
 */
function paintStormBottom(ctx, background) {
  const detailScale = Math.max(1, ctx.getTransform().a);
  const layer = document.createElement('canvas');
  layer.width = Math.ceil(PREVIEW_W * detailScale);
  layer.height = Math.ceil(PREVIEW_H * detailScale);
  const bg = layer.getContext('2d', { alpha: true });
  if (!bg) return;
  bg.scale(detailScale, detailScale);
  // Retain the original GDP art's colors and source aspect ratio, placing its
  // lower flame/storm energy behind and toward the bottom of the subjects.
  const sw = background.naturalWidth || background.width;
  const sh = background.naturalHeight || background.height;
  const scale = Math.max(PREVIEW_W / sw, PREVIEW_H / sh);
  const w = sw * scale;
  const h = sh * scale;
  bg.drawImage(background, (PREVIEW_W - w) / 2, PREVIEW_H - h, w, h);

  bg.globalCompositeOperation = 'destination-in';
  const vertical = bg.createLinearGradient(0, 0, 0, PREVIEW_H);
  vertical.addColorStop(0, 'rgba(255,255,255,0)');
  vertical.addColorStop(.30, 'rgba(255,255,255,0)');
  vertical.addColorStop(.46, 'rgba(255,255,255,.34)');
  vertical.addColorStop(.67, 'rgba(255,255,255,1)');
  vertical.addColorStop(.90, 'rgba(255,255,255,1)');
  vertical.addColorStop(1, 'rgba(255,255,255,.55)');
  bg.fillStyle = vertical;
  bg.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
  const horizontal = bg.createLinearGradient(0, 0, PREVIEW_W, 0);
  horizontal.addColorStop(0, 'rgba(255,255,255,0)');
  horizontal.addColorStop(.08, 'rgba(255,255,255,.95)');
  horizontal.addColorStop(.92, 'rgba(255,255,255,.95)');
  horizontal.addColorStop(1, 'rgba(255,255,255,0)');
  bg.fillStyle = horizontal;
  bg.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
  bg.globalCompositeOperation = 'source-over';
  // Clean ONLY the original storm artwork here. Do this after its existing
  // artistic fades, before dogs, chrome names, lightning or secondary text.
  cleanQuickDesignDTFStormLayer(bg, layer.width, layer.height);
  ctx.drawImage(layer, 0, 0, PREVIEW_W, PREVIEW_H);
}

function paintPhaseCPortraits(ctx, images, accent) {
  getQuickDesignPhaseCRenderOrder(images.length).forEach((slot) => {
    const image = images[slot.photoIndex];
    if (image) paintPhaseBSubject(ctx, image, slot, accent, 'C');
  });
}

export function quickDesignLayoutCount() {
  return getQuickDesignPhaseCLayout(QUICK_DESIGN_MAX_PHOTOS).length;
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

/**
 * Locate the top of the actual photo content, not the photo slot's top.
 * A square dog image fits centered inside a tall portrait slot, leaving
 * additional transparent space. A fixed text Y misses that difference.
 */
function getQuickDesignVisiblePhotoTop(images) {
  const slots = getQuickDesignPhaseCLayout(images.length);
  const tops = images.map((image, index) => {
    const slot = slots[index];
    if (!slot) return PREVIEW_H;
    const width = (image.naturalWidth || image.width || 1);
    const height = (image.naturalHeight || image.height || 1);
    const bounds = trimmedAlphaBounds(image);
    const fit = getQuickDesignSubjectFit(width, height, slot.w * PREVIEW_W,
      slot.h * PREVIEW_H, bounds || null);
    // Cutout keylines extend about 5 px above the fitted source photo.
    return slot.y * PREVIEW_H + fit.y - (bounds ? 5 : 0);
  });
  return Math.max(0, Math.min(...tops));
}

/**
 * Renders the exact selected font and curve to a small temporary alpha layer
 * and reads the last meaningful name pixel. This compensates for different
 * font ascenders, downward arches, outlines and chrome gradients.
 */
function measureQuickDesignHeadlineBottom(headline, baselineY, accent, options) {
  const sample = document.createElement('canvas');
  sample.width = PREVIEW_W;
  sample.height = Math.ceil(PREVIEW_H * .7);
  const context = sample.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!context) return baselineY + 56;
  paintHeadline(context, headline, baselineY, PREVIEW_W * .935, 112, accent, options);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  for (let y = sample.height - 1; y >= 0; y--) {
    for (let x = 0; x < sample.width; x++) {
      if (pixels[(y * sample.width + x) * 4 + 3] >= 40) return y + 1;
    }
  }
  return baselineY + 56;
}

/**
 * Small font preview rendered with the EXACT same paintHeadline() algorithm
 * used for the customer artwork (curvature, glyph rotation, size, and finishes).
 */
export async function renderQuickDesignNamePreview({
  headline = 'YOUR NAME',
  fontId = 'serif',
  curve = 'up',
  fontSizePercent = 100,
  accent = '#fb61bd',
  premiumStyle = 'gold-chrome',
} = {}) {
  const font = quickDesignFont(fontId);
  if (typeof document !== 'undefined' && document.fonts?.load) {
    try { await document.fonts.load(font.weight + ' 88px "' + font.family + '"'); }
    catch { /* Use the same fallback family as final artwork. */ }
  }
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_W;
  canvas.height = 390;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Font preview is unavailable on this device.');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintHeadline(ctx, headline || 'YOUR NAME', 195, PREVIEW_W * .935, 112, accent,
    { fontId, curve, fontSizePercent, premiumStyle });
  return canvas;
}


export async function renderQuickDesignArtwork({ photos, backgroundUrl, headline, subline, accent = '#f9c846', fontId = 'serif', curve = 'up', fontSizePercent = 100, premiumStyle = 'gold-chrome', outputSize = 'preview' }) {
  if (!Array.isArray(photos) || photos.length === 0) throw new Error('Please upload a photo first.');
  const chosenFont = quickDesignFont(fontId);
  if (typeof document !== 'undefined' && document.fonts?.load) {
    try { await document.fonts.load(chosenFont.weight + ' 88px "' + chosenFont.family + '"'); }
    catch { /* Offline or blocked fonts use the system fallback. */ }
  }
  const [background, ...images] = await Promise.all([
    loadImage(backgroundUrl),
    ...photos.slice(0, QUICK_DESIGN_MAX_PHOTOS).map((item) => loadImage(item.url)),
  ]);
  // Default remains a lightweight customer preview. A3 uses actual
  // 3508 × 4961 canvas pixels and renders layers at native output resolution,
  // NOT a resized screenshot or a garment photograph. It is opt-in only.
  const a3 = outputSize === 'a3';
  const canvas = document.createElement('canvas');
  canvas.width = a3 ? QUICK_DESIGN_PRINT_SIZE.targetWidthPx : PREVIEW_W;
  canvas.height = a3 ? QUICK_DESIGN_PRINT_SIZE.targetHeightPx : PREVIEW_H;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Your browser does not support artwork previews.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (a3) ctx.scale(canvas.width / PREVIEW_W, canvas.height / PREVIEW_H);

  // Transparent garment-ready preview: no opaque poster rectangle. The
  // selected ORIGINAL GDP bitmap is visible primarily toward the bottom.
  paintStormBottom(ctx, background);
  paintPhaseCPortraits(ctx, images, accent);

  // Position the personalized title 0.5 inch above the ACTUAL visible
  // photo edge, not the invisible center-padding of each subject's tall slot.
  // Preserve real font curvature and final A3 source-resolution rendering.
  const headlineOptions = { fontId, curve, fontSizePercent, premiumStyle };
  const originalHeadlineY = getQuickDesignHeadlineY(images.length);
  const photoTop = getQuickDesignVisiblePhotoTop(images);
  const measuredNameBottom = measureQuickDesignHeadlineBottom(headline,
    originalHeadlineY, accent, headlineOptions);
  const alignedHeadlineY = getQuickDesignHeadlineY(images.length, {
    photoTop, nameBottom: measuredNameBottom,
  });
  paintHeadline(ctx, headline, alignedHeadlineY, PREVIEW_W * .935, 112,
    accent, headlineOptions);
  if (subline?.trim()) {
    paintHeadline(ctx, subline, PREVIEW_H * .915, PREVIEW_W * .84, 43, '#ffffff',
      { fontId: 'black', premiumStyle: 'solid' });
  }
  // Owner-requested clean, transparent artwork: no repeated watermark
  // overlay in previews or optional A3-sized composition renders.
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
