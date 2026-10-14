import fs from 'node:fs';

const guardPath = 'src/components/storefront/custom-studio-v2/CustomStudioV2PresentationGuard.jsx';
const pagePath = 'src/pages/CustomStudioV2.jsx';
const guard = fs.readFileSync(guardPath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');
const seasonalEditor = fs.readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx', 'utf8');
const protectedEditor = fs.readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
const presentationCss = fs.readFileSync('src/components/storefront/custom-studio-v2/customStudioV2PresentationCleanup.css', 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
};

const reviewStepStart = page.indexOf('function ReviewStepV2');
const editorHeadingStart = page.indexOf('function EditorHeading');
const reviewStep = reviewStepStart >= 0 && editorHeadingStart > reviewStepStart
  ? page.slice(reviewStepStart, editorHeadingStart)
  : '';

assert(reviewStep, 'ReviewStepV2 must remain present for Final Review inspection');

// Approved garment + artwork snapshot must stay sourced from the live Step 3 composition.
assert(guard.includes('const reviewPreviewSnapshots = new Map();'), 'Final Review must retain independent front/back preview snapshots');
assert(guard.includes('const snapshotLiveGarmentPreviews = () =>'), 'live Step 3 preview snapshot collector is missing');
assert(guard.includes("root.querySelectorAll('[data-gdp-print-guide=\"true\"]')"), 'snapshot collector must anchor to the live print-guide composition');
assert(guard.includes("if (guide.closest('[data-gdp-final-review-preview=\"true\"]')) return;"), 'snapshot collector must ignore its own Final Review clones');
assert(guard.includes('const clone = section.cloneNode(true);'), 'approved preview must clone the already-approved live composition instead of rebuilding geometry');
assert(seasonalEditor.includes('data-gdp-seasonal-canvas-stable="true"'), 'Seasonal Design Lab must keep its stable live garment preview');
assert(seasonalEditor.includes('Fabric workspace'), 'Seasonal canvas uses a distinct title that the snapshot collector must support');
assert(guard.includes('/live garment preview|fabric workspace/i'), 'Final Review must collect both Seasonal and standard Studio previews');
assert(guard.includes("(guide.getAttribute('aria-label') || '').match(/\\b(front|back)\\b/i)"), 'front/back snapshot labels must come from the actual live print guide');
assert(guard.includes('/drag with one finger|drag to move|dashed fabric box|dashed boundary|normalized geometry/i'), 'Final Review must remove every workspace edit hint, including the dashed fabric box explanation');

assert(seasonalEditor.includes('data-seasonal-v2-layer'), 'Seasonal artwork uses movable button layers in Step 3');
assert(guard.includes("clone.querySelectorAll('button[data-seasonal-v2-layer]')"), 'Seasonal artwork must be handled before generic editor buttons are removed');
assert(guard.includes("staticLayer.setAttribute('data-gdp-seasonal-review-artwork', 'true');"), 'Approved artwork must stay visible in its inert Final Review preview');
assert(guard.includes("staticLayer.style.cssText = layer.style.cssText;"), 'Approved artwork must preserve its exact Step 3 position, size and rotation');
assert(guard.includes("while (layer.firstChild) staticLayer.appendChild(layer.firstChild);"), 'Approved artwork image must not be discarded with its draggable button');
assert(guard.indexOf("clone.querySelectorAll('button[data-seasonal-v2-layer]')") < guard.indexOf("clone.querySelectorAll('button,input,select,textarea')"), 'Seasonal artwork must be converted before editor controls are stripped');
assert(guard.includes(String.raw`/\\bring[^\\s]*/g`) === false, 'Do not escape regex boundaries twice when removing Seasonal selection rings');


assert(guard.includes("reviewPreviewSnapshots.set(side, clone.outerHTML);"), 'approved preview snapshots must remain side-aware');
assert(guard.includes("['front', 'back'].forEach((side) =>"), 'Final Review must preserve front/back ordering when both sides exist');

// Review copies must be presentation-only: no interactive editor chrome or print-guide overlays.
assert(guard.includes("clone.querySelectorAll('button,input,select,textarea').forEach((node) => node.remove());"), 'Final Review clone must remove editor controls');
assert(guard.includes("clone.querySelectorAll('[data-gdp-print-guide=\"true\"]')"), 'Final Review clone must sanitize print-guide UI');
assert(guard.includes("node.style.borderColor = 'transparent';"), 'Final Review clone must hide print-guide border');
assert(guard.includes("node.style.boxShadow = 'none';"), 'Final Review clone must remove faint print-guide rectangle shadow');
assert(guard.includes("node.style.outline = 'none';"), 'Final Review clone must remove print-guide outline');
assert(presentationCss.includes('[data-gdp-final-review-preview="true"] [data-gdp-print-guide="true"] {'), 'shadow suppression must target Final Review only');
assert(presentationCss.includes('box-shadow: none !important;'), 'Final Review must never show a print-guide drop-shadow');
assert(guard.includes("node.style.background = 'transparent';"), 'Final Review clone must keep garment/artwork visible without print-guide fill');
assert(guard.includes("clone.querySelectorAll('[data-gdp-print-size]').forEach((node) => {"), 'Final Review clone must remove CSS-generated print-size label attributes');
assert(guard.includes("node.removeAttribute('data-gdp-print-size');"), 'Final Review must prevent the floating print-size badge from rendering');
assert(guard.includes("if (guide.closest('[data-gdp-final-review-preview=\"true\"]')) return;"), 'measurement sync must skip Final Review clones');
assert(presentationCss.includes('[data-gdp-final-review-preview="true"] [data-gdp-print-size]::before'), 'Final Review must have a scoped CSS safeguard against regenerated measurement badges');
assert(presentationCss.includes('content: none !important;'), 'approved previews must not render a measurement pseudo-element');
assert(presentationCss.includes('[data-gdp-print-size]::before'), 'Step 3 must retain its useful editable print-size badge');
assert(guard.includes("clone.querySelectorAll('p').forEach((node) => {"), 'every editor guidance paragraph needs to be evaluated');
assert(guard.includes('clone.setAttribute(\'data-gdp-final-review-preview-card\', side);'), 'sanitization must occur only on the approved preview clone');

assert(protectedEditor.includes("const isBootleg = path === 'bootleg';"), 'Bootleg needs the protected preview component');
assert(protectedEditor.includes("const isMemorial = path === 'memorial';"), 'Memorial needs the same protected preview component');
assert(protectedEditor.includes("data-gdp-bootleg-template-layer={isBootleg ? 'true' : undefined}"), 'Bootleg template remains in the live artwork composition');
assert(protectedEditor.includes("data-gdp-memorial-template-layer={isMemorial ? 'true' : undefined}"), 'Memorial template remains in the live artwork composition');
assert(protectedEditor.includes('data-gdp-bootleg-free-photo-layer'), 'Bootleg photo layers stay inside the preview');
assert(protectedEditor.includes('data-gdp-memorial-free-photo-layer'), 'Memorial photo layers stay inside the preview');
assert(protectedEditor.includes('data-gdp-bootleg-text-layer'), 'Bootleg text layers stay inside the preview');
assert(protectedEditor.includes('data-gdp-memorial-text-layer'), 'Memorial text layers stay inside the preview');
for (const selector of [
  '[data-gdp-bootleg-template-layer]',
  '[data-gdp-memorial-template-layer]',
  '[data-gdp-bootleg-free-photo-layer]',
  '[data-gdp-memorial-free-photo-layer]',
  '[data-gdp-bootleg-text-layer]',
  '[data-gdp-memorial-text-layer]',
  '[data-gdp-sticker-layer-id]',
]) assert(guard.includes(selector), 'Protected preview sanitizer is missing selector: ' + selector);
assert(guard.includes("clone.querySelectorAll('[data-gdp-bootleg-text-bounds=\"true\"]').forEach((node) => node.remove());"), 'text editor selection rectangles must not appear in Final Review');
assert(guard.includes(".replace(/\\b(?:active:)?ring[^\\s]*/g, '')"), 'protected artwork selection rings must not appear in Final Review');
assert(guard.includes(".replace(/\\bcursor-(?:grab|grabbing|move)\\b/g, 'cursor-default')"), 'protected artwork cursors must be noninteractive in Final Review');
assert(guard.includes('node.className = String(node.className ||'), 'protected artwork review cleanup must preserve each existing positioned node');
assert(guard.includes('one finger moves|choose a layer first|tap a layer in the list'), 'protected preview must hide drag/pinch instructions');
assert(guard.indexOf('const clone = section.cloneNode(true);') < guard.indexOf("clone.querySelectorAll('[data-gdp-bootleg-text-bounds"), 'protected preview cleanup must run on a clone instead of mutating the editable canvas');

assert(guard.includes("clone.querySelectorAll('[data-gdp-upload-artwork-layer=\"true\"]')"), 'uploaded artwork selection chrome must be sanitized in Final Review');
assert(guard.includes(".replace(/\\bring[^\\s]*/g, '')"), 'uploaded artwork selection ring must be removed from Final Review');
assert(guard.includes("clonedHeading.textContent = `Final garment preview · ${side}`;"), 'Final Review snapshot side label must remain explicit');

// Final Review insertion contract.
assert(guard.includes('const syncFinalReviewPreview = () =>'), 'Final Review preview synchronizer is missing');
assert(guard.includes("/^final review$/i"), 'preview synchronizer must target the Final Review step explicitly');
assert(guard.includes("container.setAttribute('data-gdp-final-review-preview', 'true');"), 'approved preview needs a stable Final Review marker');
assert(guard.includes('Your garment with the approved artwork'), 'approved-preview customer heading is missing');
assert(guard.includes('Ready for final check'), 'approved-preview readiness label is missing');
assert(guard.includes('reviewRoot.insertBefore(container, reviewGrid);'), 'approved preview must appear before the order-summary/action grid');
assert(guard.includes('syncFinalReviewPreview();'), 'approved preview synchronizer must run during presentation sync');
assert(guard.includes('new MutationObserver(syncPresentationLabels)'), 'presentation guard must continue reacting to Step 3 → Final Review transitions');

// React Final Review still confirms the selected blank/variant separately.
assert(reviewStep.includes('data-gdp-review-garment-preview="true"'), 'Final Review selected-garment confirmation is missing');
assert(reviewStep.includes("studioV2GarmentPreview(product, state.color, 'front')"), 'Final Review selected garment must stay color-aware');
assert(reviewStep.includes('object-contain'), 'Final Review selected garment must remain uncropped');

// Strong boundary: this DOM snapshot helper may never become a production/cart/data mutation path.
const forbiddenGuardTokens = [
  'customerApi',
  'createCustomDesign',
  'addItem(',
  'replaceItem(',
  'renderSeasonalStudioV2Png',
  'renderUploadStudioV2Png',
  'renderProtectedStudioV2PngAdvanced',
  'renderStudioV2CustomerMockup',
  'supabase',
  'stripe',
  'fetch(',
];
for (const token of forbiddenGuardTokens) {
  assert(!guard.toLowerCase().includes(token.toLowerCase()), `presentation guard must not contain business/production token: ${token}`);
}

// Canonical production pipeline remains owned by the page finalization flow, not the snapshot guard.
assert(page.includes('renderSeasonalStudioV2Png(snapshot, 300)'), 'Seasonal production output must remain 300 DPI');
assert(page.includes('renderProtectedStudioV2PngAdvanced({ product, size: state.size, side, editor, template, profile: resolveStudioV2PrintProfile, dpi: 300 })'), 'protected production output must remain 300 DPI');
assert(page.includes("renderUploadStudioV2Png({ product, size: state.size, side, editor, dpi: 300 })"), 'uploaded-artwork production output must remain 300 DPI');
assert(page.includes('garmentUrl: studioV2GarmentPreview(product, state.color, firstSide)'), 'customer mockup must continue using the canonical garment source');
assert(page.indexOf('customerApi.createCustomDesign') < page.indexOf('replaceItem(editCartKey, cartItem)'), 'secure design persistence must still precede edited-cart mutation');
assert(page.indexOf('customerApi.createCustomDesign') < page.indexOf('else addItem(cartItem)'), 'secure design persistence must still precede new-cart mutation');

console.log('PASS: Custom Studio approved Final Review garment + artwork preview contract');
