import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { throw new Error(message); };
const expect = (condition, message) => { if (!condition) fail(message); };

const production = read('src/lib/customStudioV2Production.js');
const guide = read('src/lib/customStudioV2PrintGuide.js');
const seasonal = read('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx');
const protectedEditor = read('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx');
const upload = read('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx');
const page = read('src/pages/CustomStudioV2.jsx');
const adminPanel = read('src/components/admin/PrintConfigurationPanel.jsx');

for (const token of [
  "product?.customization?.preview?.printGuide?.[side]",
  'configuredPrintProfile(product, size, normalizedSide)',
  '|| fallbackPrintProfile(product, size, normalizedSide)',
  'dpi: 300',
]) expect(production.includes(token), `Production resolver missing canonical token: ${token}`);

const matrixTokens = [
  "return { widthIn: 4, heightIn: 4, collarIn: back ? 1.75 : 1.5, side, dpi: 300 }",
  "return { widthIn: 5.5, heightIn: 5.5, collarIn: back ? 2.5 : 2, side, dpi: 300 }",
  "? { widthIn: 8.5, heightIn: 10, collarIn: 3, side, dpi: 300 }",
  ": { widthIn: 10, heightIn: 12, collarIn: 3, side, dpi: 300 }",
  "? { widthIn: 8.5, heightIn: 8.5, collarIn: 2.5, side, dpi: 300 }",
  ": { widthIn: 10.5, heightIn: 10.5, collarIn: 2.5, side, dpi: 300 }",
  "? { widthIn: 11, heightIn: 13, collarIn: 5.5, side, dpi: 300 }",
  ": { widthIn: 12, heightIn: 14, collarIn: 5.5, side, dpi: 300 }",
  "return { widthIn: 11, heightIn: 10, collarIn: 3, side, dpi: 300 }",
  "if (normalizedSize === 'S') return { widthIn: 11, heightIn: 13, collarIn: 4, side, dpi: 300 }",
  "if (normalizedSize === 'M') return { widthIn: 11.5, heightIn: 13.5, collarIn: 4, side, dpi: 300 }",
  "return { widthIn: 12, heightIn: 14, collarIn: 4, side, dpi: 300 }",
  "if (normalizedSize === 'S') return { widthIn: 10.5, heightIn: 13, collarIn: 2.75, side, dpi: 300 }",
  "if (normalizedSize === 'M') return { widthIn: 11, heightIn: 13.5, collarIn: 2.75, side, dpi: 300 }",
  "return { widthIn: 11.25, heightIn: 14, collarIn: 2.75, side, dpi: 300 }",
];
for (const token of matrixTokens) expect(production.includes(token), `Fallback matrix regression: ${token}`);

for (const token of [
  'Math.round(Number(profile.widthIn) * safeDpi)',
  'Math.round(Number(profile.heightIn) * safeDpi)',
  "mimeType: 'image/png'",
]) expect(production.includes(token), `300-DPI renderer missing: ${token}`);

for (const token of [
  'resolveStudioV2PrintProfile(product, size, normalizedSide)',
  'aspectRatio: `${Number(profile.widthIn)} / ${Number(profile.heightIn)}`',
  'Recommended print area:',
]) expect(guide.includes(token), `Visual guide is no longer tied to production profile: ${token}`);

for (const [name, source] of [
  ['Seasonal', seasonal],
  ['Photo Bootleg / Memorial', protectedEditor],
  ['Upload Artwork', upload],
]) {
  expect(source.includes('resolveStudioV2PrintGuide'), `${name} editor does not use the common print guide.`);
  expect(source.includes('data-gdp-print-guide="true"'), `${name} editor does not expose the canonical visual guide.`);
}

for (const token of [
  "p_product: product.id, p_size: size, p_side: side",
  '[product.id, size, side]',
]) expect(seasonal.includes(token), `Seasonal RPC wiring is not size/side aware: ${token}`);

for (const token of [
  "width: '72%'",
  "height: '72%'",
  'object-contain',
  'Part of your design is outside the recommended print area.',
  'isOutsideRecommendedArea',
]) expect(upload.includes(token), `Upload safe-area behavior missing: ${token}`);

for (const token of [
  "['front', 'back'].map",
  'state.side === value',
  'Front and Back keep independent artwork and positions.',
  'studioV2SideHasContent(state, value)',
]) expect(page.includes(token), `Custom Studio Front/Back isolation evidence missing: ${token}`);

for (const token of [
  'Print Configuration',
  'Database first · fallback protected',
  'Allow per-size overrides',
  'Width (in)',
  'Height (in)',
  'Collar offset (in)',
  'Product default',
  'Code fallback',
  'Size override',
]) expect(adminPanel.includes(token), `Admin Print Configuration contract missing: ${token}`);

expect(!production.includes('return { widthIn: 11.5, heightIn: 13, collarIn: 3, side, dpi: 300 }'), 'Old 11.5 × 13 hoodie front profile reintroduced.');
expect(production.includes("return { widthIn: 11, heightIn: 10, collarIn: 3, side, dpi: 300 }"), 'Hoodie front 11 × 10 production guard missing.');

console.log('Custom Studio print pipeline verification passed.');
