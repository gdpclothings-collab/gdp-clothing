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
  baby: { maxWidthIn: 6, maxVisualWidth: 34, frontTop: 29, backTop: 26 },
  toddler: { maxWidthIn: 7.5, maxVisualWidth: 38, frontTop: 25, backTop: 23 },
  youth: { maxWidthIn: 10, maxVisualWidth: 41, frontTop: 24, backTop: 22 },
  hoodie: { maxWidthIn: 12, maxVisualWidth: 42, frontTop: 25, backTop: 21 },
  crewneck: { maxWidthIn: 12, maxVisualWidth: 43, frontTop: 23, backTop: 21 },
  adult: { maxWidthIn: 12, maxVisualWidth: 44, frontTop: 22, backTop: 20 },
};

function formatInches(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 10) / 10);
}

/**
 * Presentation geometry for the dashed Custom Studio print guide.
 *
 * Physical dimensions always come from the same production profile used by
 * final 300-DPI rendering. The percentages below only map that real print area
 * onto each garment mockup; they never alter artwork coordinates or output.
 */
export function resolveStudioV2PrintGuide(product, size, side = 'front') {
  const normalizedSide = side === 'back' ? 'back' : 'front';
  const profile = resolveStudioV2PrintProfile(product, size, normalizedSide);
  const geometry = DISPLAY_GEOMETRY[garmentKind(product)] || DISPLAY_GEOMETRY.adult;
  const ratio = clamp(Number(profile.widthIn) / geometry.maxWidthIn, 0.55, 1);
  const widthPercent = Math.round(geometry.maxVisualWidth * ratio * 10) / 10;
  const topPercent = normalizedSide === 'back' ? geometry.backTop : geometry.frontTop;

  return {
    ...profile,
    label: `${formatInches(profile.widthIn)} × ${formatInches(profile.heightIn)} in`,
    style: {
      top: `${topPercent}%`,
      width: `${widthPercent}%`,
      aspectRatio: `${Number(profile.widthIn)} / ${Number(profile.heightIn)}`,
    },
  };
}
