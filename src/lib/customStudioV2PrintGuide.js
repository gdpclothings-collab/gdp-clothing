import { resolveStudioV2PrintProfile } from '@/lib/customStudioV2Production';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function garmentKind(product) {
  const token = [product?.name, product?.type, product?.category, product?.slug]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(baby|bodysuit|onesie|infant)/.test(token)) return 'baby';
  if (token.includes('toddler')) return 'toddler';
  if (/(youth|kids|kid)/.test(token)) return 'youth';
  if (/(hoodie|hooded)/.test(token)) return 'hoodie';
  if (/(crewneck|crew neck|sweatshirt|sweater)/.test(token) && !/(t-shirt|t shirt|tee|long sleeve)/.test(token)) return 'crewneck';
  return 'adult';
}

const DISPLAY_GEOMETRY = {
  baby: { bodyVisualWidthPercent: 36, frontTop: 31, backTop: 29 },
  toddler: { bodyVisualWidthPercent: 42, frontTop: 28, backTop: 26 },
  youth: { bodyVisualWidthPercent: 46, frontTop: 25, backTop: 24 },
  // Recording-calibrated against the live Adult Pullover Hoodie mockup.
  // The visible torso spans about 59% of the 4:5 preview canvas, so using 48%
  // made an XL 11 in print appear ~34% of the torso instead of the physical 11/26 (~42%).
  hoodie: { bodyVisualWidthPercent: 59, frontTop: 25, backTop: 28 },
  crewneck: { bodyVisualWidthPercent: 49, frontTop: 23, backTop: 22 },
  adult: { bodyVisualWidthPercent: 49, frontTop: 22, backTop: 21 },
};

const FALLBACK_BODY_WIDTHS_IN = {
  baby: { '0-3M': 8.5, '3-6M': 9, '6-12M': 9.75, '12-18M': 10.25, '18-24M': 10.75 },
  toddler: { '2T': 12, '3T': 13, '4T': 14, '5T': 15 },
  youth: { XS: 14.5, S: 15.5, M: 17, L: 18.5, XL: 20, YS: 15.5, YM: 17, YL: 18.5, YXL: 20 },
  hoodie: { S: 20, M: 22, L: 24, XL: 26, '2XL': 28, '3XL': 30, '4XL': 32, '5XL': 34 },
  crewneck: { S: 20, M: 22, L: 24, XL: 26, '2XL': 28, '3XL': 30, '4XL': 32, '5XL': 34 },
  adult: { XS: 17, S: 18.5, M: 20.5, L: 22.5, XL: 24.5, '2XL': 26.5, '3XL': 28.5, '4XL': 30.5, '5XL': 32.5 },
};

function normalizeSize(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\bX[-\s]?LARGE\b/g, 'XL')
    .replace(/\b([2-5])X[-\s]?LARGE\b/g, '$1XL')
    .replace(/\bEXTRA[-\s]?LARGE\b/g, 'XL')
    .replace(/\bSMALL\b/g, 'S')
    .replace(/\bMEDIUM\b/g, 'M')
    .replace(/\bLARGE\b/g, 'L');
}

function numericInches(value) {
  const match = String(value ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function parseSizeGuideRows(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (Array.isArray(parsed?.rows)) return parsed.rows.filter(Boolean);
  } catch {
    // Compact admin format: size|width|length|sleeve, one row per line.
  }
  return text.split(/\r?\n/).map((line) => {
    const [rowSize, width, length, sleeve] = line.split('|').map((part) => String(part || '').trim());
    return rowSize ? { size: rowSize, width, length, sleeve } : null;
  }).filter(Boolean);
}

function sizeGuideBodyWidthIn(product, size) {
  const rows = parseSizeGuideRows(product?.metafields?.size_guide_rows);
  const normalizedSize = normalizeSize(size);
  const row = rows.find((candidate) => normalizeSize(candidate?.size || candidate?.label) === normalizedSize);
  if (!row) return 0;

  const flatWidth = numericInches(row?.width ?? row?.chestWidth);
  if (flatWidth) return flatWidth;

  // A field explicitly named `chest` is often circumference rather than flat width.
  const chest = numericInches(row?.chest);
  return chest > 30 ? chest / 2 : chest;
}

function configuredBodyWidthIn(product, size, side) {
  const guide = product?.customization?.preview?.printGuide?.[side] || {};
  const sizeOverride = guide?.sizeOverrides?.[size] || guide?.sizeOverrides?.[normalizeSize(size)] || {};
  return numericInches(
    sizeOverride?.garmentWidthIn ??
    sizeOverride?.bodyWidthIn ??
    guide?.garmentWidthIn ??
    guide?.bodyWidthIn
  );
}

function fallbackBodyWidthIn(kind, size) {
  const table = FALLBACK_BODY_WIDTHS_IN[kind] || FALLBACK_BODY_WIDTHS_IN.adult;
  const normalizedSize = normalizeSize(size);
  return Number(table[normalizedSize] || table.M || Object.values(table)[0] || 22);
}

function configuredBodyVisualWidthPercent(product, side) {
  const preview = product?.customization?.preview || {};
  const source = preview?.printGuide?.visualGeometry || preview?.visualGeometry || {};
  const sided = source?.[side] || {};
  const value = Number(sided?.bodyWidthPercent ?? source?.bodyWidthPercent);
  return Number.isFinite(value) && value > 0 ? clamp(value, 28, 70) : 0;
}

function resolveDisplayGeometry(product, size, side) {
  const kind = garmentKind(product);
  const defaults = DISPLAY_GEOMETRY[kind] || DISPLAY_GEOMETRY.adult;
  const bodyWidthIn =
    configuredBodyWidthIn(product, size, side) ||
    sizeGuideBodyWidthIn(product, size) ||
    fallbackBodyWidthIn(kind, size);
  const bodyVisualWidthPercent = configuredBodyVisualWidthPercent(product, side) || defaults.bodyVisualWidthPercent;

  return {
    kind,
    bodyWidthIn,
    bodyVisualWidthPercent,
    topPercent: side === 'back' ? defaults.backTop : defaults.frontTop,
  };
}

function formatInches(value) {
  const number = Number(value || 0);
  if (Number.isInteger(number)) return String(number);
  return String(Math.round(number * 100) / 100).replace(/0$/, '');
}

/**
 * Map the exact production area onto the visible garment body.
 *
 * The production width/height still come only from resolveStudioV2PrintProfile.
 * The preview scale is separate: it uses the selected garment's flat body width
 * (product size-guide data first, then a conservative garment-family fallback)
 * so an 11-inch print no longer consumes ~40% of the whole 4:5 image canvas.
 *
 * Optional product overrides:
 * - printGuide[side].sizeOverrides[size].garmentWidthIn / bodyWidthIn
 * - printGuide[side].garmentWidthIn / bodyWidthIn
 * - preview.printGuide.visualGeometry[side].bodyWidthPercent
 */
export function resolveStudioV2PrintGuide(product, size, side = 'front') {
  const normalizedSide = side === 'back' ? 'back' : 'front';
  const profile = resolveStudioV2PrintProfile(product, size, normalizedSide);
  const geometry = resolveDisplayGeometry(product, size, normalizedSide);
  const physicalRatio = clamp(Number(profile.widthIn) / Math.max(1, geometry.bodyWidthIn), 0.18, 0.78);
  const widthPercent = Math.round(geometry.bodyVisualWidthPercent * physicalRatio * 10) / 10;
  const dimensions = `${formatInches(profile.widthIn)} × ${formatInches(profile.heightIn)} in`;
  const configuredReference = product?.customization?.preview?.printGuide?.reference || null;
  const reference = configuredReference || {
    provider: 'Printful',
    method: 'DTF',
    printfulTechnique: 'DTFlex',
    standard: 'Product-specific DTF/DTFlex max print area',
  };

  return {
    ...profile,
    printMethod: 'DTF',
    printfulTechnique: 'DTFlex',
    label: `DTF MAX ${dimensions}`,
    dimensionsLabel: dimensions,
    recommendationLabel: `DTF maximum print area: ${dimensions}`,
    reference,
    displayCalibration: {
      garmentKind: geometry.kind,
      garmentBodyWidthIn: Math.round(geometry.bodyWidthIn * 100) / 100,
      bodyVisualWidthPercent: geometry.bodyVisualWidthPercent,
      printWidthPercent: widthPercent,
      source: configuredBodyWidthIn(product, size, normalizedSide)
        ? 'product-print-guide'
        : sizeGuideBodyWidthIn(product, size)
          ? 'product-size-guide'
          : 'garment-family-fallback',
    },
    fileGuidelines: {
      acceptedFormats: ['PNG', 'JPG'],
      preferredFormat: 'PNG with transparent background when no background is intended',
      minimumDpi: 150,
      preferredDpi: 300,
      maximumRecommendedDpi: 300,
      colorProfile: 'sRGB IEC61966-2.1',
      minimumLinePt: 1,
      minimumLinePxAt300Dpi: 4,
      minimumTextStrokePt: 1,
      generalTextSizePt: '10–12+',
      preferTransparentBackground: true,
      avoidSemiTransparency: true,
      avoidSoftEdges: true,
      useHalftoneInsteadOfOpacityFades: true,
      avoidUnnecessaryLargeSolidAreas: true,
      keepImportantContentInSafeArea: true,
    },
    style: {
      top: `${geometry.topPercent}%`,
      width: `${widthPercent}%`,
      aspectRatio: `${Number(profile.widthIn)} / ${Number(profile.heightIn)}`,
    },
  };
}
