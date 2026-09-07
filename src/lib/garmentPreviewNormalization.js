const DEFAULT_CANVAS = Object.freeze({ width: 1000, height: 1200 });
const DEFAULT_NORMALIZATION = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 });

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max, fallback) {
  return Math.min(max, Math.max(min, finiteNumber(value, fallback)));
}

export function resolvePreviewCanvas(previewConfig = {}) {
  const canvas = previewConfig?.canvas || {};
  return {
    width: clamp(canvas.width, 600, 2400, DEFAULT_CANVAS.width),
    height: clamp(canvas.height, 720, 3000, DEFAULT_CANVAS.height),
  };
}

export function resolveMockupNormalization(previewConfig = {}, side = "front") {
  const normalizedSide = side === "back" ? "back" : "front";
  const source =
    previewConfig?.normalization?.[normalizedSide] ||
    previewConfig?.mockupNormalization?.[normalizedSide] ||
    {};

  return {
    scale: clamp(source.scale, 0.7, 1.3, DEFAULT_NORMALIZATION.scale),
    offsetX: clamp(source.offsetX, -20, 20, DEFAULT_NORMALIZATION.offsetX),
    offsetY: clamp(source.offsetY, -20, 20, DEFAULT_NORMALIZATION.offsetY),
  };
}

/**
 * @param {{ scale?: number, offsetX?: number, offsetY?: number }} [normalization]
 */
export function getMockupLayerStyle(normalization = {}) {
  const scale = clamp(normalization.scale, 0.7, 1.3, DEFAULT_NORMALIZATION.scale);
  const offsetX = clamp(normalization.offsetX, -20, 20, DEFAULT_NORMALIZATION.offsetX);
  const offsetY = clamp(normalization.offsetY, -20, 20, DEFAULT_NORMALIZATION.offsetY);

  return {
    transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale})`,
    transformOrigin: "50% 50%",
    willChange: "transform",
  };
}

export function preloadPreviewImages(urls = []) {
  if (typeof window === "undefined" || typeof window.Image === "undefined") return;

  [...new Set(urls.filter(Boolean))].forEach((url) => {
    const image = new window.Image();
    image.decoding = "async";
    image.src = url;
  });
}

export const GARMENT_PREVIEW_STANDARD = Object.freeze({
  canvas: DEFAULT_CANVAS,
  maxVisibleHeightDifferencePercent: 3,
  maxCenterDifferencePercent: 2,
  scaleRange: [0.7, 1.3],
  offsetRangePercent: [-20, 20],
});
