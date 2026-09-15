import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(`Custom Studio V2 verification failed: ${message}`);
}

const app = read('src/App.jsx');
const page = read('src/pages/CustomStudioV2.jsx');
const state = read('src/lib/customStudioV2State.js');
const seasonal = read('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx');
const protectedEditor = read('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx');
const uploadEditor = read('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx');
const nav = read('src/components/storefront/StoreNav.jsx');
const combinedV2 = [page, state, seasonal, protectedEditor, uploadEditor].join('\n');

assert(app.includes('path="/custom-studio" element={<CustomStudio />}'), 'legacy /custom-studio fallback route must remain during rebuild');
assert(app.includes('path="/custom-studio-v2" element={<CustomStudioV2 />}'), 'isolated /custom-studio-v2 route is missing');
assert(!combinedV2.includes('CustomStudioAdvancedEditor'), 'V2 must not import the legacy advanced editor');
assert(!combinedV2.includes('CustomStudioShellEnhancer'), 'V2 must not import the legacy shell enhancer');
assert(!combinedV2.includes('html2canvas'), 'V2 review/editor flow must not depend on DOM screenshot rendering');

for (const path of ['seasonal', 'bootleg', 'memorial', 'upload']) {
  assert(state.includes(`id: '${path}'`), `${path} design path is missing from V2 state`);
  assert(page.includes(`state.designPath === '${path}'`) || page.includes(`state.designPath === 'bootleg' || state.designPath === 'memorial'`), `${path} editor is not wired in V2`);
}

assert(seasonal.includes('min-h-[60px]'), 'Seasonal completion control must keep a large touch target');
assert(protectedEditor.includes('min-h-[60px]'), 'Bootleg/Memorial completion control must keep a large touch target');
assert(uploadEditor.includes('min-h-[60px]'), 'Upload completion control must keep a large touch target');
assert(page.includes('Review is intentionally lightweight'), 'V2 lightweight review contract is missing');
assert(page.includes('Cart finalization remains intentionally disabled'), 'cart safety gate must remain until deterministic rendering is connected');
assert(nav.includes('onClick={mobile ? closeMobileNavigation : undefined}'), 'mobile navigation links must explicitly close the drawer');

console.log('PASS Custom Studio V2 architecture regression contract');
