import assert from 'node:assert/strict';
import fs from 'node:fs';

const studio = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');
const layout = fs.readFileSync('src/components/storefront/Layout.jsx', 'utf8');
const nav = fs.readFileSync('src/components/storefront/StoreNav.jsx', 'utf8');
const dock = fs.readFileSync('src/components/storefront/CustomStudioNavigationDock.jsx', 'utf8');
const controls = fs.readFileSync('src/components/storefront/CustomStudioProtectedArtworkControls.jsx', 'utf8');
const css = fs.readFileSync('src/components/storefront/customStudioTouchRefinement.css', 'utf8');
const main = fs.readFileSync('src/main.jsx', 'utf8');

const check = (condition, message) => assert.ok(condition, message);

check(main.includes('customStudioTouchRefinement.css'), 'Touch Studio refinement CSS must load after the established layout layers.');
check(layout.includes('CustomStudioNavigationDock') && layout.includes('Custom Studio | GDP Clothing'), 'Custom Studio must own the canonical page title and bottom navigation dock.');
check(nav.includes('normalizeNavigationItem') && nav.includes('Custom Studio'), 'CMS navigation labels for the Custom Studio route must normalize to Custom Studio.');

check(dock.includes('button.click()'), 'Navigation dock must delegate to the canonical Studio buttons instead of duplicating workflow handlers.');
check(dock.includes('source.primary?.disabled') && dock.includes('aria-disabled'), 'Navigation dock must mirror canonical final-action and validation state.');
check(!dock.includes('addItem(') && !dock.includes('createCustomDesign('), 'Navigation dock must not implement cart or design persistence itself.');

check(css.includes('#gdp-touch-studio-panel') && css.includes('position: relative !important'), 'Touch Studio must not remain nested-sticky on desktop.');
check(css.includes('height: 100% !important') && css.includes('overflow-y: auto !important'), 'Touch Studio must fill its peer card and scroll internally.');
check(css.includes('[data-touch-studio-card="true"]'), 'Touch Studio card must share explicit peer-card geometry with the garment preview.');
check(css.includes('background: #f8fafb !important'), 'Touch Studio must use the neutral visual treatment.');

check(controls.includes('Remove artwork') && controls.includes('onScaleChange') && controls.includes('onRotationChange'), 'Protected artwork must expose resize, rotate and remove controls.');
check(studio.includes('CustomStudioProtectedArtworkControls'), 'Protected artwork controls must be wired into Step 3.');
check(studio.includes('templateLayerStyle'), 'Protected template transform must be applied to the rendered template layer.');
check(studio.includes('...templateLayerStyle'), 'Protected template transform must affect the exact live/production template image.');
check(studio.includes('onRemove={chooseNoTemplate}'), 'Removing protected artwork must reuse the canonical template-removal workflow.');
check(studio.includes('data-touch-studio-card'), 'Step 3 editor column must expose the stable Touch Studio card hook.');
check(!studio.includes('customers cannot resize, stretch, rotate, delete or erase the selected GDP artwork'), 'Outdated protected-artwork restriction copy must be removed.');

check(studio.includes('Choose design path') && studio.includes('Customize safely'), 'View Guide copy must clearly explain the design-path and customization stages.');
check(css.includes('gdp-custom-guide-close') && css.includes('data-guide-open'), 'View Guide must retain accessible close/backdrop behavior with refined desktop presentation.');

console.log('PASS GDP Touch Studio refinement guard');
console.log('- editor and preview use stable peer-card geometry');
console.log('- protected artwork uses canonical transform/removal state');
console.log('- navigation delegates to existing workflow handlers');
console.log('- page naming and View Guide wording are normalized');
