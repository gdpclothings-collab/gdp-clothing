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

const entrySource = readFileSync(new URL('../src/components/storefront/SeasonalStudio.jsx', import.meta.url), 'utf8');
const studioSource = readFileSync(new URL('../src/components/storefront/SeasonalStudioLayered.jsx', import.meta.url), 'utf8');
const customStudioSource = readFileSync(new URL('../src/pages/CustomStudio.jsx', import.meta.url), 'utf8');
const timingApprovalSource = readFileSync(new URL('../src/components/storefront/custom-studio/TimingApprovalStep.jsx', import.meta.url), 'utf8');
const cartSource = readFileSync(new URL('../src/pages/Cart.jsx', import.meta.url), 'utf8');
const validationMigrationSource = readFileSync(new URL('../supabase/migrations/20260913182934_layered_seasonal_design_validation.sql', import.meta.url), 'utf8');
const sourceCheck = (source, fragment, message) => check(source.includes(fragment), message);

// Keep all existing imports stable while the implementation lives in the layered module.
sourceCheck(entrySource, "export { default } from './SeasonalStudioLayered.jsx';", 'Seasonal Studio entry point must preserve the default export.');
sourceCheck(entrySource, "export * from './SeasonalStudioLayered.jsx';", 'Seasonal Studio entry point must preserve named exports such as SeasonalOverlay.');

// Preserve Cart -> Edit design and backward compatibility with single-artwork drafts.
sourceCheck(studioSource, "initialDraft?.artworkId", 'Seasonal Studio must consume legacy saved artwork ids.');
sourceCheck(studioSource, "requested: Number(initialDraft.width || 0)", 'Seasonal Studio must restore legacy artwork sizing.');
sourceCheck(studioSource, "position: initialDraft.position || { x: 0, y: 0 }", 'Seasonal Studio must restore legacy artwork position.');
sourceCheck(studioSource, "rotation: Number(initialDraft.rotation || 0)", 'Seasonal Studio must restore legacy artwork rotation.');
sourceCheck(studioSource, "Array.isArray(initialDraft?.layers)", 'Seasonal Studio must restore layered drafts.');
sourceCheck(studioSource, "onReadyForApproval", 'Seasonal Studio must hand its prepared design to the shared approval flow.');
sourceCheck(customStudioSource, "if (editCartKey) replaceItem(editCartKey, primaryItem)", 'Editing a saved Seasonal design must replace the same cart item after shared approval.');
sourceCheck(studioSource, "approvedPreviewRef", 'Seasonal Studio must keep a dedicated approved mockup capture frame.');
sourceCheck(studioSource, "seasonalSummary", 'Seasonal cart items must retain structured production details.');
sourceCheck(studioSource, "seasonalSelection(entry.artwork, entry.layout, {}, area", 'Every visible seasonal layer must create artwork-only production configuration.');
sourceCheck(studioSource, "const artworks = allArtworks.filter((artwork) => !artwork.requires_name)", 'Templates that require customer names must not be offered in the artwork-only Seasonal flow.');
sourceCheck(cartSource, "state={{ seasonalDraft: item.seasonalDraft, editCartKey: item.key }}", 'Cart Edit design must pass the exact saved seasonal draft and cart key.');
sourceCheck(cartSource, 'approved custom preview', 'Custom cart previews must keep the approved mockup asset.');
check(
  cartSource.includes('fittingType="contain"') || cartSource.includes('object-contain transition-transform'),
  'Custom cart previews must remain uncropped.'
);

// Protect the multi-artwork layer architecture and canonical approval path.
sourceCheck(studioSource, 'const MAX_LAYERS = 10;', 'Seasonal Studio must cap layer count for predictable browser performance.');
sourceCheck(studioSource, 'const [layers, setLayers] = useState([]);', 'Seasonal Studio must use a real artwork layer stack.');
sourceCheck(studioSource, 'const addArtwork = (artwork) =>', 'Artwork library clicks must add instead of replace artwork.');
sourceCheck(studioSource, 'const reorderLayer = (id, mode) =>', 'Seasonal Studio must support z-order changes.');
sourceCheck(studioSource, "reorderLayer(activeLayer.id, 'front')", 'Selected artwork must support bring-to-front.');
sourceCheck(studioSource, "reorderLayer(activeLayer.id, 'forward')", 'Selected artwork must support one-step forward movement.');
sourceCheck(studioSource, "reorderLayer(activeLayer.id, 'backward')", 'Selected artwork must support one-step backward movement.');
sourceCheck(studioSource, "reorderLayer(activeLayer.id, 'back')", 'Selected artwork must support send-to-back.');
sourceCheck(studioSource, 'duplicateLayer(activeLayer.id)', 'Selected artwork must be duplicable.');
sourceCheck(studioSource, 'locked: !activeLayer.locked', 'Selected artwork must be lockable.');
sourceCheck(studioSource, 'visible: activeLayer.visible === false', 'Selected artwork must be hideable without deleting it.');
sourceCheck(studioSource, 'historyRef', 'Layer edits must support undo history.');
sourceCheck(studioSource, 'redoRef', 'Layer edits must support redo history.');
sourceCheck(studioSource, "seasonalConfiguration: { version: 2, layers: configurations", 'Saved seasonal designs must carry the complete ordered layer stack.');
sourceCheck(studioSource, "renderSnapshot = { version: 4, designPath: 'seasonal', layers: configurations", 'Locked production snapshots must contain the layered composition.');
sourceCheck(studioSource, 'Artwork can overlap. Layer order determines what prints in front.', 'Seasonal controls must explain intentional artwork overlap.');
sourceCheck(studioSource, 'I’m done arranging the seasonal artwork layers', 'Seasonal review must distinguish layout completion from final customer approval.');
sourceCheck(timingApprovalSource, '<strong>I approve the exact live preview shown.</strong>', 'Final approval must occur in the shared Timing & Approval step.');
sourceCheck(customStudioSource, 'data-seasonal-approved-preview', 'Shared approval must display the exact prepared Seasonal mockup.');
sourceCheck(customStudioSource, 'proofStatus: "approved"', 'Approved Seasonal cart items must retain explicit approval state.');

// The database validator must understand the same layered v2 payload the UI saves.
sourceCheck(validationMigrationSource, "s->>'version' = '2'", 'Seasonal database validation must branch for layered v2 designs.');
sourceCheck(validationMigrationSource, "jsonb_array_elements(s->'layers')", 'Seasonal database validation must inspect every saved artwork layer.');
sourceCheck(validationMigrationSource, "layer->>'source_sha256' is distinct from a.source_sha256", 'Every layered artwork must be SHA-validated against the current approved source.');
sourceCheck(validationMigrationSource, "layer_count < 1 or layer_count > 10", 'Database validation must enforce the same one-to-ten layer boundary as the editor.');
sourceCheck(validationMigrationSource, "first_artwork_id is distinct from new.seasonal_artwork_id", 'The primary seasonal artwork must match the first validated layer.');
sourceCheck(validationMigrationSource, "new.proof_required := old.proof_required;", 'Status updates must not reopen proof requirements on an immutable locked seasonal design.');
sourceCheck(validationMigrationSource, "new.proof_required := case when new.render_status = 'locked' then false else true end;", 'Locked seasonal renders must preserve no-extra-proof checkout behavior.');

// Protect the artwork-only product decision.
check(!studioSource.includes('SeasonalPersonalizationEditor'), 'Seasonal Studio must not load the personalization editor.');
check(!studioSource.includes('Personalize your design'), 'Seasonal Studio must not show Name/Message personalization.');
check(!studioSource.includes('seasonal-personalization-name'), 'Seasonal Studio must not render a customer name field.');
check(!studioSource.includes('seasonal-personalization-message'), 'Seasonal Studio must not render a customer message field.');
check(!studioSource.includes('initialDraft.text'), 'Seasonal Studio must not restore legacy customer text.');
check(!studioSource.includes('Personalization"'), 'Seasonal review must not include a personalization detail.');
sourceCheck(studioSource, '<button disabled={!approved || !visibleResolvedLayers.length}', 'Seasonal layout review must require a completed, visible layered composition before preparation.');

console.log(`${checks} seasonal sizing, layered artwork, snapshot, database-validation, edit-design, and canonical-approval regression checks passed`);