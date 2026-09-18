import fs from 'node:fs';

const seasonal = fs.readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx', 'utf8');

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

console.log('PASS Seasonal Studio V2 loading stability verification');
