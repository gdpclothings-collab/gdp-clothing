import fs from 'node:fs';

const seasonal = fs.readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx', 'utf8');
const production = fs.readFileSync('src/lib/customStudioV2Production.js', 'utf8');

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

const layerStart = seasonal.indexOf('function ArtworkLayer');
const layerEnd = seasonal.indexOf('function ToolbarButton');
expect(layerStart >= 0 && layerEnd > layerStart, 'ArtworkLayer remains isolated for inspection');
const layer = seasonal.slice(layerStart, layerEnd);

expect(layer.includes('data-seasonal-v2-layer'), 'stable interactive layer marker is present');
expect(layer.includes('data-seasonal-v2-layer-visual'), 'single isolated visual surface is present');
expect((layer.match(/data-seasonal-v2-layer-visual/g) || []).length === 1, 'each ArtworkLayer defines only one visual surface');
expect((layer.match(/<img/g) || []).length === 1, 'each ArtworkLayer renders only one artwork image');
expect(layer.includes("const visualTransform = Math.abs(rotation) > 0.001 ? `rotate(${rotation}deg)` : 'none';"), 'zero-degree artwork avoids unnecessary transform compositing');
expect(layer.includes("isolation: 'isolate'"), 'interactive layer creates an isolated stacking context');
expect(layer.includes('transform: visualTransform'), 'rotation belongs to the isolated artwork visual');
expect(layer.includes("backfaceVisibility: 'hidden'"), 'visual surface has compositor repaint hardening');
expect(layer.includes("WebkitBackfaceVisibility: 'hidden'"), 'WebKit visual repaint hardening is preserved');
expect(layer.includes("willChange: visualTransform === 'none' ? 'auto' : 'transform'"), 'GPU transform hint is active only while rotation needs it');

const buttonMarker = layer.indexOf('data-seasonal-v2-layer');
const buttonStyleStart = layer.indexOf('style={{', buttonMarker);
const buttonStyleEnd = layer.indexOf('}}', buttonStyleStart);
expect(buttonStyleStart >= 0 && buttonStyleEnd > buttonStyleStart, 'interactive layer style block is inspectable');
const buttonStyle = layer.slice(buttonStyleStart, buttonStyleEnd);
expect(!buttonStyle.includes('transform:'), 'interactive position/size surface must not also own rotation transform');
expect(buttonStyle.includes('left:') && buttonStyle.includes('top:') && buttonStyle.includes('width:') && buttonStyle.includes('height:'), 'interactive layer still owns canonical layout geometry');

expect(seasonal.includes('<ArtworkLayer key={entry.layer.id}'), 'React identity remains tied to the canonical layer id');
expect(seasonal.includes("commit(layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer), id);"), 'transform updates still patch one existing layer instead of creating copies');
expect(seasonal.includes("onTransform={(id, patch) => patchLayer(id, patch)}"), 'direct manipulation still uses the existing canonical patch path');
expect(production.includes('renderSeasonalStudioV2Png'), '300-DPI Seasonal production renderer remains present and separate from preview repair');
expect(!layer.includes('renderSeasonalStudioV2Png'), 'live preview layer does not take over production rendering');

console.log('PASS: Seasonal V2 artwork ghosting repair contract');
