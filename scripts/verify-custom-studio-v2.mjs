import fs from 'node:fs';

// Keep this contract on every V2 production/cutover change so isolation and cart safety cannot silently regress.
function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(`Custom Studio V2 verification failed: ${message}`);
}

const app = read('src/App.jsx');
const page = read('src/pages/CustomStudioV2.jsx');
const state = read('src/lib/customStudioV2State.js');
const production = read('src/lib/customStudioV2Production.js');
const seasonal = read('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx');
const protectedEditor = read('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx');
const uploadEditor = read('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx');
const nav = read('src/components/storefront/StoreNav.jsx');
const combinedV2 = [page, state, production, seasonal, protectedEditor, uploadEditor].join('\n');

assert(app.includes('path="/custom-studio" element={<CustomStudio />}'), 'legacy /custom-studio fallback route must remain until the final cutover PR');
assert(app.includes('path="/custom-studio-v2" element={<CustomStudioV2 />}'), 'isolated /custom-studio-v2 route is missing');
assert(!combinedV2.includes('CustomStudioAdvancedEditor'), 'V2 must not import the legacy advanced editor');
assert(!combinedV2.includes('CustomStudioShellEnhancer'), 'V2 must not import the legacy shell enhancer');
assert(!combinedV2.includes('html2canvas'), 'V2 must not depend on DOM screenshot rendering');

for (const path of ['seasonal', 'bootleg', 'memorial', 'upload']) {
  assert(state.includes(`id: '${path}'`), `${path} design path is missing from V2 state`);
  assert(page.includes(`state.designPath === '${path}'`) || page.includes(`state.designPath === 'bootleg' || state.designPath === 'memorial'`), `${path} editor is not wired in V2`);
}

assert(state.includes("{ id: 'approval', label: 'Approval' }"), 'Timing & Approval step is missing');
assert(state.includes("sides: pathSides"), 'front/back editor state must be independent');
assert(state.includes('studioV2PrintableSides'), 'printable-side resolver is missing');
assert(page.includes('I have permission to use this artwork/photo'), 'artwork rights confirmation is missing');
assert(page.includes('I approve the exact Front/Back layouts'), 'final layout approval is missing');
assert(page.includes('Approve, Lock & Add to Cart'), 'final production/cart action is missing');
assert(page.includes('customerApi.createCustomDesign'), 'V2 must persist the custom design before cart mutation');
assert(page.includes('addItem(cartItem)'), 'V2 cart finalization is not connected');
assert(page.indexOf('customerApi.createCustomDesign') < page.indexOf('addItem(cartItem)'), 'cart must be mutated only after the custom design save succeeds');
assert(page.includes("navigate('/cart')"), 'successful V2 finalization must continue to cart');
assert(page.includes('frontBackFee'), 'two-sided pricing must preserve the configured front/back fee');

assert(production.includes("dpi = 300"), 'production renderer must default to 300 DPI');
assert(production.includes("canvas.toBlob"), 'production renderer must produce PNG output');
assert(production.includes('renderSeasonalStudioV2Png'), 'Seasonal deterministic renderer is missing');
assert(production.includes('renderProtectedStudioV2Png'), 'Bootleg/Memorial deterministic renderer is missing');
assert(production.includes('renderUploadStudioV2Png'), 'Upload deterministic renderer is missing');
assert(production.includes("mimeType: 'image/png'"), 'production metadata must identify PNG output');

assert(seasonal.includes('min-h-[60px]'), 'Seasonal completion control must keep a large touch target');
assert(protectedEditor.includes('min-h-[60px]'), 'Bootleg/Memorial completion control must keep a large touch target');
assert(uploadEditor.includes('min-h-[60px]'), 'Upload completion control must keep a large touch target');
assert(page.includes('Review stays instant'), 'V2 lightweight review contract is missing');
assert(page.includes('If rendering, upload, or design saving fails, the cart is not changed.'), 'cart failure-safety copy/contract is missing');
assert(nav.includes('onClick={mobile ? closeMobileNavigation : undefined}'), 'mobile navigation links must explicitly close the drawer');

console.log('PASS Custom Studio V2 architecture and production regression contract');
