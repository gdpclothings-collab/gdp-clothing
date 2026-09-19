function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/grey/g, 'gray')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fileName(url) {
  const raw = String(url || '').split('/').pop() || '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function isBackImage(url) {
  const name = normalize(fileName(url));
  return name.includes(' back') || name.startsWith('back ') || name.includes(' rear') || name.startsWith('rear ');
}

function colorMatch(url, color) {
  const name = normalize(fileName(url));
  const key = normalize(color);
  if (!name || !key) return false;
  if (key === 'sport gray') return name.includes('sport gray') || name.includes('sportgray');
  if (key === 'royal') return name.includes('royal') || (name.includes('blue') && !name.includes('navy'));
  return name.includes(key);
}

function colorMockup(product, color, side) {
  const mockups = product?.customization?.preview?.colorMockups;
  if (!mockups || typeof mockups !== 'object') return '';

  const colorKey = normalize(color);
  const match = Object.entries(mockups).find(([key]) => normalize(key) === colorKey);
  if (!match) return '';

  const config = match[1] || {};
  return side === 'back'
    ? String(config.backUrl || config.backImageUrl || config.back || '')
    : String(config.frontUrl || config.frontImageUrl || config.front || '');
}

function metadataMockup(product, color, side) {
  const media = product?.customization?.media;
  if (!media || typeof media !== 'object') return '';

  const colorKey = normalize(color);
  const candidates = Object.entries(media).filter(([, meta]) => normalize(meta?.view) === side);
  const colored = candidates.find(([, meta]) => normalize(meta?.color) === colorKey);
  if (colored?.[0]) return colored[0];
  return candidates[0]?.[0] || '';
}

export function studioV2GarmentPreview(product, color, side = 'front') {
  const normalizedSide = side === 'back' ? 'back' : 'front';

  // Prefer the product's exact color + side mapping. Admin product media already stores
  // authoritative front/back URLs even when the storage filename itself does not say "back".
  const mappedColorPreview = colorMockup(product, color, normalizedSide);
  if (mappedColorPreview) return mappedColorPreview;

  const configured = product?.customization?.preview || {};
  const explicit = normalizedSide === 'back'
    ? (configured.backImageUrl || configured.back || configured.backMockupUrl || '')
    : (configured.frontImageUrl || configured.front || configured.frontMockupUrl || '');
  if (explicit) return explicit;

  // Fall back to per-image media metadata before guessing from filenames.
  const mappedMediaPreview = metadataMockup(product, color, normalizedSide);
  if (mappedMediaPreview) return mappedMediaPreview;

  const images = [...new Set((product?.images || []).filter(Boolean))];
  if (!images.length) return '';
  const candidates = images.filter((url) => normalizedSide === 'back' ? isBackImage(url) : !isBackImage(url));
  const colored = candidates.find((url) => colorMatch(url, color));
  if (colored) return colored;
  if (candidates[0]) return candidates[0];

  // Never show a known front image as a back mockup. A neutral silhouette is safer than a false preview.
  if (normalizedSide === 'back') return '';
  return product?.images?.[0] || '';
}
