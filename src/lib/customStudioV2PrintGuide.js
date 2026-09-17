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
  baby: { maxWidthIn: 4, maxVisualWidth: 30, frontTop: 31, backTop: 29 },
  toddler: { maxWidthIn: 5.5, maxVisualWidth: 34, frontTop: 28, backTop: 26 },
  youth: { maxWidthIn: 10.5, maxVisualWidth: 40, frontTop: 25, backTop: 24 },
  hoodie: { maxWidthIn: 12, maxVisualWidth: 41, frontTop: 25, backTop: 28 },
  crewneck: { maxWidthIn: 12, maxVisualWidth: 43, frontTop: 23, backTop: 22 },
  adult: { maxWidthIn: 12, maxVisualWidth: 44, frontTop: 22, backTop: 21 },
};

function formatInches(value) {
  const number = Number(value || 0);
  if (Number.isInteger(number)) return String(number);
  return String(Math.round(number * 100) / 100).replace(/0$/, '');
}

/**
 * Visual mapping of the exact recommended production area onto the garment mockup.
 * Physical width/height always come from resolveStudioV2PrintProfile, so preview,
 * Seasonal workspace and final 300-DPI output share the same source of truth.
 */
export function resolveStudioV2PrintGuide(product, size, side = 'front') {
  const normalizedSide = side === 'back' ? 'back' : 'front';
  const profile = resolveStudioV2PrintProfile(product, size, normalizedSide);
  const geometry = DISPLAY_GEOMETRY[garmentKind(product)] || DISPLAY_GEOMETRY.adult;
  const ratio = clamp(Number(profile.widthIn) / geometry.maxWidthIn, 0.5, 1);
  const widthPercent = Math.round(geometry.maxVisualWidth * ratio * 10) / 10;
  const topPercent = normalizedSide === 'back' ? geometry.backTop : geometry.frontTop;
  const dimensions = `${formatInches(profile.widthIn)} × ${formatInches(profile.heightIn)} in`;

  return {
    ...profile,
    label: dimensions,
    recommendationLabel: `Recommended print area: ${dimensions}`,
    style: {
      top: `${topPercent}%`,
      width: `${widthPercent}%`,
      aspectRatio: `${Number(profile.widthIn)} / ${Number(profile.heightIn)}`,
    },
  };
}
