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
  const limitX = Math.max(0, (scale - 1) * Math.max(0, Number(viewportWidth) || 0) / 2);
  const limitY = Math.max(0, (scale - 1) * Math.max(0, Number(viewportHeight) || 0) / 2);
  return {
    x: Math.max(-limitX, Math.min(limitX, Number(x) || 0)),
    y: Math.max(-limitY, Math.min(limitY, Number(y) || 0)),
  };
}
