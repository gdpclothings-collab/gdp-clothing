import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { throw new Error(message); };

const production = read('src/lib/customStudioV2Production.js');
const helper = read('src/lib/customStudioV2PrintGuide.js');
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
if (!seasonal.includes('p_side: side')) fail('Seasonal library is not side-aware.');
if (!seasonal.includes('[product.id, size, side]')) fail('Seasonal side change will not refresh its physical print area.');
for (const [name, source] of [['seasonal', seasonal], ['protected', protectedEditor], ['upload', upload]]) {
  if (!source.includes('data-gdp-print-guide="true"')) fail(`${name} editor is missing the calibrated print guide.`);
  if (!source.includes('printGuide.label')) fail(`${name} editor does not show print dimensions.`);
}
for (const token of ['"widthIn":11,"heightIn":10', '"widthIn":4,"heightIn":4', '"widthIn":5.5,"heightIn":5.5', '"widthIn":10.5,"heightIn":10.5', 'p_side text']) {
  if (!migration.includes(token)) fail(`Database migration missing calibrated token: ${token}`);
}
if (!studio.includes('size={state.size} settings={settings}')) fail('Protected editor is not receiving selected size.');
if (!studio.includes('size={state.size} side={state.side} editor={currentEditor}')) fail('Upload editor is not receiving selected size.');
console.log('Custom Studio recommended print guide verification passed.');
