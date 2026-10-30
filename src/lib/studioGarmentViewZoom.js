export const STUDIO_VIEW_MIN_ZOOM = 50;
export const STUDIO_VIEW_MAX_ZOOM = 200;
export const STUDIO_VIEW_ZOOM_STEP = 25;

export function clampStudioViewZoom(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.min(STUDIO_VIEW_MAX_ZOOM, Math.max(STUDIO_VIEW_MIN_ZOOM, numeric))
    : 100;
}

export function clampStudioViewPan(zoom, viewportWidth, viewportHeight, x, y) {
  const scale = clampStudioViewZoom(zoom) / 100;
  if (scale <= 1) return { x: 0, y: 0 };
  const limitX = Math.max(0, (scale - 1) * Math.max(0, Number(viewportWidth) || 0) / 2);
  const limitY = Math.max(0, (scale - 1) * Math.max(0, Number(viewportHeight) || 0) / 2);
  return {
    x: limitX > 0 ? Math.max(-limitX, Math.min(limitX, Number(x) || 0)) : 0,
    y: limitY > 0 ? Math.max(-limitY, Math.min(limitY, Number(y) || 0)) : 0,
  };
}
