import fs from 'node:fs';

// Keep this contract on every V2 production/cutover change so interaction
// parity, legacy rollback, production rendering, and cart safety cannot regress.
function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(`Custom Studio V2 verification failed: ${message}`);
}

const app = read('src/App.jsx');
const main = read('src/main.jsx');
const page = read('src/pages/CustomStudioV2.jsx');
const cart = read('src/pages/CartV2.jsx');
const state = read('src/lib/customStudioV2State.js');
const production = read('src/lib/customStudioV2Production.js');
const protectedProduction = read('src/lib/customStudioV2ProtectedProduction.js');
const assets = read('src/lib/customStudioV2Assets.js');
const preview = read('src/lib/customStudioV2Preview.js');
const mockup = read('src/lib/customStudioV2Mockup.js');
const seasonal = read('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx');
const protectedEditor = read('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx');
const uploadEditor = read('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx');
const gestures = read('src/components/storefront/custom-studio-v2/useTouchTransformV2.js');
const v2Guard = read('src/components/storefront/custom-studio-v2/CustomStudioV2PresentationGuard.jsx');
const mobileRepair = read('src/components/storefront/custom-studio-v2/customStudioV2MobileRepair.css');
const maintenanceRepair = read('src/components/storefront/maintenanceMobileRepair.css');
const nav = read('src/components/storefront/StoreNav.jsx');
const combinedV2 = [page, state, production, protectedProduction, assets, preview, mockup, seasonal, protectedEditor, uploadEditor, gestures].join('\n');

// Production cutover plus explicit rollback safety.
assert(app.includes('path="/custom-studio" element={<CustomStudioV2 />}'), 'live /custom-studio route must resolve to the rebuilt Studio');
assert(app.includes('path="/design" element={<CustomStudioV2 />}'), 'legacy /design alias must resolve to the rebuilt Studio');
assert(app.includes('path="/custom-studio-legacy" element={<CustomStudio />}'), 'dedicated legacy rollback/edit route is missing');
assert(app.includes('path="/custom-studio-v2" element={<CustomStudioV2 />}'), 'V2 compatibility route is missing');
assert(app.includes("@/components/storefront/custom-studio-v2/CustomStudioV2PresentationGuard"), 'live V2 route must pass through the scoped presentation guard');
assert(v2Guard.includes('data-gdp-studio-v2-guard="true"'), 'V2 presentation guard scope marker is missing');
assert(v2Guard.includes("import './customStudioV2MobileRepair.css';"), 'V2 phone repair stylesheet must be isolated behind the presentation guard');
assert(!combinedV2.includes('CustomStudioAdvancedEditor'), 'V2 must not import the legacy advanced editor');
assert(!combinedV2.includes('CustomStudioShellEnhancer'), 'V2 must not import the legacy shell enhancer');
assert(!combinedV2.includes('html2canvas'), 'V2 must not depend on DOM screenshot rendering');
assert(!fs.existsSync('.github/workflows/patch-v2-preview-gestures.yml'), 'temporary V2 preview patch workflow must self-delete');
assert(!fs.existsSync('.github/patch-v2-preview-gestures.py'), 'temporary V2 preview patch script must self-delete');
assert(!fs.existsSync('.github/workflows/fix-v2-upload-typecheck.yml'), 'temporary V2 typecheck workflow must self-delete');
assert(!fs.existsSync('.github/workflows/polish-custom-studio-cutover.yml'), 'temporary cutover polish workflow must self-delete');
assert(page.includes('GDP Custom Studio'), 'production Studio branding is missing');
assert(!page.includes('V2 isolated rebuild'), 'internal rebuild wording must not be customer-visible after cutover');
assert(!page.includes('Legacy Studio remains available'), 'internal rollback wording must not be customer-visible after cutover');
assert(!page.includes('No legacy approval spinner or DOM reconstruction.'), 'developer implementation wording must not be customer-visible');
assert(!page.includes("'Custom Studio V2'"), 'internal V2 label must not be persisted as customer-facing design style');

// Recording-driven maintenance and phone repair.
assert(main.includes("maintenanceMobileRepair.css"), 'maintenance mobile repair stylesheet must load globally');
assert(maintenanceRepair.includes('input[type="password"][placeholder="Access password"]'), 'maintenance repair must remain scoped to the private password field');
assert(maintenanceRepair.includes('font-size: 16px !important'), 'maintenance password field must stay at least 16px on phones to prevent iOS focus zoom');
assert(maintenanceRepair.includes('min-height: 48px !important'), 'maintenance password field must preserve a comfortable phone touch target');
assert(mobileRepair.includes('@media (max-width: 767px)'), 'V2 regression repair must stay phone-scoped');
assert(!mobileRepair.includes('@media (min-width:'), 'V2 regression repair must not alter tablet/desktop breakpoints');
assert(mobileRepair.includes('[data-gdp-studio-v2-guard="true"]'), 'V2 repair rules must be scoped to the rebuilt Studio guard');
assert(mobileRepair.includes('overflow-x: clip'), 'V2 phone repair must contain horizontal card overlap');
assert(mobileRepair.includes('contain: layout paint'), 'V2 phone canvases must isolate layout/paint to stabilize transformed artwork');
assert(mobileRepair.includes('[style*="transform"]'), 'V2 transformed artwork layers need a scoped repaint guard');
assert(mobileRepair.includes('env(safe-area-inset-bottom)'), 'V2 mobile actions must respect the phone safe area');
assert(page.includes('gdp-custom-studio-v2-actions'), 'V2 bottom actions need a stable scoped class');
assert(mobileRepair.includes('.gdp-custom-studio-v2-actions'), 'V2 phone repair must keep bottom actions in normal flow');
assert(mobileRepair.includes('position: static !important'), 'V2 phone actions must not cover editor controls');
for (const token of ['customerApi', 'supabase', 'stripe', 'addItem(', 'replaceItem(', 'createCustomDesign']) {
  assert(!mobileRepair.toLowerCase().includes(token.toLowerCase()), `presentation-only V2 repair must not contain business wiring token: ${token}`);
}

// All four paths and independent Front/Back state.
for (const path of ['seasonal', 'bootleg', 'memorial', 'upload']) {
  assert(state.includes(`id: '${path}'`), `${path} design path is missing from V2 state`);
  assert(page.includes(`state.designPath === '${path}'`) || page.includes(`state.designPath === 'bootleg' || state.designPath === 'memorial'`), `${path} editor is not wired in V2`);
}
assert(state.includes("{ id: 'approval', label: 'Approval' }"), 'Timing & Approval step is missing');
assert(state.includes('sides: pathSides'), 'front/back editor state must be independent');
assert(state.includes('studioV2PrintableSides'), 'printable-side resolver is missing');
assert(state.includes('photos: []'), 'protected editor multi-photo state is missing');
assert(state.includes('stickers: []'), 'protected editor sticker state is missing');
assert(state.includes('textStyle:'), 'protected editor text-style state is missing');
assert(state.includes("case 'SET_QUANTITY'"), 'V2 quantity state is missing');

// Selected garment options must live directly under the selected garment only.
assert(page.includes('function GarmentVariantControls'), 'selected-garment option panel is missing');
assert(page.includes('data-gdp-selected-garment-options="true"'), 'selected-garment option panel needs a stable regression marker');
assert(page.includes('{selected && <GarmentVariantControls'), 'color/size/quantity options must render only below the selected garment');
assert(page.includes('aria-pressed={selected}'), 'garment selection state must be exposed accessibly');
assert(page.includes('data-gdp-garment-continue="true"'), 'Step 1 Continue must live under the selected garment options');
assert(page.includes('onContinue={next} canContinue={canContinue}'), 'inline garment Continue must reuse the canonical next/canContinue flow');
assert(page.includes("state.step !== 'review' && state.step !== 'garment'"), 'detached bottom action bar must be hidden on the garment step');
assert(page.includes('gdp-custom-studio-v2-actions relative'), 'V2 navigation actions must remain in normal flow instead of covering the editor');

// Mobile/direct manipulation parity.
assert(gestures.includes("mode: 'drag'"), 'shared one-finger drag gesture is missing');
assert(gestures.includes("mode: 'pinch'"), 'shared two-finger pinch gesture is missing');
assert(gestures.includes('rotation: normalizeAngle'), 'pinch rotation normalization is missing');
assert(gestures.includes("touchAction: enabled ? 'none' : 'auto'"), 'touch-action protection is missing');
assert(seasonal.includes("mode: 'pinch'"), 'Seasonal two-finger pinch/rotate is missing');
assert(seasonal.includes('onPointerMove={move}'), 'Seasonal direct manipulation is missing');
assert(seasonal.includes('Drag to move · pinch or use the controls to resize and rotate'), 'Seasonal cross-device gesture guidance is missing');
assert(protectedEditor.includes('useTouchTransformV2'), 'Bootleg/Memorial touch manipulation is missing');
assert(protectedEditor.includes('One finger moves · two fingers pinch/rotate'), 'Bootleg/Memorial gesture guidance is missing');
assert(uploadEditor.includes('useTouchTransformV2'), 'Upload editor touch manipulation is missing');

// Protected editor parity without unlocking GDP templates.
assert(protectedEditor.includes('multiple accept="image/png,image/jpeg,image/webp"'), 'multi-photo upload is missing');
assert(protectedEditor.includes('Up to 8 photos'), 'multi-photo limit/UX is missing');
assert(protectedEditor.includes('Duplicate photo'), 'photo duplication is missing');
assert(protectedEditor.includes('Bring photo forward'), 'photo layer ordering is missing');
assert(protectedEditor.includes('Send photo backward'), 'photo layer ordering is missing');
assert(protectedEditor.includes('Restore original background'), 'background restore is missing');
assert(protectedEditor.includes('V2_FONT_PRESETS'), 'font choices are missing');
assert(protectedEditor.includes('V2_TEXT_CURVES'), 'curved-text controls are missing');
assert(protectedEditor.includes('V2_TEXT_EFFECTS'), 'text effects are missing');
assert(protectedEditor.includes('Move text left / right'), 'direct text positioning controls are missing');
assert(protectedEditor.includes('Text rotation'), 'text rotation controls are missing');
assert(protectedEditor.includes('GDP template artwork never becomes an editable layer.'), 'locked-template contract copy is missing');

// Side-aware garment preview must never fake a back view with a known front image.
assert(preview.includes('studioV2GarmentPreview'), 'side-aware garment preview helper is missing');
assert(preview.includes("if (side === 'back') return '';"), 'back preview must fall back safely instead of showing a known front image');
assert(seasonal.includes('studioV2GarmentPreview'), 'Seasonal side-aware garment preview is missing');
assert(protectedEditor.includes('studioV2GarmentPreview'), 'Bootleg/Memorial side-aware garment preview is missing');
assert(uploadEditor.includes('studioV2GarmentPreview'), 'Upload side-aware garment preview is missing');

// Approval and finalization safety.
assert(page.includes('I have permission to use this artwork/photo'), 'artwork rights confirmation is missing');
assert(page.includes('I approve the final print layout'), 'final layout approval is missing');
assert(page.includes('Generate, Verify & Add to Cart'), 'final production/cart action is missing');
assert(page.includes('Approved layout ready to build'), 'review must describe pre-production state truthfully');
assert(!page.includes('Locked state ready for production'), 'review must not claim production lock before files exist');
assert(page.includes("state.designPath === 'seasonal' && sourceAssets.length === 0"), 'Seasonal persistence fallback must be narrowly scoped');
assert(page.includes('persistedArtworkAssets'), 'Seasonal generated production assets must be persisted as owned artwork assets');
assert(page.includes('photoAssets: persistedArtworkAssets'), 'secure custom-design save must receive persisted Seasonal artwork assets');
assert(page.includes('customerApi.createCustomDesign'), 'V2 must persist the custom design before cart mutation');
assert(page.includes('replaceItem(editCartKey, cartItem)'), 'V2 cart edit must replace the existing line');
assert(page.includes('else addItem(cartItem)'), 'new V2 designs must add a cart line');
assert(page.indexOf('customerApi.createCustomDesign') < page.indexOf('replaceItem(editCartKey, cartItem)'), 'design save must precede edited-cart replacement');
assert(page.indexOf('customerApi.createCustomDesign') < page.indexOf('else addItem(cartItem)'), 'design save must precede new cart mutation');
assert(page.includes("navigate('/cart')"), 'successful V2 finalization must continue to cart');
assert(page.includes('frontBackFee'), 'two-sided pricing must preserve the configured front/back fee');
assert(page.includes('studioV2Draft:'), 'V2 cart items must carry a reopenable editor draft');
assert(page.includes('refreshStudioV2DraftAssets'), 'reopened V2 drafts must refresh expiring asset URLs');
assert(page.includes('The cart changes only after rendering, upload, verification and secure design saving all succeed.'), 'cart failure-safety copy/contract is missing');

// Customer-facing mockup must be distinct from production PNGs.
assert(mockup.includes('renderStudioV2CustomerMockup'), 'customer garment mockup renderer is missing');
assert(mockup.includes('productionBlob'), 'customer mockup must be derived from approved production artwork');
assert(page.includes('renderStudioV2CustomerMockup'), 'customer mockup renderer is not wired into finalization');
assert(page.includes('customerMockupPath: customerMockupUpload.storage_path'), 'custom design must persist the customer mockup path separately');
assert(page.includes('image: customerMockupUpload.file_url'), 'cart must show the customer garment mockup instead of the print PNG');
assert(page.includes("designStyle: templateNames.join(' / ') || designPathLabel"), 'customer design style must use a meaningful path label');

// Stable-path reopening for authenticated and guest uploads.
assert(assets.includes("createSignedUrl(storagePath, 3600)"), 'authenticated V2 draft URL refresh is missing');
assert(assets.includes("action: 'signGuestCustomUpload'"), 'guest V2 draft URL refresh is missing');
assert(assets.includes("for (const path of ['bootleg', 'memorial'])"), 'protected draft asset refresh is missing');
assert(assets.includes('next.upload.sides[side]'), 'upload draft asset refresh is missing');

// Cart edit compatibility: V2 reopens V2, legacy items remain on the rollback editor.
assert(cart.includes("navigate('/custom-studio-v2'"), 'V2 cart edit route is missing');
assert(cart.includes('/custom-studio-legacy?product='), 'legacy cart edit fallback route is missing');
assert(cart.includes('item.studioV2Draft?.version === 1'), 'V2 cart draft detection is missing');

// Deterministic 300-DPI production composition.
assert(production.includes('dpi = 300'), 'production renderer must default to 300 DPI');
assert(production.includes('canvas.toBlob'), 'production renderer must produce PNG output');
assert(production.includes('renderSeasonalStudioV2Png'), 'Seasonal deterministic renderer is missing');
assert(production.includes('renderUploadStudioV2Png'), 'Upload deterministic renderer is missing');
assert(production.includes("mimeType: 'image/png'"), 'production metadata must identify PNG output');
assert(page.includes('renderProtectedStudioV2PngAdvanced'), 'advanced Bootleg/Memorial renderer is not wired');
assert(protectedProduction.includes('photoLayers(editor)'), 'advanced protected renderer must compose photo layers');
assert(protectedProduction.includes('drawStyledText'), 'advanced protected renderer must compose styled text');
assert(protectedProduction.includes('drawStickers'), 'advanced protected renderer must compose stickers');
assert(protectedProduction.includes('dpi = 300'), 'advanced protected renderer must default to 300 DPI');
assert(protectedProduction.includes('canvas.toBlob'), 'advanced protected renderer must create PNG output');

// Large completion targets and mobile navigation regression fix.
assert(seasonal.includes('min-h-[60px]'), 'Seasonal completion control must keep a large touch target');
assert(protectedEditor.includes('min-h-[60px]'), 'Bootleg/Memorial completion control must keep a large touch target');
assert(uploadEditor.includes('min-h-[60px]'), 'Upload completion control must keep a large touch target');
assert(page.includes('Review your choices before the approved 300-DPI production files and customer mockup are generated.'), 'V2 lightweight review contract is missing');
assert(nav.includes('onClick={mobile ? closeMobileNavigation : undefined}'), 'mobile navigation links must explicitly close the drawer');

console.log('PASS Custom Studio production cutover, rollback, interaction parity, maintenance zoom, selected variants, Seasonal persistence, phone containment, production, mockup separation, edit, and regression contract');
