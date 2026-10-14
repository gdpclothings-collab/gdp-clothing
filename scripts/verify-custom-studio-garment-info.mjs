import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { throw new Error(message); };
const expect = (condition, message) => { if (!condition) fail(message); };

const page = read('src/pages/CustomStudioV2.jsx');
const panel = read('src/components/storefront/custom-studio-v2/GarmentInfoPanel.jsx');

for (const token of [
  "GarmentInfoPanel, { garmentColorSwatch }",
  "productColors(product)",
  "productSizes(product, state.color)",
  "type: 'SET_COLOR'",
  "type: 'SET_SIZE'",
  "type: 'SET_QUANTITY'",
  'data-gdp-garment-continue="true"',
  'garmentColorSwatch(product, color)',
  '<GarmentInfoPanel product={product} sizes={sizes} />',
]) expect(page.includes(token), `Selected-garment information wiring missing: ${token}`);

for (const token of [
  'Front and Back keep independent artwork and positions.',
  'variantFor(product, state.color, state.size)',
  'const basePrice = Number(variant?.price ?? product.price ?? 0);',
  "const price = basePrice + (bothSides ? Number(settings?.frontBackFee || 0) : 0);",
  'renderSeasonalStudioV2Png(snapshot, 300)',
  'renderUploadStudioV2Png({ product, size: state.size, side, editor, dpi: 300 })',
]) expect(page.includes(token), `Protected existing Custom Studio contract changed or missing: ${token}`);

for (const token of [
  "printMethod: 'DTF'",
  'What is DTF?',
  'DTF file guidelines',
  'Must follow before printing',
  'Tips for best result',
  'DTF printing disclaimer',
  'Shipping & print care',
  'How to order',
  'size_guide_rows',
  'size_guide_note',
  'garment_disclaimer',
  'shipping_info',
  'care_instructions',
  'resolveColorSwatch',
  '300 DPI is preferred',
  'sRGB IEC61966-2.1',
  'Do not iron directly over the DTF print.',
]) expect(panel.includes(token), `Garment information contract missing: ${token}`);

for (const [label, route] of [
  ['Shipping & Delivery Policy', '/pages/shipping-delivery'],
  ['Returns & Refunds Policy', '/pages/returns-refunds'],
]) {
  expect(panel.includes(label), `Missing garment policy link label: ${label}`);
  expect(panel.includes(`<Link to="${route}"`), `Garment policy link has an incorrect route: ${route}`);
}
expect((panel.match(/<PanelButton icon=/g) || []).length === 5, 'Garment policy links must not add or remove feature cards.');
expect(panel.includes('info.shippingInfo') && panel.includes('info.careInstructions'), 'Preserve shipping and wash care content.');

expect(!page.includes('costPerItem ='), 'Garment information work must not introduce cost mutation in Custom Studio.');
expect(!panel.includes('product.price ='), 'Garment information panel must remain read-only for pricing.');

console.log('Custom Studio garment information verification passed.');
