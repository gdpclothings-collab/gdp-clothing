// Photo Bootleg cutout borders. All effects derive from the uploaded image alpha,
// never from its rectangular frame or the garment mockup.
export const PHOTO_BORDER_STYLES = Object.freeze([
  { id: 'none', label: 'None' },
  { id: 'outline', label: 'Classic Outline' },
  { id: 'glow', label: 'Neon Glow' },
  { id: 'rough', label: 'Rough Vintage' },
]);

export const DEFAULT_PHOTO_BORDER = Object.freeze({
  style: 'none',
  color: '#ffffff',
  thickness: 35,
  opacity: 100,
  softness: 55,
  distress: 50,
});

const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(n)) ? Number(n) : min));

export function normalizePhotoBorder(border = {}) {
  const config = /** @type {Record<string, any>} */ (border && typeof border === 'object' ? border : {});
  return {
    style: PHOTO_BORDER_STYLES.some((x) => x.id === config.style) ? config.style : 'none',
    color: /^#[0-9a-fA-F]{6}$/.test(String(config.color || '')) ? config.color : '#ffffff',
    thickness: clamp(config.thickness ?? 35, 0, 100),
    opacity: clamp(config.opacity ?? 100, 0, 100),
    softness: clamp(config.softness ?? 55, 0, 100),
    distress: clamp(config.distress ?? 50, 0, 100),
  };
}

export function hasPhotoBorder(border) {
  const style = normalizePhotoBorder(border);
  return style.style !== 'none' && style.thickness > 0 && style.opacity > 0;
}

const createCanvas = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

// A small, deterministic radial dilation around the actual source transparency.
// Destination-out removes the interior, leaving only an exterior colored border.
// This works for PNG cutouts, holes, irregular silhouettes and feathered alpha.
// The prepared canvas is safely bounded; the original high-res photo is never
// downsampled in production, only its optional decorative border.
export function createPhotoBorderImage(image, sourceWidth, sourceHeight, input) {
  const border = normalizePhotoBorder(input);
  if (!image || !hasPhotoBorder(border)) return null;
  const srcW = Math.max(1, Number(sourceWidth) || 1);
  const srcH = Math.max(1, Number(sourceHeight) || 1);
  const ratio = Math.min(1, 1280 / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * ratio));
  const h = Math.max(1, Math.round(srcH * ratio));
  const extent = Math.max(w, h);
  const baseRadius = Math.max(1, Math.round(extent * (0.003 + border.thickness * 0.00035)));
  const glow = border.style === 'glow';
  const maxRadius = glow ? baseRadius * (1.9 + border.softness / 100 * 2.8) : baseRadius * (border.style === 'rough' ? 1.7 : 1);
  const padding = Math.ceil(maxRadius + 4);
  const totalW = w + padding * 2;
  const totalH = h + padding * 2;
  const canvas = createCanvas(totalW, totalH);
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;

  // Circular samples spread ONLY the opaque source pixels. Transparency inside
  // the image is never treated as a solid rectangle.
  const rings = glow ? 4 : 1;
  const steps = 24;
  for (let ring = rings; ring >= 1; ring -= 1) {
    context.globalAlpha = glow ? (0.10 + (rings - ring) * 0.07) : 1;
    const radius = maxRadius * ring / rings;
    for (let index = 0; index < steps; index += 1) {
      const angle = index * Math.PI * 2 / steps;
      // Repeatable radial jitter for the distressed cut-paper look.
      const jitter = border.style === 'rough'
        ? 0.78 + ((Math.sin(index * 9.47) + Math.cos(index * 13.19)) * 0.5 + 1) * border.distress / 180
        : 1;
      context.drawImage(image, padding + Math.cos(angle) * radius * jitter, padding + Math.sin(angle) * radius * jitter, w, h);
    }
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = border.color;
  context.fillRect(0, 0, totalW, totalH);
  context.globalCompositeOperation = 'destination-out';
  context.drawImage(image, padding, padding, w, h);
  context.globalCompositeOperation = 'source-over';

  return {
    canvas,
    leftPad: padding / w,
    topPad: padding / h,
    widthScale: totalW / w,
    heightScale: totalH / h,
    opacity: border.opacity / 100,
  };
}

// Place the border using the EXACT same transform/position as the corresponding
// photo. Used by both 300 DPI output and the low-DPI live preview.
export function drawPreparedPhotoBorder(context, prepared, drawWidth, drawHeight) {
  if (!prepared) return;
  context.save();
  context.globalAlpha *= prepared.opacity;
  context.drawImage(prepared.canvas,
    -drawWidth * (0.5 + prepared.leftPad),
    -drawHeight * (0.5 + prepared.topPad),
    drawWidth * prepared.widthScale,
    drawHeight * prepared.heightScale);
  context.restore();
}
