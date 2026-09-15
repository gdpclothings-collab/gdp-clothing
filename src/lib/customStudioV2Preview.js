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

export function studioV2GarmentPreview(product, color, side = 'front') {
  const configured = product?.customization?.preview || {};
  const explicit = side === 'back'
    ? (configured.backImageUrl || configured.back || '')
    : (configured.frontImageUrl || configured.front || '');
  if (explicit) return explicit;

  const images = [...new Set((product?.images || []).filter(Boolean))];
  if (!images.length) return '';
  const candidates = images.filter((url) => side === 'back' ? isBackImage(url) : !isBackImage(url));
  const colored = candidates.find((url) => colorMatch(url, color));
  if (colored) return colored;
  if (candidates[0]) return candidates[0];

  // Never show a known front image as a back mockup. A neutral silhouette is safer than a false preview.
  if (side === 'back') return '';
  return product?.images?.[0] || '';
}
