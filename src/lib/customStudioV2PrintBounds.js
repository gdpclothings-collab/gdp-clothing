// Shared, rotation-aware print bounds for the interactive preview and production PNG.
// Coordinates are percentages of the printable rectangle, not the garment image.
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const aspect = (value) => Math.max(0.01, finite(value, 1));
const radians = (value) => finite(value, 0) * Math.PI / 180;

function projectedSize(width, height, rotation, canvasAspect) {
  const c = Math.abs(Math.cos(radians(rotation)));
  const s = Math.abs(Math.sin(radians(rotation)));
  return {
    width: c * width + s * height / canvasAspect,
    height: c * height + s * width * canvasAspect,
  };
}

/** Keep every corner of a photo box inside the printable region on drag/pinch/slider. */
export function constrainFreePhotoTransform(transform = {}, zone = {}, canvasAspect = 1) {
  const ratio = aspect(canvasAspect);
  const boxWidth = clamp(finite(zone.width, 70), 1, 100);
  const boxHeight = clamp(finite(zone.height, 68), 1, 100);
  const rotation = clamp(finite(transform.rotation, 0), -180, 180);
  const projected = projectedSize(boxWidth, boxHeight, rotation, ratio);
  const maxScale = Math.min(220, 10000 / Math.max(0.01, projected.width), 10000 / Math.max(0.01, projected.height));
  const scale = clamp(finite(transform.scale, 100), 1, maxScale);
  const fullWidth = projected.width * scale / 100;
  const fullHeight = projected.height * scale / 100;
  const zoneX = finite(zone.x, 15), zoneY = finite(zone.y, 12);
  const zoneCenterX = zoneX + boxWidth / 2, zoneCenterY = zoneY + boxHeight / 2;
  const rawX = finite(transform.canvasX, zoneCenterX + finite(transform.x, 0) * boxWidth / 100);
  const rawY = finite(transform.canvasY, zoneCenterY + finite(transform.y, 0) * boxHeight / 100);
  return {
    ...transform,
    scale,
    rotation,
    canvasX: clamp(rawX, fullWidth / 2, 100 - fullWidth / 2),
    canvasY: clamp(rawY, fullHeight / 2, 100 - fullHeight / 2),
  };
}

/** Sticker size is a percentage of print WIDTH; its preview box is square in CSS pixels. */
export function constrainStickerTransform(transform = {}, canvasAspect = 1) {
  const ratio = aspect(canvasAspect);
  const rotation = clamp(finite(transform.rotation, 0), -180, 180);
  const projected = projectedSize(1, ratio, rotation, ratio);
  const maxScale = Math.min(85, 100 / projected.width, 100 / projected.height);
  const scale = clamp(finite(transform.scale, 42), 1, maxScale);
  const fullWidth = projected.width * scale;
  const fullHeight = projected.height * scale;
  return {
    ...transform, scale, rotation,
    x: clamp(finite(transform.x, 0), fullWidth / 2 - 50, 50 - fullWidth / 2),
    y: clamp(finite(transform.y, 0), fullHeight / 2 - 50, 50 - fullHeight / 2),
  };
}

export const FULL_TEMPLATE_BOUNDS = Object.freeze({ x: 0, y: 0, width: 100, height: 100 });

/** Bounds of nontransparent art within a full-size template PNG/AVIF (0..100%). */
export function constrainTemplateTransform(transform = {}, bounds = FULL_TEMPLATE_BOUNDS, canvasAspect = 1) {
  const ratio = aspect(canvasAspect);
  const rotation = clamp(finite(transform.rotation, 0), -180, 180);
  const left = clamp(finite(bounds.x, 0), 0, 100);
  const top = clamp(finite(bounds.y, 0), 0, 100);
  const right = clamp(left + finite(bounds.width, 100), left, 100);
  const bottom = clamp(top + finite(bounds.height, 100), top, 100);
  const c = Math.cos(radians(rotation)), s = Math.sin(radians(rotation));
  const corners = [[left, top], [right, top], [right, bottom], [left, bottom]].map(([x, y]) => {
    const dx = x - 50, dy = y - 50;
    return { x: c * dx - s * dy / ratio, y: s * dx * ratio + c * dy };
  });
  const minimumX = Math.min(...corners.map((point) => point.x));
  const maximumX = Math.max(...corners.map((point) => point.x));
  const minimumY = Math.min(...corners.map((point) => point.y));
  const maximumY = Math.max(...corners.map((point) => point.y));
  const spanX = maximumX - minimumX, spanY = maximumY - minimumY;
  const maximumScale = Math.min(400, 10000 / Math.max(0.01, spanX), 10000 / Math.max(0.01, spanY));
  const scale = clamp(finite(transform.scale, 100), 1, maximumScale);
  const factor = scale / 100;
  const minX = 50 + minimumX * factor, maxX = 50 + maximumX * factor;
  const minY = 50 + minimumY * factor, maxY = 50 + maximumY * factor;
  return {
    ...transform, scale, rotation,
    x: clamp(finite(transform.x, 0), -minX, 100 - maxX),
    y: clamp(finite(transform.y, 0), -minY, 100 - maxY),
  };
}

/** Calculate transparent padding from actual artwork pixels, not a hardcoded frame size.
 * On failure, the whole image is treated as artwork so nothing can be accidentally cut.
 */
export function readTemplateAlphaBounds(image) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 192; canvas.height = 192;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return FULL_TEMPLATE_BOUNDS;
    context.clearRect(0, 0, 192, 192);
    context.drawImage(image, 0, 0, 192, 192);
    const data = context.getImageData(0, 0, 192, 192).data;
    let left = 192, top = 192, right = -1, bottom = -1;
    for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
      if (data[(y * 192 + x) * 4 + 3] < 4) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right < left) return FULL_TEMPLATE_BOUNDS;
    // One additional sample around visible pixels avoids shaving anti-aliased edges.
    const l = Math.max(0, left - 1), t = Math.max(0, top - 1);
    const r = Math.min(192, right + 2), b = Math.min(192, bottom + 2);
    return { x: l / 192 * 100, y: t / 192 * 100, width: (r - l) / 192 * 100, height: (b - t) / 192 * 100 };
  } catch {
    return FULL_TEMPLATE_BOUNDS;
  }
}
