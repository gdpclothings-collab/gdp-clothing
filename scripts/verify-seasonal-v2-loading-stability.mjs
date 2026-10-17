import fs from 'node:fs';

const seasonal = fs.readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx', 'utf8');
const polish = fs.readFileSync('src/components/storefront/custom-studio-v2/customStudioV2PresentationCleanup.css', 'utf8');
const logo = fs.readFileSync('src/components/storefront/storeNavLogo3d.css', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Seasonal Studio V2 stability verification failed: ${message}`);
}

assert(seasonal.includes('const seasonalCatalogCache = new Map();'), 'session catalog caching is missing');
assert(seasonal.includes('const seasonalArtworkPreviewCache = new Map();'), 'artwork preview caching is missing');
assert(seasonal.includes('preloadArtworkPreview'), 'artwork must preload before being committed to the canvas');
assert(seasonal.includes('data-gdp-seasonal-canvas-stable="true"'), 'stable garment canvas boundary is missing');
assert(seasonal.includes('libraryBusy'), 'library loading must have an isolated state');
assert(!seasonal.includes('if (!catalog && !error)'), 'library loading must never replace/unmount the entire Seasonal editor');
assert(!seasonal.includes('setCatalog(null)'), 'catalog refresh must not destructively clear the live workspace');
assert(seasonal.includes('Your current design was kept. Try again.'), 'artwork load failure must preserve the existing design');
assert(seasonal.includes('requestKeyRef.current !== selectionKey'), 'stale artwork requests must not commit after side/size changes');
assert(seasonal.includes('layersRef.current'), 'async artwork commits must use the latest layer state');
assert(seasonal.includes('disabled={!layers.length || !catalog || Boolean(pendingArtworkId)}'), 'approval must be blocked while artwork/catalog state is unresolved');


// Presentation refinements must not perturb live artwork or canvas dimensions.
assert(seasonal.includes('data-gdp-seasonal-category-scroll="true"'), 'Seasonal category strip must keep a scoped scroll surface');
assert(seasonal.includes('data-gdp-seasonal-artwork-scroll="true"'), 'Seasonal artwork list must keep a scoped scroll surface');
assert(polish.includes('[data-gdp-seasonal-category-scroll="true"]'), 'category scrollbars must be styled only within Studio');
assert(polish.includes('[data-gdp-seasonal-artwork-scroll="true"]'), 'artwork scrollbars must be styled only within Studio');
assert(seasonal.includes("No artwork on this side yet"), 'empty side must not flash a loading placeholder over the garment');
assert(!seasonal.includes('Refreshing artwork library…'), 'fabric preview must not flash catalog loading text');
assert(seasonal.includes('data-gdp-print-guide="true" data-gdp-print-side={side}'), 'seasonal print guide and side identity must remain unchanged');
assert(logo.includes('rotateY(-10deg)') && logo.includes('rotateY(10deg)'), 'nav logo must stay readable during the motion cycle');
assert(!logo.includes('rotateY(360deg)'), 'nav logo must not rotate edge-on during animation');
assert(logo.includes('@media (prefers-reduced-motion: reduce)'), 'logo animation must respect reduced-motion settings');

console.log('PASS Seasonal Studio V2 loading stability verification');
