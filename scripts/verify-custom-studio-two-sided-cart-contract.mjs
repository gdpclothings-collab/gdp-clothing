import fs from 'node:fs';

const page = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
const fail = (message) => { throw new Error(`Custom Studio two-sided cart contract failed: ${message}`); };
const expect = (condition, message) => { if (!condition) fail(message); };

const start = page.indexOf('const finalizeToCart = async () => {');
const end = page.indexOf('\n\n  if (loading)', start);
expect(start >= 0 && end > start, 'finalizeToCart boundary could not be isolated.');
const finalize = page.slice(start, end);

const requiredTokens = [
  'const sides = studioV2PrintableSides(state);',
  'for (const side of sides)',
  'sideSnapshots[side] = snapshot;',
  'renderedSides[side] = rendered;',
  'uploads[side] = upload;',
  'productionFiles[side] = {',
  'dpi: rendered.dpi',
  "const renderSnapshot = { version: 7, studio: 'v2'",
  'sides: sideSnapshots',
  'const lockedHash = await digestStudioV2Snapshot(renderSnapshot);',
  'const bothSides = sides.length > 1;',
  'basePrice + (bothSides ? Number(settings?.frontBackFee || 0) : 0)',
  "placement: bothSides ? 'front_back' : firstSide",
  'renderSnapshot,',
  'productionFiles,',
  "renderStatus: 'locked'",
  'lockedHash,',
  'expectedSides: sides',
  'studioV2Draft:',
  "step: 'customize'",
  'finalDesignApproved: false',
  "navigate('/cart')",
];
for (const token of requiredTokens) expect(finalize.includes(token), `missing locked two-sided token: ${token}`);

expect((finalize.match(/placement: bothSides \? 'front_back' : firstSide/g) || []).length >= 2,
  'front_back placement must be persisted in both the saved custom design and cart item.');
expect((finalize.match(/productionFiles,/g) || []).length >= 2,
  'productionFiles must be persisted in both the saved custom design and cart item.');
expect((finalize.match(/lockedHash,/g) || []).length >= 2,
  'lockedHash must be persisted in both the saved custom design and cart item.');

for (const token of [
  'renderSeasonalStudioV2Png(snapshot, 300)',
  'dpi: 300',
  'renderUploadStudioV2Png({ product, size: state.size, side, editor, dpi: 300 })',
]) expect(finalize.includes(token), `300-DPI side render contract missing: ${token}`);

const saveIndex = finalize.indexOf('customerApi.createCustomDesign');
const replaceIndex = finalize.indexOf('replaceItem(editCartKey, cartItem)');
const addIndex = finalize.indexOf('else addItem(cartItem)');
const navigateIndex = finalize.indexOf("navigate('/cart')");
expect(saveIndex >= 0, 'secure custom design save is missing.');
expect(replaceIndex > saveIndex, 'edited cart replacement must happen only after secure design save.');
expect(addIndex > saveIndex, 'new cart insertion must happen only after secure design save.');
expect(navigateIndex > replaceIndex && navigateIndex > addIndex, 'cart navigation must happen only after cart mutation succeeds.');

const renderLoopIndex = finalize.indexOf('for (const side of sides)');
const snapshotIndex = finalize.indexOf('sideSnapshots[side] = snapshot;');
const productionIndex = finalize.indexOf('productionFiles[side] = {');
const renderSnapshotIndex = finalize.indexOf('const renderSnapshot =');
expect(renderLoopIndex >= 0 && snapshotIndex > renderLoopIndex && productionIndex > renderLoopIndex,
  'each printable side must build both a snapshot and a production file inside the side loop.');
expect(renderSnapshotIndex > snapshotIndex && renderSnapshotIndex > productionIndex,
  'locked render snapshot must be created only after side snapshots and production files are assembled.');

expect(finalize.includes("setFinalizeError(err?.message || 'The print files could not be prepared. Your cart was not changed.');"),
  'failure path must explicitly preserve the existing cart when production preparation fails.');

console.log('Custom Studio two-sided locked production-to-cart contract verification passed.');
