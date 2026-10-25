import { constrainTemplateTransform } from './customStudioV2PrintBounds.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function normalizedBounds(bounds = {}) {
  const x = clamp(finite(bounds.x, 0), 0, 100);
  const y = clamp(finite(bounds.y, 0), 0, 100);
  return {
    x, y,
    width: clamp(finite(bounds.width, 100), 0.01, 100 - x || 0.01),
    height: clamp(finite(bounds.height, 100), 0.01, 100 - y || 0.01),
  };
}

function rotate(x, y, angle, aspect) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * x - s * y / aspect, y: s * x * aspect + c * y };
}

/**
 * The selection rectangle encloses visible template ink, not its transparent
 * margins. It uses the exact placement transform already shared with print PNGs.
 */
export function templateSelectionGeometry(transform = {}, bounds = {}, canvasAspect = 1) {
  const safe = normalizedBounds(bounds);
  const aspect = Math.max(0.01, finite(canvasAspect, 1));
  const scale = finite(transform.scale, 100);
  const sx = scale * finite(transform.widthScale, 100) / 10000;
  const sy = scale * finite(transform.heightScale, 100) / 10000;
  const rotation = finite(transform.rotation, 0);
  const angle = rotation * Math.PI / 180;
  const cx = safe.x + safe.width / 2 - 50;
  const cy = safe.y + safe.height / 2 - 50;
  const offset = rotate(cx * sx, cy * sy, angle, aspect);
  return {
    centerX: 50 + finite(transform.x, 0) + offset.x,
    centerY: 50 + finite(transform.y, 0) + offset.y,
    width: safe.width * sx,
    height: safe.height * sy,
    rotation,
  };
}

const RESIZE_AXES = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);

/**
 * Resize from ONE edge while preserving the opposite edge's position.
 * Deltas are measured in percentages of print width / height. The result is
 * still the historic x/y, scale, widthScale, heightScale, rotation record.
 */
export function resizeTemplateFromHandle(transform, bounds, canvasAspect, handle, deltaX, deltaY) {
  if (!RESIZE_AXES.has(handle)) return transform;
  const ratio = Math.max(0.01, finite(canvasAspect, 1));
  const start = constrainTemplateTransform(transform, bounds, ratio);
  const safe = normalizedBounds(bounds);
  const original = templateSelectionGeometry(start, safe, ratio);
  const angle = finite(start.rotation, 0) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const scale = finite(start.scale, 100);
  const dx = finite(deltaX, 0), dy = finite(deltaY, 0);

  const candidateAt = (fraction) => {
    // Inverse rotation maps pointer movement into the edge's local axis.
    const localX = (c * dx + s * dy / ratio) * fraction;
    const localY = (-s * dx * ratio + c * dy) * fraction;
    const east = handle.includes('e'), west = handle.includes('w');
    const south = handle.includes('s'), north = handle.includes('n');
    const newWidth = east || west
      ? clamp(original.width + (east ? localX : -localX), safe.width * scale / 10000, safe.width * scale / 10)
      : original.width;
    const newHeight = north || south
      ? clamp(original.height + (south ? localY : -localY), safe.height * scale / 10000, safe.height * scale / 10)
      : original.height;
    const shiftX = (east ? 1 : west ? -1 : 0) * (newWidth - original.width) / 2;
    const shiftY = (south ? 1 : north ? -1 : 0) * (newHeight - original.height) / 2;
    const centerShift = rotate(shiftX, shiftY, angle, ratio);
    const sx = newWidth / safe.width;
    const sy = newHeight / safe.height;
    const inkCenter = rotate(
      (safe.x + safe.width / 2 - 50) * sx,
      (safe.y + safe.height / 2 - 50) * sy,
      angle, ratio
    );
    return {
      ...start,
      widthScale: sx * 10000 / scale,
      heightScale: sy * 10000 / scale,
      x: original.centerX + centerShift.x - 50 - inkCenter.x,
      y: original.centerY + centerShift.y - 50 - inkCenter.y,
    };
  };

  const fits = (candidate) => {
    const checked = constrainTemplateTransform(candidate, safe, ratio);
    return ['scale', 'widthScale', 'heightScale', 'x', 'y'].every((key) =>
      Math.abs(checked[key] - candidate[key]) < 0.001
    );
  };

  const desired = candidateAt(1);
  if (fits(desired)) return desired;

  // A dragged edge must stop at the print boundary; it must not unexpectedly
  // shrink the opposite axis or shift the fixed edge due to generic clamping.
  let low = 0, high = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (fits(candidateAt(mid))) low = mid;
    else high = mid;
  }
  return candidateAt(low);
}
