import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { throw new Error(message); };

const panel = read('src/components/admin/PrintConfigurationPanel.jsx');
const products = read('src/components/admin/ProductsModule.jsx');
const production = read('src/lib/customStudioV2Production.js');

for (const token of [
  'Print Configuration',
  'Database first · fallback protected',
  'Width (in)',
  'Height (in)',
  'Collar offset (in)',
  'Size overrides',
  'Size override',
  'Product default',
  'Code fallback',
  'sizeOverrides',
  'collarIn',
  'resolveStudioV2PrintProfile',
  'Reset side to fallback',
  'Use default',
]) {
  if (!panel.includes(token)) fail(`Admin Print Configuration panel is missing: ${token}`);
}

if (!products.includes('PrintConfigurationPanel')) {
  fail('Products editor is not wired to the Print Configuration panel.');
}

for (const token of ['customization?.preview?.printGuide', 'sizeOverrides', 'collarIn', 'dpi: 300']) {
  if (!production.includes(token)) fail(`Production resolver is missing canonical print-guide token: ${token}`);
}

if (!production.includes('configuredPrintProfile(product, size, normalizedSide)')) {
  fail('Database-backed print profile is not evaluated before fallback.');
}

if (!production.includes('|| fallbackPrintProfile(product, size, normalizedSide)')) {
  fail('Verified code fallback protection is missing.');
}

console.log('Admin Print Configuration verification passed.');
