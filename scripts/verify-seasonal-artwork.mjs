import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitSeasonalArtwork, seasonalSelection } from '../src/lib/seasonalArtwork.js';

let checks = 0;
const check = (test, message = 'Seasonal verification failed') => { assert.ok(test, message); checks++; };
const art = { id: 'fixture', source_sha256: 'version1', aspect_ratio: 2, max_width_in: 8, max_height_in: 4, customizable: true };

for (const area of [{ width: 4, height: 5 }, { width: 10, height: 11 }, { width: 6, height: 7 }]) {
  for (const width of [0, .1, 2, 100, -1]) {
    const box = fitSeasonalArtwork(art, area, width, 999, -50);
    check(box.width <= art.max_width_in && box.height <= art.max_height_in);
    check(box.x >= 0 && box.y >= 0 && box.x + box.width <= area.width + .0001 && box.y + box.height <= area.height + .0001);
    check(Math.abs(box.width / box.height - art.aspect_ratio) < .0001);
  }
}

check(fitSeasonalArtwork(null, { width: 10, height: 10 }, 5) === null);
check(fitSeasonalArtwork({ ...art, aspect_ratio: NaN }, { width: 10, height: 10 }, 5) === null);
const layout = fitSeasonalArtwork(art, { width: 10, height: 10 }, 5);
const configured = seasonalSelection(art, layout, { name: 'SHOULD NOT PRINT', message: 'SHOULD NOT PRINT' }, { width: 10, height: 10 }, 22);
check(configured.source_sha256 === 'version1' && configured.width === 5);
check(configured.version === 3, 'Seasonal configuration should use the artwork-only snapshot version.');
check(configured.name === '' && configured.message === '', 'Seasonal production must discard any customer name or message.');
check(configured.rotation === 22, 'Seasonal production must preserve artwork rotation.');

const studioSource = readFileSync(new URL('../src/components/storefront/SeasonalStudio.jsx', import.meta.url), 'utf8');
const cartSource = readFileSync(new URL('../src/pages/Cart.jsx', import.meta.url), 'utf8');
const sourceCheck = (source, fragment, message) => check(source.includes(fragment), message);

// Preserve the artwork editor and Cart -> Edit design flow.
sourceCheck(studioSource, "initialDraft?.artworkId", 'Seasonal Studio must consume the saved artwork id.');
sourceCheck(studioSource, "setRequested(Number(initialDraft.width || 0))", 'Seasonal Studio must restore saved artwork sizing.');
sourceCheck(studioSource, "setPosition(initialDraft.position || { x: 0, y: 0 })", 'Seasonal Studio must restore saved artwork position.');
sourceCheck(studioSource, "setRotation(Number(initialDraft.rotation || 0))", 'Seasonal Studio must restore saved artwork rotation.');
sourceCheck(studioSource, "if (editCartKey) replaceItem(editCartKey, cartItem)", 'Editing a saved design must replace the same cart item.');
sourceCheck(studioSource, "approvedPreviewRef", 'Seasonal Studio must keep a dedicated approved mockup capture frame.');
sourceCheck(studioSource, "seasonalSummary", 'Seasonal cart items must retain structured production details.');
sourceCheck(studioSource, "seasonalSelection(selected, layout, {}, area, rotation)", 'Seasonal Studio must create artwork-only production configuration.');
sourceCheck(studioSource, "const artworks = allArtworks.filter((artwork) => !artwork.requires_name)", 'Templates that require customer names must not be offered in the artwork-only Seasonal flow.');
sourceCheck(cartSource, "state={{ seasonalDraft: item.seasonalDraft, editCartKey: item.key }}", 'Cart Edit design must pass the exact saved seasonal draft and cart key.');
sourceCheck(cartSource, 'approved custom preview', 'Custom cart previews must keep the approved mockup asset.');
check(
  cartSource.includes('fittingType="contain"') || cartSource.includes('object-contain transition-transform'),
  'Custom cart previews must remain uncropped.'
);

// Protect the artwork-only product decision.
check(!studioSource.includes('SeasonalPersonalizationEditor'), 'Seasonal Studio must not load the personalization editor.');
check(!studioSource.includes('Personalize your design'), 'Seasonal Studio must not show Name/Message personalization.');
check(!studioSource.includes('seasonal-personalization-name'), 'Seasonal Studio must not render a customer name field.');
check(!studioSource.includes('seasonal-personalization-message'), 'Seasonal Studio must not render a customer message field.');
check(!studioSource.includes('initialDraft.text'), 'Seasonal Studio must not restore legacy customer text.');
check(!studioSource.includes('Personalization"'), 'Seasonal review must not include a personalization detail.');
sourceCheck(studioSource, 'Seasonal Design Lab uses the selected artwork only.', 'Seasonal controls should explain the artwork-only behavior.');
sourceCheck(studioSource, 'I approve the exact garment preview, artwork size, rotation and placement.', 'Approval copy must be artwork-only.');
sourceCheck(studioSource, '<button disabled={!approved}', 'Review must not be blocked by legacy name requirements.');

console.log(`${checks} seasonal sizing, artwork-only, snapshot, and edit-design regression checks passed`);
