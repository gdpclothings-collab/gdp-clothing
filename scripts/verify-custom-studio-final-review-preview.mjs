import fs from 'node:fs';

const guardPath = 'src/components/storefront/custom-studio-v2/CustomStudioV2PresentationGuard.jsx';
const pagePath = 'src/pages/CustomStudioV2.jsx';
const guard = fs.readFileSync(guardPath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');

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
assert(guard.includes("reviewPreviewSnapshots.set(side, clone.outerHTML);"), 'approved preview snapshots must remain side-aware');
assert(guard.includes("['front', 'back'].forEach((side) =>"), 'Final Review must preserve front/back ordering when both sides exist');

// Review copies must be presentation-only: no interactive editor chrome or print-guide overlays.
assert(guard.includes("clone.querySelectorAll('button,input,select,textarea').forEach((node) => node.remove());"), 'Final Review clone must remove editor controls');
assert(guard.includes("clone.querySelectorAll('[data-gdp-print-guide=\"true\"]')"), 'Final Review clone must sanitize print-guide UI');
assert(guard.includes("node.style.borderColor = 'transparent';"), 'Final Review clone must hide print-guide border');
assert(guard.includes("node.style.background = 'transparent';"), 'Final Review clone must keep garment/artwork visible without print-guide fill');
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
