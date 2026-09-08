const numberOr = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const DEFAULT_DTF_SETTINGS = {
  enabled: true,
  maxWidth: 34,
  defaultWidth: 34,
  minLength: 6,
  standardMaxLength: 36,
  pricingMode: "graduated",
  standardRate: 0.049,
  volumeRate: 0.04375,
  breakpointArea: 1224,
  popularLengths: [12, 24, 36, 48, 60, 72, 96, 120],
  spacing: 0.25,
  recommendedDpi: 300,
  minimumDpi: 200,
  allowCustomWidth: true,
  allowCustomLength: true,
  advancedNestingEnabled: true,
  autoRotateEnabled: true,
  productionSegmentLength: 120,
  artworkReviewEnabled: true,
  artworkReviewPrice: 0,
  maxUploadMb: 100,
  watermarkedPreviewEnabled: true,
  previewDownloadBeforePayment: false,
  fullResolutionDownloadAfterPayment: false,
  adminProductionExportEnabled: true,
  watermarkText: "GDP Clothing Preview",
  watermarkOpacity: 0.2,
  watermarkSize: 28,
  watermarkPosition: "repeated",
  watermarkApplyTo: "all",
  acceptedMimeTypes: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
  ],
};

export function normalizeDtfSettings(raw = {}) {
  const next = { ...DEFAULT_DTF_SETTINGS, ...(raw || {}) };
  next.maxWidth = Math.max(1, numberOr(next.maxWidth, 34));
  next.defaultWidth = Math.min(next.maxWidth, Math.max(1, numberOr(next.defaultWidth, next.maxWidth)));
  next.minLength = Math.max(1, numberOr(next.minLength, 6));
  next.standardMaxLength = Math.max(next.minLength, numberOr(next.standardMaxLength, 36));
  next.standardRate = Math.max(0, numberOr(next.standardRate, 0.049));
  next.volumeRate = Math.max(0, numberOr(next.volumeRate, 0.04375));
  next.breakpointArea = Math.max(1, numberOr(next.breakpointArea, next.maxWidth * next.standardMaxLength));
  next.spacing = Math.max(0, numberOr(next.spacing, 0.25));
  next.minimumDpi = Math.max(1, numberOr(next.minimumDpi, 200));
  next.recommendedDpi = Math.max(next.minimumDpi, numberOr(next.recommendedDpi, 300));
  next.productionSegmentLength = Math.max(1, numberOr(next.productionSegmentLength, 120));
  next.artworkReviewPrice = Math.max(0, numberOr(next.artworkReviewPrice, 0));
  next.maxUploadMb = Math.max(1, numberOr(next.maxUploadMb, 100));
  next.watermarkOpacity = Math.min(0.8, Math.max(0.05, numberOr(next.watermarkOpacity, 0.2)));
  next.watermarkSize = Math.min(96, Math.max(10, numberOr(next.watermarkSize, 28)));
  next.watermarkPosition = ["repeated", "centered", "corner"].includes(next.watermarkPosition)
    ? next.watermarkPosition
    : "repeated";
  next.watermarkApplyTo = ["all", "builder", "cart", "download"].includes(next.watermarkApplyTo)
    ? next.watermarkApplyTo
    : "all";
  next.watermarkText = String(next.watermarkText || "GDP Clothing Preview").trim() || "GDP Clothing Preview";
  next.pricingMode = next.pricingMode === "flat_tier" ? "flat_tier" : "graduated";
  next.popularLengths = [...new Set(
    (Array.isArray(next.popularLengths) ? next.popularLengths : DEFAULT_DTF_SETTINGS.popularLengths)
      .map((value) => numberOr(value, 0))
      .filter((value) => value >= next.minLength)
  )].sort((a, b) => a - b);
  next.acceptedMimeTypes = Array.isArray(next.acceptedMimeTypes) && next.acceptedMimeTypes.length
    ? next.acceptedMimeTypes
    : DEFAULT_DTF_SETTINGS.acceptedMimeTypes;
  return next;
}

export function calculateDtfPrice(width, length, settingsInput = {}) {
  const settings = normalizeDtfSettings(settingsInput);
  const safeWidth = Math.min(settings.maxWidth, Math.max(0, numberOr(width, 0)));
  const safeLength = Math.max(0, numberOr(length, 0));
  const area = safeWidth * safeLength;

  let price = 0;
  let standardArea = 0;
  let volumeArea = 0;
  let effectiveRate = settings.standardRate;

  if (settings.pricingMode === "flat_tier" && area > settings.breakpointArea) {
    volumeArea = area;
    effectiveRate = settings.volumeRate;
    price = area * settings.volumeRate;
  } else {
    standardArea = Math.min(area, settings.breakpointArea);
    volumeArea = Math.max(0, area - settings.breakpointArea);
    price = standardArea * settings.standardRate + volumeArea * settings.volumeRate;
    effectiveRate = area > 0 ? price / area : settings.standardRate;
  }

  return {
    width: safeWidth,
    length: safeLength,
    area,
    price: Math.round((price + Number.EPSILON) * 100) / 100,
    standardArea,
    volumeArea,
    standardRate: settings.standardRate,
    volumeRate: settings.volumeRate,
    effectiveRate,
    breakpointArea: settings.breakpointArea,
    pricingMode: settings.pricingMode,
  };
}

export function getArtworkQuality(item, settingsInput = {}) {
  const settings = normalizeDtfSettings(settingsInput);
  if (!item) return { label: "No artwork", tone: "neutral", dpi: null };
  if (item.isVector || item.type === "application/pdf" || item.type === "image/svg+xml") {
    return { label: "Vector / print-ready", tone: "good", dpi: null };
  }

  const widthInches = Math.max(0.01, numberOr(item.width, 0));
  const pixels = Math.max(0, numberOr(item.pixelWidth, 0));
  if (!pixels) return { label: "Resolution unknown", tone: "neutral", dpi: null };

  const dpi = pixels / widthInches;
  if (dpi >= settings.recommendedDpi) return { label: "Excellent", tone: "good", dpi };
  if (dpi >= settings.minimumDpi) return { label: "Acceptable", tone: "warning", dpi };
  return { label: "Low resolution", tone: "bad", dpi };
}

export function normalizeArtworkRotation(value = 0) {
  const angle = numberOr(value, 0) % 360;
  return angle < 0 ? angle + 360 : angle;
}

export function getArtworkRotatedBounds(item = {}) {
  const x = numberOr(item.x, 0);
  const y = numberOr(item.y, 0);
  const width = Math.max(0, numberOr(item.width, 0));
  const height = Math.max(0, numberOr(item.height, 0));
  const angle = normalizeArtworkRotation(item.rotation);
  const radians = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const boundsWidth = width * cos + height * sin;
  const boundsHeight = width * sin + height * cos;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  return {
    left: centerX - boundsWidth / 2,
    top: centerY - boundsHeight / 2,
    right: centerX + boundsWidth / 2,
    bottom: centerY + boundsHeight / 2,
    width: boundsWidth,
    height: boundsHeight,
    centerX,
    centerY,
    angle,
  };
}

function artworkCorners(item = {}) {
  const x = numberOr(item.x, 0);
  const y = numberOr(item.y, 0);
  const width = Math.max(0, numberOr(item.width, 0));
  const height = Math.max(0, numberOr(item.height, 0));
  const angle = normalizeArtworkRotation(item.rotation);
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ].map(([localX, localY]) => ({
    x: centerX + localX * cos - localY * sin,
    y: centerY + localX * sin + localY * cos,
  }));
}

function polygonsOverlap(a, b) {
  const axes = [];
  for (const polygon of [a, b]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const edgeX = next.x - current.x;
      const edgeY = next.y - current.y;
      const length = Math.hypot(edgeX, edgeY) || 1;
      axes.push({ x: -edgeY / length, y: edgeX / length });
    }
  }

  for (const axis of axes) {
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;

    for (const point of a) {
      const projection = point.x * axis.x + point.y * axis.y;
      minA = Math.min(minA, projection);
      maxA = Math.max(maxA, projection);
    }
    for (const point of b) {
      const projection = point.x * axis.x + point.y * axis.y;
      minB = Math.min(minB, projection);
      maxB = Math.max(maxB, projection);
    }

    if (maxA <= minB + 0.0001 || maxB <= minA + 0.0001) return false;
  }

  return true;
}

export function usedArtworkLength(items = [], spacing = 0.25) {
  if (!items.length) return 0;
  return Math.max(...items.map((item) => getArtworkRotatedBounds(item).bottom)) + spacing;
}

export function calculateUtilization(items = [], sheetWidth = 34, sheetLength = 36) {
  const sheetArea = Math.max(0.01, numberOr(sheetWidth, 0) * numberOr(sheetLength, 0));
  const artArea = items.reduce(
    (sum, item) => sum + Math.max(0, numberOr(item.width, 0)) * Math.max(0, numberOr(item.height, 0)),
    0
  );
  return Math.max(0, Math.min(100, (artArea / sheetArea) * 100));
}

export function autoArrangeArtwork(items = [], sheetWidth = 34, sheetLength = 36, spacing = 0.25) {
  const maxWidth = Math.max(1, numberOr(sheetWidth, 34));
  const maxLength = Math.max(1, numberOr(sheetLength, 36));
  const gap = Math.max(0, numberOr(spacing, 0.25));
  let x = gap;
  let y = gap;
  let rowHeight = 0;

  return items.map((item) => {
    const width = Math.min(Math.max(0.5, numberOr(item.width, 1)), Math.max(0.5, maxWidth - gap * 2));
    const ratio = numberOr(item.aspectRatio, 1);
    const height = Math.max(0.5, width / Math.max(0.01, ratio));

    if (x + width + gap > maxWidth) {
      x = gap;
      y += rowHeight + gap;
      rowHeight = 0;
    }

    const placed = {
      ...item,
      width,
      height,
      x: Math.min(x, Math.max(gap, maxWidth - width - gap)),
      y,
      exceedsSheetLength: y + height > maxLength,
    };

    x += width + gap;
    rowHeight = Math.max(rowHeight, height);
    return placed;
  });
}

export function fitLengthToArtwork(items = [], settingsInput = {}) {
  const settings = normalizeDtfSettings(settingsInput);
  const used = usedArtworkLength(items, settings.spacing);
  return Math.max(settings.minLength, Math.ceil(used || settings.minLength));
}

export function createDtfConfigId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `dtf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}


export function artworkOverlaps(items = []) {
  const overlaps = [];
  for (let i = 0; i < items.length; i += 1) {
    const a = items[i];
    const aBounds = getArtworkRotatedBounds(a);
    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j];
      const bBounds = getArtworkRotatedBounds(b);
      const aabbIntersects =
        aBounds.left < bBounds.right &&
        aBounds.right > bBounds.left &&
        aBounds.top < bBounds.bottom &&
        aBounds.bottom > bBounds.top;

      if (aabbIntersects && polygonsOverlap(artworkCorners(a), artworkCorners(b))) {
        overlaps.push([a.id, b.id]);
      }
    }
  }
  return overlaps;
}
