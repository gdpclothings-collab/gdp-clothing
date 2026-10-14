import fs from 'node:fs';
import { parseSizeGuideRows, SIZE_GUIDE_FIELDS, sizeGuideIsDetailed, sizeGuideVisibleFields } from '../src/lib/sizeGuideRows.js';

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
expect(panel.includes('data-gdp-size-guide-note="true"'), 'Keep the admin-editable note visible in the size guide.');
expect(panel.includes('{note && <p data-gdp-size-guide-note'), 'Do not show empty notes in the size guide.');
expect(!panel.includes('Chart measurements are for reference only; available purchase sizes are shown in the garment options.'), 'Size guides must not repeat the admin note with a second disclaimer.');
expect((panel.match(/data-gdp-size-guide-note="true"/g) || []).length === 1, 'Render exactly one size guide note.');
expect(panel.includes('data-gdp-size-guide-mobile="true"') && panel.includes('setSelectedChartSize(row.size)'), 'Keep the mobile selected-size layout intact.');
expect(panel.includes('Reference only') && panel.includes('Charted sizes may not all be available to purchase.'), 'Preserve reference-only size labels and screen-reader guidance.');



const admin = read('src/components/admin/ProductsModule.jsx');
const sizeEditor = read('src/components/admin/SizeGuideEditor.jsx');
for (const token of [
  'sizeGuideRows: parseSizeGuideRows(productMetafields.size_guide_rows)',
  'sizeGuideNote: productMetafields.size_guide_note',
  'size_guide_rows = JSON.stringify(sizeRows',
  '<SizeGuideEditor',
  'size_guide_note: form.sizeGuideNote',
]) expect(admin.includes(token), `Missing admin size-chart integration: ${token}`);
for (const token of ['onRowsChange', 'onNoteChange', 'Add size row', 'Size guide note']) {
  expect(sizeEditor.includes(token), `Missing admin measurement editor feature: ${token}`);
}
for (const token of [
  'visibleFields.map((field)',
  'sizeGuideIsDetailed(normalizedRows)',
  'Charted sizes may not all be available to purchase.',
  'data-gdp-size-guide-mobile',
  'setSelectedChartSize(row.size)',
  'aria-pressed={selectedRow?.size === row.size}',
  'sm:hidden',
  'hidden sm:block',
  'overflow-x-auto',
]) expect(panel.includes(token), `Missing responsive full-size guide feature: ${token}`);

const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const rows = sizes.map((size, index) => ({
  size,
  length: String(27 + index),
  lengthTolerance: '+/-1',
  chestTolerance: '+/-1',
  width: String(20 + index * 2),
  sleeve: `${33 + index} 1/2`,
  sleeveTolerance: '+/- 3/4',
}));
const decoded = parseSizeGuideRows(JSON.stringify(rows));
expect(decoded.length === 8 && decoded[0].size === 'S' && decoded[7].size === '5XL', 'All eight garment sizes must load.');
expect(decoded[0].width === '20' && decoded[7].width === '34', 'Chest dimensions must be preserved.');
expect(decoded[7].sleeve === '40 1/2' && decoded[1].sleeveTolerance === '+/- 3/4', 'Fractional sleeves and tolerances must survive serialization.');
expect(SIZE_GUIDE_FIELDS.length === 7 && sizeGuideIsDetailed(decoded), 'Six standard measurement types plus optional youth numerical sizes must be supported.');
expect(sizeGuideVisibleFields(decoded).length === 6, 'Adult charts must show only their six supplied measurements.');
expect(parseSizeGuideRows('S|20|27|33 1/2')[0].width === '20', 'Legacy size guides must remain compatible.');
expect(!sizeGuideIsDetailed(parseSizeGuideRows('M|22|28|34 1/2')), 'Legacy size guides must preserve legacy table layout.');
const youth = parseSizeGuideRows(JSON.stringify([
  { size: 'XS', length: '20 1/2', lengthTolerance: '-/+ 1', chestTolerance: '-/+ 1', width: '16', numericalSizes: '4' },
  { size: 'XL', length: '26 1/2', lengthTolerance: '-/+ 1', chestTolerance: '-/+ 1', width: '20', numericalSizes: '18-20' },
]));
expect(sizeGuideIsDetailed(youth) && youth[1].numericalSizes === '18-20', 'Youth numerical sizing must survive chart JSON parsing.');
expect(sizeGuideVisibleFields(youth).length === 5, 'Youth charts must exclude unavailable sleeve measurements.');
const toddler = parseSizeGuideRows(JSON.stringify([
  { size: '2T', length: '15', lengthTolerance: '-/+ 1', chestTolerance: '-/+ 1', width: '11' },
  { size: '6T', length: '19', lengthTolerance: '-/+ 1', chestTolerance: '-/+ 1', width: '15' },
]));
expect(sizeGuideVisibleFields(toddler).length === 4, 'Toddler chart must not render blank sleeve or numerical size rows.');
expect(admin.includes('"numericalSizes"'), 'Admin must persist youth numerical size values.');
expect(sizeEditor.includes('SIZE_GUIDE_FIELDS.map((field)'), 'Admin chart must render every supported measurement field.');


console.log('Custom Studio garment information verification passed.');
