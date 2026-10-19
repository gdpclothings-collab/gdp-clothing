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

/** Independent width/height multipliers. 100%/100% preserves every saved design. */
export function freeAxisScale(transform = {}) {
  return { widthScale: clamp(finite(transform.widthScale, 100), 1, 1000), heightScale: clamp(finite(transform.heightScale, 100), 1, 1000) };
}

function fitAxisRectangle(width, height, rotation, canvasAspect) {
  return projectedSize(width, height, rotation, canvasAspect);
}

/** Clamp both axes together only when the full rotated rectangle cannot fit. */
function fitAxisScales(baseWidth, baseHeight, rotation, canvasAspect, scale, widthScale, heightScale, maxScale) {
  const safeScale = clamp(finite(scale, 100), 1, maxScale);
  let sx = clamp(finite(widthScale, 100), 1, 1000);
  let sy = clamp(finite(heightScale, 100), 1, 1000);
  const getProjected = (a, b) => fitAxisRectangle(
    baseWidth * safeScale / 100 * a / 100,
    baseHeight * safeScale / 100 * b / 100,
    rotation,
    canvasAspect
  );
  let projected = getProjected(sx, sy);
  if (projected.width > 100 || projected.height > 100) {
    const ratio = Math.min(1, 100 / Math.max(projected.width, 0.001), 100 / Math.max(projected.height, 0.001));
    sx = Math.max(1, sx * ratio * 0.99999);
    sy = Math.max(1, sy * ratio * 0.99999);
    projected = getProjected(sx, sy);
  }
  return { scale: safeScale, widthScale: sx, heightScale: sy, projected };
}

/** Photo shape and gestures are independent of the protected template and legacy zone position. */
export function constrainFreePhotoTransform(transform = {}, zone = {}, canvasAspect = 1) {
  const ratio = aspect(canvasAspect);
  const boxWidth = clamp(finite(zone.width, 70), 1, 100);
  const boxHeight = clamp(finite(zone.height, 68), 1, 100);
  const rotation = clamp(finite(transform.rotation, 0), -180, 180);
  const { scale, widthScale, heightScale, projected } = fitAxisScales(
    boxWidth, boxHeight, rotation, ratio, transform.scale, transform.widthScale, transform.heightScale, 1000
  );
  const zoneCenterX = finite(zone.x, 15) + boxWidth / 2;
  const zoneCenterY = finite(zone.y, 12) + boxHeight / 2;
  const rawX = finite(transform.canvasX, zoneCenterX + finite(transform.x, 0) * boxWidth / 100);
  const rawY = finite(transform.canvasY, zoneCenterY + finite(transform.y, 0) * boxHeight / 100);
  return {
    ...transform, scale, rotation, widthScale, heightScale,
    canvasX: clamp(rawX, projected.width / 2, 100 - projected.width / 2),
    canvasY: clamp(rawY, projected.height / 2, 100 - projected.height / 2),
  };
}

/** Sticker size is a percentage of print WIDTH; the UI box is square in actual CSS pixels. */
export function constrainStickerTransform(transform = {}, canvasAspect = 1) {
  const ratio = aspect(canvasAspect);
  const rotation = clamp(finite(transform.rotation, 0), -180, 180);
  const {scale,widthScale,heightScale,projected} = fitAxisScales(
    1, ratio, rotation, ratio, transform.scale ?? 42, transform.widthScale, transform.heightScale, 1000
  );
  return {
    ...transform,scale,widthScale,heightScale,rotation,
    x: clamp(finite(transform.x, 0), projected.width / 2 - 50, 50 - projected.width / 2),
    y: clamp(finite(transform.y, 0), projected.height / 2 - 50, 50 - projected.height / 2),
  };
}

export const FULL_TEMPLATE_BOUNDS = Object.freeze({ x: 0, y: 0, width: 100, height: 100 });

/** Read the visible alpha silhouette to allow full-print-area layout without losing print ink. */
export function constrainTemplateTransform(transform = {}, bounds = { x: 0, y: 0, width: 100, height: 100 }, canvasAspect = 1) {
  const ratio = aspect(canvasAspect);
  const rotation = clamp(finite(transform.rotation, 0), -180, 180);
  const left = clamp(finite(bounds.x, 0), 0, 100);
  const top = clamp(finite(bounds.y, 0), 0, 100);
  const right = clamp(left + finite(bounds.width, 100), left, 100);
  const bottom = clamp(top + finite(bounds.height, 100), top, 100);
  const c = Math.cos(radians(rotation)), s = Math.sin(radians(rotation));
  const corners = [[left, top], [right, top], [right, bottom], [left, bottom]].map(([x, y]) => ({ x:x-50, y:y-50 }));
  const box = (sx,sy) => {
    const points = corners.map(({x,y})=>({ x: c*x*sx - s*y*sy/ratio, y: s*x*sx*ratio + c*y*sy }));
    return { minX:Math.min(...points.map(p=>p.x)), maxX:Math.max(...points.map(p=>p.x)),
      minY:Math.min(...points.map(p=>p.y)), maxY:Math.max(...points.map(p=>p.y)) };
  };
  const scale = clamp(finite(transform.scale, 100), 1, 1000);
  let {widthScale,heightScale} = freeAxisScale(transform);
  const boundsAt = (a,b) => box(scale*a/10000, scale*b/10000);
  let extents = boundsAt(widthScale,heightScale);
  const width=()=>extents.maxX-extents.minX, height=()=>extents.maxY-extents.minY;
  if(width()>100 || height()>100) {
    const ratioFit=Math.min(1,100/Math.max(width(),0.001),100/Math.max(height(),0.001));
    widthScale=Math.max(1,widthScale*ratioFit*0.99999);
    heightScale=Math.max(1,heightScale*ratioFit*0.99999);
    extents=boundsAt(widthScale,heightScale);
  }
  return {
    ...transform, scale,rotation,widthScale,heightScale,
    x: clamp(finite(transform.x,0), -50-extents.minX,50-extents.maxX),
    y: clamp(finite(transform.y,0), -50-extents.minY,50-extents.maxY),
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
