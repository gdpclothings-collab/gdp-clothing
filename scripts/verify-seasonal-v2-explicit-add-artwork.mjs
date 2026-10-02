import fs from 'node:fs';

const seasonal = fs.readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx', 'utf8');
const production = fs.readFileSync('src/lib/customStudioV2Production.js', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`Seasonal explicit-add verification failed: ${message}`);
}

assert(seasonal.includes("const [addingArtwork, setAddingArtwork] = useState(false);"), 'explicit add-artwork UI state is missing');
assert(seasonal.includes('data-seasonal-v2-add-artwork="true"'), 'Add another artwork control is missing');
assert(seasonal.includes('data-seasonal-v2-cancel-add'), 'Add-artwork cancel control is missing');
assert(seasonal.includes("data-seasonal-v2-add-mode={addingArtwork ? 'adding' : 'replace'}"), 'replace/add mode must be visible to the customer');
assert(seasonal.includes("'Use this instead'"), 'normal library selection must be labelled as replacement');
assert(seasonal.includes("'Add another artwork'"), 'explicit append wording is missing');
assert(seasonal.includes('if (!currentLayers.length || addingArtwork)'), 'new layers must only append for the first artwork or explicit add mode');
assert(seasonal.includes('const targetId = currentLayers.some((layer) => layer.id === activeLayerId)'), 'replacement must target the selected canonical layer');
assert(seasonal.includes('const next = currentLayers.map((layer) => layer.id === targetId ? {'), 'replacement must update an existing layer instead of appending');
assert(seasonal.includes('setAddingArtwork(false);'), 'add mode must close after a successful append or side change');
assert(seasonal.includes('const topAlignedPosition = (layout, offsetIndex = 0) => {'), 'Seasonal artwork top-alignment helper is missing');
assert(seasonal.includes('const position = topAlignedPosition(initial, currentLayers.length);'), 'intentional extra artwork must start top-aligned with a safe horizontal offset');
assert(seasonal.includes('const position = topAlignedPosition(initial, 0);'), 'replacement artwork must restart at the top of the print area');
assert(seasonal.includes('position: topAlignedPosition(initial, 0),'), 'Reset must return Seasonal artwork to the top-aligned default');
assert(seasonal.includes("y: 0,"), 'top-aligned Seasonal placement must anchor at the print-area top');
assert(seasonal.includes('at the top of the print area with a small horizontal offset'), 'Seasonal add-mode guidance must explain the top-aligned default');
assert(!seasonal.includes('centeredPosition('), 'Seasonal default placement must no longer center artwork vertically');
assert(seasonal.includes('data-seasonal-v2-artwork-list="true"'), 'visible artwork list is missing');
assert(seasonal.includes('Artwork {index + 1}'), 'artwork list must number layers clearly');
assert(!seasonal.includes('duplicateLayer'), 'Duplicate shortcut must not bypass explicit Add Artwork mode');
assert(!seasonal.includes('label="Duplicate"'), 'Duplicate UI must not bypass explicit Add Artwork mode');
assert(seasonal.includes('commit(layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer), id);'), 'existing transform edits must still patch canonical layers');
assert(seasonal.includes('<ArtworkLayer key={entry.layer.id}'), 'canvas identity must remain tied to canonical layer IDs');
assert(seasonal.includes('setAddingArtwork(false);\n  }, [requestKey]);'), 'switching product/size/side must leave add mode safely');
assert(production.includes('renderSeasonalStudioV2Png'), '300-DPI Seasonal production renderer must remain present');
assert(!seasonal.includes('renderSeasonalStudioV2Png'), 'editor UX must not take over production rendering');

console.log('PASS Seasonal V2 explicit Add Artwork flow');
