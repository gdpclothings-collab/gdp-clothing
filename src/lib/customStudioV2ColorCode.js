// Exact, printable HEX colors shared by the protected studio text controls.
export const STUDIO_TEXT_COLOR_PRESETS = Object.freeze([
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#111111' },
  { name: 'Red', value: '#E53935' },
  { name: 'Gold', value: '#E6B84A' },
  { name: 'Royal blue', value: '#2563EB' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Purple', value: '#9333EA' },
]);

export function parseStudioHexColorCode(input) {
  if (typeof input !== 'string') return null;
  const digits = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(digits)) {
    return `#${[...digits].map((digit) => digit.repeat(2)).join('').toUpperCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(digits)) return `#${digits.toUpperCase()}`;
  return null;
}

export function studioHexColorForInput(input, fallback = '#FFFFFF') {
  return parseStudioHexColorCode(input) || parseStudioHexColorCode(fallback) || '#FFFFFF';
}
