import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const app = read('src/App.jsx');
const page = read('src/pages/CustomStudioV2.jsx');
const guard = read('src/components/storefront/custom-studio-v2/CustomStudioV2PresentationGuard.jsx');
const panel = read('src/components/storefront/custom-studio-v2/GarmentInfoPanel.jsx');
const css = read('src/components/storefront/custom-studio-v2/customStudioV2Premium.css');
const cleanup = read('src/components/storefront/custom-studio-v2/customStudioV2PresentationCleanup.css');
const preview = read('src/lib/customStudioV2Preview.js');

assert(app.includes('path="/custom-studio" element={<CustomStudioV2 />}'), 'live studio must continue using V2');
assert(guard.includes("import './customStudioV2Premium.css';"), 'premium stylesheet must be explicitly loaded');
assert(guard.indexOf("customStudioV2PresentationCleanup.css") < guard.indexOf("customStudioV2Premium.css"), 'premium styles should load after preservation rules');
for (const marker of [
  'data-gdp-premium-studio="true"',
  'data-gdp-premium-hero="true"',
  'data-gdp-premium-rail="true"',
  'data-gdp-premium-garment-step="true"',
  'data-gdp-selected-garment-preview="true"',
  'data-gdp-color-panel="true"',
  'data-gdp-size-panel="true"',
  'data-gdp-quantity-panel="true"',
  'data-gdp-premium-next="true"',
  'data-gdp-garment-continue="true"',
]) assert(page.includes(marker), `Missing accessible presentation marker: ${marker}`);
assert(css.includes('[data-gdp-premium-studio="true"]'), 'premium styling must stay scoped to V2');
assert(css.includes('@media (max-width: 767px)'), 'mobile layout breakpoint missing');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'reduced-motion support missing');
assert(css.includes(':disabled'), 'disabled controls must retain distinct styling');
assert(panel.includes('data-gdp-premium-info-card="true"'), 'information cards must be individually actionable');
assert(panel.includes('data-gdp-premium-info-grid="true"'), 'information card grid missing');
for (const action of ["setActivePanel('details')", "setActivePanel('size')", "setActivePanel('files')", "setActivePanel('shipping')", "setActivePanel('order')", "setActivePanel('dtf')"]) {
  assert(panel.includes(action), `Lost garment information action: ${action}`);
}
for (const event of ["type: 'SET_COLOR'", "type: 'SET_SIZE'", "type: 'SET_QUANTITY'", "type: 'SELECT_PRODUCT'"]) {
  assert(page.includes(event), `Lost canonical selection event: ${event}`);
}
assert(page.includes('isProductColorAvailable(product, color)'), 'Unavailable colors must still be disabled');
assert(page.includes('isProductVariantAvailable(product, sizeVariant)'), 'Unavailable sizes must still be disabled');
assert(page.includes('disabled={!canContinue}'), 'Continue must remain availability-gated');
assert(page.includes('studioV2GarmentPreview(product, state.color'), 'Preview must still follow selected variant');
assert(preview.includes('colorMockups'), 'Canonical color-specific previews must remain');
assert(cleanup.includes('img[src*="gildan-crewneck-black-front-300dpi.jpg"]'), 'Existing crewneck image normalization must not be lost');
assert(!css.includes('[data-gdp-print-guide="true"]'), 'Purely aesthetic layer must not alter print guide geometry');
console.log('PASS: Custom Studio premium presentation and commerce isolation');
