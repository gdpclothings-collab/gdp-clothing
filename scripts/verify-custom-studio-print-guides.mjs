import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { throw new Error(message); };

const production = read('src/lib/customStudioV2Production.js');
const helper = read('src/lib/customStudioV2PrintGuide.js');
const mockup = read('src/lib/customStudioV2Mockup.js');
const seasonal = read('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx');
const protectedEditor = read('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx');
const upload = read('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx');
const studio = read('src/pages/CustomStudioV2.jsx');
const migration = read('supabase/migrations/20260917021000_recommended_apparel_print_guides_v2.sql');

for (const token of ['customization?.preview?.printGuide', 'widthIn: 11, heightIn: 10', 'widthIn: 4, heightIn: 4', 'widthIn: 5.5, heightIn: 5.5', 'widthIn: 10.5, heightIn: 10.5']) {
  if (!production.includes(token)) fail(`Production profile missing calibrated token: ${token}`);
}
for (const kind of ['baby', 'toddler', 'youth', 'hoodie', 'crewneck', 'adult']) {
  if (!helper.includes(`${kind}:`)) fail(`Missing ${kind} display calibration.`);
}
if (!helper.includes('recommendationLabel')) fail('Recommended print area label is missing.');
if (!helper.includes('const sideLabel = normalizedSide.toUpperCase()')) fail('Print-guide label is not side-aware.');
if (!helper.includes('label: `${sideLabel} DTF MAX ${dimensions}`')) fail('Visible print-guide label does not identify FRONT/BACK.');
if (!helper.includes('recommendationLabel: `DTF maximum ${normalizedSide} print area: ${dimensions}`')) fail('Recommended print-area text does not identify the active side.');
if (!helper.includes('sizeGuideBodyWidthIn')) fail('Print-guide preview does not use garment size-guide body width.');
if (!helper.includes('configuredBodyWidthIn')) fail('Product-specific garment-width override support is missing.');
if (!helper.includes('bodyVisualWidthPercent')) fail('Garment-body visual calibration is missing.');
if (!helper.includes('configuredPreviewPrintArea')) fail('Product-specific preview print-area geometry support is missing.');
if (!helper.includes('product?.customization?.preview?.printArea?.[side]')) fail('Preview print-area calibration is not sourced from product configuration.');
if (!helper.includes('widthPercent = configuredArea?.widthPercent ?? fallbackWidthPercent')) fail('Product preview width does not override generic body-width scaling.');
if (!helper.includes('topPercent = configuredArea?.topPercent ?? geometry.topPercent')) fail('Product preview top position does not override generic garment placement.');
if (!helper.includes("source: configuredArea ? 'product-print-area' : bodyWidthSource")) fail('Product preview calibration source is not exposed for diagnostics.');
if (helper.includes('maxVisualWidth')) fail('Legacy whole-canvas maxVisualWidth scaling is still active.');

const hoodieGeometry = helper.match(/hoodie:\s*\{\s*bodyVisualWidthPercent:\s*([0-9.]+)/);
if (!hoodieGeometry) fail('Hoodie visual-body fallback calibration is missing.');
const hoodieBodyVisualWidth = Number(hoodieGeometry[1]);
if (Math.abs(hoodieBodyVisualWidth - 59) > 0.01) fail(`Hoodie fallback mockup calibration regressed: expected 59%, received ${hoodieBodyVisualWidth}%.`);
const hoodieXLPrintCanvasPercent = Math.round(hoodieBodyVisualWidth * (11 / 26) * 10) / 10;
if (Math.abs(hoodieXLPrintCanvasPercent - 25) > 0.1) fail(`Fallback XL hoodie 11 in print should occupy about 25% of the 4:5 preview canvas when no product printArea exists; received ${hoodieXLPrintCanvasPercent}%.`);

if (!seasonal.includes('p_side: side')) fail('Seasonal library is not side-aware.');
if (!seasonal.includes('seasonalCatalogKey(product?.id, size, side)')) fail('Seasonal catalog key does not include product, size and side.');
if (!seasonal.includes('[product?.id, size, side]')) fail('Seasonal print guide will not recompute when product, size or side changes.');
for (const [name, source] of [['seasonal', seasonal], ['protected', protectedEditor], ['upload', upload]]) {
  if (!source.includes('resolveStudioV2PrintGuide(product, size, side, color)')) fail(`${name} print guide must use the active garment color.`);
}
if (!studio.includes('color: state.color,\n      });')) fail('Customer mockup does not receive the active garment color.');
if (!seasonal.includes('[product.id, size, side, requestKey, retryVersion]')) fail('Seasonal side/size change will not refresh its physical artwork area.');
for (const [name, source] of [['seasonal', seasonal], ['protected', protectedEditor], ['upload', upload]]) {
  if (!source.includes('data-gdp-print-guide="true"')) fail(`${name} editor is missing the calibrated print guide.`);
  if (!source.includes('printGuide.label')) fail(`${name} editor does not show print dimensions.`);
}
for (const token of ['"widthIn":11,"heightIn":10', '"widthIn":4,"heightIn":4', '"widthIn":5.5,"heightIn":5.5', '"widthIn":10.5,"heightIn":10.5', 'p_side text']) {
  if (!migration.includes(token)) fail(`Database migration missing calibrated token: ${token}`);
}
if (!studio.includes('size={state.size} settings={settings}')) fail('Protected editor is not receiving selected size.');
if (!studio.includes('size={state.size} side={state.side} editor={currentEditor}')) fail('Upload editor is not receiving selected size.');
if (!studio.includes('product,\n        size: state.size,\n        side: firstSide')) fail('Customer mockup is not receiving the selected garment, size and side.');
if (!mockup.includes('resolveStudioV2PrintGuide(product, size, side, color)')) fail('Customer mockup does not use the shared color-calibrated print guide.');
if (mockup.includes('canvas.width * 0.42')) fail('Legacy fixed 42% customer-mockup scale is still active.');
if (!mockup.includes('printHeightIn / printWidthIn')) fail('Customer mockup is not preserving the physical print-area aspect ratio.');

// Functional regression: a mixed Kids product must use the toddler neck/chest
// calibration for 2T–5T without moving its YS/YM youth counterparts.
const isolatedPrintGuide = helper.replace(
  "import { resolveStudioV2PrintProfile } from '@/lib/customStudioV2Production';",
  "const resolveStudioV2PrintProfile = (_product, size) => /^[2-5]T$/.test(String(size)) ? { widthIn: 5.5, heightIn: 5.5 } : { widthIn: 10.5, heightIn: 10.5 };"
);
const { resolveStudioV2PrintGuide } = await import(
  `data:text/javascript;base64,${Buffer.from(isolatedPrintGuide).toString('base64')}`
);
const mixedKidsTee = { name: 'Kids Custom Tee', type: 'Kids' };
for (const toddlerSize of ['2T', '3T', '4T', '5T']) {
  const preview = resolveStudioV2PrintGuide(mixedKidsTee, toddlerSize, 'front');
  if (preview.displayCalibration.garmentKind !== 'toddler' || preview.displayCalibration.topPercent !== 28) {
    fail(`The ${toddlerSize} print box must sit at the toddler neckline-safe front offset.`);
  }
}
// Both print sides follow the size-specific mockup family; the backend print
// dimensions remain unchanged while the display box clears the collar.
const toddlerBack = resolveStudioV2PrintGuide(mixedKidsTee, '2T', 'back');
const youthBack = resolveStudioV2PrintGuide(mixedKidsTee, 'YS', 'back');
if (toddlerBack.displayCalibration.garmentKind !== 'toddler' || toddlerBack.displayCalibration.topPercent !== 26) {
  fail('Toddler back preview must use its separate neckline offset.');
}
if (youthBack.displayCalibration.garmentKind !== 'youth' || youthBack.displayCalibration.topPercent !== 24) {
  fail('Youth back preview must retain its original neckline offset.');
}
const youthPreview = resolveStudioV2PrintGuide(mixedKidsTee, 'YS', 'front');
if (youthPreview.displayCalibration.garmentKind !== 'youth' || youthPreview.displayCalibration.topPercent !== 25) {
  fail('Youth sizes must retain their independent youth neckline alignment.');
}
const unchangedOverride = resolveStudioV2PrintGuide(
  { ...mixedKidsTee, customization: { preview: { printArea: { front: { width: 22, top: 31 } } } } },
  '2T',
  'front'
);
if (unchangedOverride.displayCalibration.topPercent !== 31 || unchangedOverride.displayCalibration.printWidthPercent !== 22) {
  fail('Explicit product mockup calibration must remain authoritative.');
}

const crewneck = {
  name: 'Gildan® Crewneck Adult Sweatshirt',
  type: 'Crewneck Sweatshirt',
  customization: { preview: {
    printArea: { front: { top: 30, width: 30 }, back: { top: 30, width: 32 } },
    printAreaByColor: {
      Gray: { front: { top: 27, width: 35 }, back: { top: 25, width: 36 } },
      Black: { front: { top: 29, width: 33 }, back: { top: 27, width: 35 } },
    },
  } },
};
for (const [color, side, expectedTop, expectedWidth] of [
  ['White', 'front', 30, 30], ['White', 'back', 30, 32],
  ['Gray', 'front', 27, 35], ['Gray', 'back', 25, 36],
  ['Black', 'front', 29, 33], ['Black', 'back', 27, 35],
  ['gray', 'front', 27, 35], ['Uncalibrated', 'back', 30, 32],
]) {
  const guide = resolveStudioV2PrintGuide(crewneck, 'M', side, color);
  if (guide.displayCalibration.topPercent !== expectedTop || guide.displayCalibration.printWidthPercent !== expectedWidth) {
    fail(`Color-specific ${color} ${side} crewneck calibration did not match approved photograph framing.`);
  }
}
const reference = resolveStudioV2PrintGuide(crewneck, 'M', 'front', 'White');
const dark = resolveStudioV2PrintGuide(crewneck, 'M', 'front', 'Black');
if (reference.widthIn !== dark.widthIn || reference.heightIn !== dark.heightIn) {
  fail('Color-specific preview calibration must not alter actual production dimensions.');
}

console.log('Custom Studio recommended print guide verification passed.');
