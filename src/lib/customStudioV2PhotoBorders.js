// Photo Bootleg cutout borders. All effects derive from the uploaded image alpha,
// never from its rectangular frame or the garment mockup.
export const PHOTO_BORDER_STYLES = Object.freeze([
  { id: 'none', label: 'None' },
  { id: 'outline', label: 'Classic Outline' },
  { id: 'glow', label: 'Neon Glow' },
  { id: 'rough', label: 'Rough Vintage' },
  { id: 'bootlegGlow', label: 'Bootleg Glow' },
]);

export const DEFAULT_PHOTO_BORDER = Object.freeze({
  style: 'none',
  color: '#ffffff',
  thickness: 35,
  opacity: 100,
  softness: 55,
  distress: 50,
  innerColor: '#ffffff',
  innerThickness: 22,
  glowColor: '#d65bff',
  glowSize: 58,
  glowOpacity: 72,
  feather: 78,
  roughness: 8,
  // Optional source-alpha fade at the bottom of a portrait; no existing photo changes.
  bottomFade: 0,
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
    innerColor: /^#[0-9a-fA-F]{6}$/.test(String(config.innerColor || '')) ? config.innerColor : DEFAULT_PHOTO_BORDER.innerColor,
    innerThickness: clamp(config.innerThickness ?? DEFAULT_PHOTO_BORDER.innerThickness, 0, 100),
    glowColor: /^#[0-9a-fA-F]{6}$/.test(String(config.glowColor || '')) ? config.glowColor : DEFAULT_PHOTO_BORDER.glowColor,
    glowSize: clamp(config.glowSize ?? DEFAULT_PHOTO_BORDER.glowSize, 0, 100),
    glowOpacity: clamp(config.glowOpacity ?? DEFAULT_PHOTO_BORDER.glowOpacity, 0, 100),
    feather: clamp(config.feather ?? DEFAULT_PHOTO_BORDER.feather, 0, 100),
    roughness: clamp(config.roughness ?? DEFAULT_PHOTO_BORDER.roughness, 0, 100),
    bottomFade: clamp(config.bottomFade ?? 0, 0, 80),
  };
}

export function hasPhotoBorder(border) {
  const style = normalizePhotoBorder(border);
  if (style.style === 'bootlegGlow') {
    return style.opacity > 0 && (style.innerThickness > 0 || (style.glowSize > 0 && style.glowOpacity > 0));
  }
  return style.style !== 'none' && style.thickness > 0 && style.opacity > 0;
}

const createCanvas = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

// Dedicated three-pass airbrush treatment; existing outline/glow/rough rendering
// remains untouched. Only image alpha contributes to these cutout silhouettes.
// Work at the same bounded source resolution as other photo borders. Output is
// still drawn at the original photo's transformed size in the 300-DPI export.
function paintExpandedAlpha(context, image, pad, width, height, radius, roughness = 0) {
  if (radius <= 0) {
    context.drawImage(image, pad, pad, width, height);
    return;
  }
  const count = 28;
  for (let index = 0; index < count; index += 1) {
    const theta = index * Math.PI * 2 / count;
    const jitter = 1 + roughness / 100 * (0.12 * Math.sin(index * 11.7) + 0.08 * Math.cos(index * 5.9));
    context.drawImage(image, pad + Math.cos(theta) * radius * jitter, pad + Math.sin(theta) * radius * jitter, width, height);
  }
  context.drawImage(image, pad, pad, width, height);
}

function createBootlegGlowBorderImage(image, width, height, border) {
  const extent = Math.max(width, height);
  // Expressed relative to the source silhouette so the finished glow is
  // legible after the photo shrinks to a small shirt print preview.
  const strokeRadius = border.innerThickness > 0 ? Math.max(1, extent * (0.003 + border.innerThickness * 0.00038)) : 0;
  const haloRadius = border.glowSize > 0 ? extent * (0.012 + border.glowSize * 0.00064) : 0;
  const blurRadius = border.feather > 0 ? extent * (0.006 + border.feather * 0.0003) : 0;
  const padding = Math.ceil(Math.max(strokeRadius, haloRadius) + blurRadius * 3 + 5);
  const totalW = width + padding * 2;
  const totalH = height + padding * 2;
  const composite = createCanvas(totalW, totalH);
  const compositeCtx = composite.getContext('2d', { alpha: true });
  if (!compositeCtx) return null;

  // Broad colored halo: spread the alpha cutout, blur the mask once, then
  // colorize. The source photo is NEVER painted onto the visible border layer.
  if (border.glowOpacity > 0 && border.glowSize > 0) {
    const spread = createCanvas(totalW, totalH);
    const spreadCtx = spread.getContext('2d', { alpha: true });
    const soft = createCanvas(totalW, totalH);
    const softCtx = soft.getContext('2d', { alpha: true });
    if (!spreadCtx || !softCtx) return null;

    paintExpandedAlpha(spreadCtx, image, padding, width, height, haloRadius, border.roughness);
    // The blur is applied to an alpha mask, not the face or subject details.
    // Canvas filters are supported on modern Chrome, Firefox and Safari.
    softCtx.filter = blurRadius > 0 ? 'blur(' + blurRadius.toFixed(2) + 'px)' : 'none';
    softCtx.drawImage(spread, 0, 0);
    softCtx.filter = 'none';
    softCtx.globalCompositeOperation = 'source-in';
    softCtx.fillStyle = border.glowColor;
    softCtx.fillRect(0, 0, totalW, totalH);
    softCtx.globalCompositeOperation = 'source-over';
    compositeCtx.globalAlpha = border.glowOpacity / 100;
    compositeCtx.drawImage(soft, 0, 0);

    // Saturated inner halo under the crisp white stroke. A blur-only halo
    // washes out at small mobile preview sizes; this keeps its color vibrant.
    spreadCtx.globalCompositeOperation = 'source-in';
    spreadCtx.fillStyle = border.glowColor;
    spreadCtx.fillRect(0, 0, totalW, totalH);
    spreadCtx.globalCompositeOperation = 'destination-out';
    spreadCtx.drawImage(image, padding, padding, width, height);
    spreadCtx.globalCompositeOperation = 'source-over';
    compositeCtx.globalAlpha = border.glowOpacity / 100 * 0.46;
    compositeCtx.drawImage(spread, 0, 0);
    compositeCtx.globalAlpha = 1;
  }

  // Crisp white (or custom color) perimeter nearest the cutout. Subtract the
  // original alpha from the dilation to avoid whitening the face or clothing.
  if (strokeRadius > 0) {
    const rim = createCanvas(totalW, totalH);
    const rimCtx = rim.getContext('2d', { alpha: true });
    if (!rimCtx) return null;
    paintExpandedAlpha(rimCtx, image, padding, width, height, strokeRadius, border.roughness);
    rimCtx.globalCompositeOperation = 'source-in';
    rimCtx.fillStyle = border.innerColor;
    rimCtx.fillRect(0, 0, totalW, totalH);
    rimCtx.globalCompositeOperation = 'destination-out';
    rimCtx.drawImage(image, padding, padding, width, height);
    compositeCtx.drawImage(rim, 0, 0);
  }

  return {
    canvas: composite,
    leftPad: padding / width,
    topPad: padding / height,
    widthScale: totalW / width,
    heightScale: totalH / height,
    opacity: border.opacity / 100,
  };
}

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
  if (border.style === 'bootlegGlow') return createBootlegGlowBorderImage(image, w, h, border);
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


/**
 * Optional non-destructive bottom fade for customer photo alpha. The faded
 * image is used for BOTH the underlying photo and its border mask, so hard
 * rectangular photo bottoms disappear rather than gaining a glowing edge.
 * Images without bottomFade bypass this function and stay pixel-identical.
 */
export function createBottomFadedPhotoImage(image, sourceWidth, sourceHeight, input) {
  const amount = normalizePhotoBorder(input).bottomFade;
  if (!image || amount <= 0) return null;
  const width = Math.max(1, Number(sourceWidth) || 1);
  const height = Math.max(1, Number(sourceHeight) || 1);
  // A source-layer mask is bounded in memory; untouched photo layers never
  // need a canvas copy. 4096px still supports detailed garment-size exports.
  const scale = Math.min(1, 4096 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = createCanvas(w, h);
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, w, h);
  context.globalCompositeOperation = 'destination-in';
  const mask = context.createLinearGradient(0, 0, 0, h);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(Math.max(0, 1 - amount / 100), 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = mask;
  context.fillRect(0, 0, w, h);
  context.globalCompositeOperation = 'source-over';
  return { image: canvas, width: w, height: h, close: () => {} };
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
