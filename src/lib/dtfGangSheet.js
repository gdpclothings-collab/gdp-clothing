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
  standardRate: 0.028,
  volumeRate: 0.025,
  breakpointArea: 1224,
  popularLengths: [12, 24, 36, 48, 60, 72, 96, 120],
  spacing: 0.25,
  recommendedDpi: 300,
  minimumDpi: 200,
  allowCustomWidth: true,
  allowCustomLength: true,
  productionSegmentLength: 120,
  artworkReviewEnabled: true,
  artworkReviewPrice: 0,
  maxUploadMb: 100,
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
  next.standardRate = Math.max(0, numberOr(next.standardRate, 0.028));
  next.volumeRate = Math.max(0, numberOr(next.volumeRate, 0.025));
  next.breakpointArea = Math.max(1, numberOr(next.breakpointArea, next.maxWidth * next.standardMaxLength));
  next.spacing = Math.max(0, numberOr(next.spacing, 0.25));
  next.minimumDpi = Math.max(1, numberOr(next.minimumDpi, 200));
  next.recommendedDpi = Math.max(next.minimumDpi, numberOr(next.recommendedDpi, 300));
  next.productionSegmentLength = Math.max(1, numberOr(next.productionSegmentLength, 120));
  next.artworkReviewPrice = Math.max(0, numberOr(next.artworkReviewPrice, 0));
  next.maxUploadMb = Math.max(1, numberOr(next.maxUploadMb, 100));
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

export function usedArtworkLength(items = [], spacing = 0.25) {
  if (!items.length) return 0;
  return Math.max(...items.map((item) => numberOr(item.y, 0) + numberOr(item.height, 0))) + spacing;
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
    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j];
      const intersects =
        numberOr(a.x, 0) < numberOr(b.x, 0) + numberOr(b.width, 0) &&
        numberOr(a.x, 0) + numberOr(a.width, 0) > numberOr(b.x, 0) &&
        numberOr(a.y, 0) < numberOr(b.y, 0) + numberOr(b.height, 0) &&
        numberOr(a.y, 0) + numberOr(a.height, 0) > numberOr(b.y, 0);

      if (intersects) overlaps.push([a.id, b.id]);
    }
  }
  return overlaps;
}
