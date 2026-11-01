import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reorderSeasonalArtworkLayers } from '../src/lib/seasonalLayerReorder.js';

const seasonal = readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx', 'utf8');
const upload = readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx', 'utf8');
const print = readFileSync('src/lib/seasonalArtwork.js', 'utf8');

test('seasonal drag rows express top-to-bottom stacking without mutating saved layers', () => {
  const layers = [
    { id: 'bottom', artworkId: 'a', rotation: 0, visible: true },
    { id: 'middle', artworkId: 'b', rotation: 90, locked: true },
    { id: 'top', artworkId: 'c', position: { x: 1, y: 2 } },
  ];
  const before = JSON.stringify(layers);
  const moved = reorderSeasonalArtworkLayers(layers, 0, 2);
  assert.deepEqual(moved.map((layer) => layer.id), ['top', 'bottom', 'middle']);
  assert.equal(JSON.stringify(layers), before);
  assert.deepEqual(moved[0].position, { x: 1, y: 2 });
  assert.equal(moved[2].locked, true);
  assert.strictEqual(reorderSeasonalArtworkLayers(layers, 0, 0), layers);
  assert.strictEqual(reorderSeasonalArtworkLayers(layers, -1, 0), layers);
  assert.strictEqual(reorderSeasonalArtworkLayers(layers, 9, 0), layers);
  assert.strictEqual(reorderSeasonalArtworkLayers(layers, 0, 9), layers);
});

test('seasonal modern artwork card has drag, selected inline controls and row copy/delete', () => {
  assert.match(seasonal, /<DragDropContext onBeforeCapture=/);
  assert.match(seasonal, /<Droppable droppableId="seasonal-artwork-stack">/);
  assert.match(seasonal, /<Draggable key=\{entry\.layer\.id\}/);
  assert.match(seasonal, /data-seasonal-artwork-row=\{entry\.layer\.id\}/);
  assert.match(seasonal, /data-seasonal-inline-artwork-controls=\{entry\.layer\.id\}/);
  assert.match(seasonal, /data-seasonal-artwork-visibility=\{entry\.layer\.id\}/);
  assert.match(seasonal, /data-seasonal-artwork-delete=\{entry\.layer\.id\}/);
  assert.match(seasonal, /reorderSeasonalArtworkLayers\(layers, source\.index, destination\.index\)/);
  assert.doesNotMatch(seasonal, /duplicateLayer/, 'Use explicit Add Artwork instead of a duplicate shortcut');
  assert.match(seasonal, /layers\.length >= MAX_LAYERS/);
  assert.match(seasonal, /data-gdp-seasonal-modern-controls="three-tabs"/);
  for (const tab of ['size', 'position', 'more']) assert.ok(seasonal.includes("artworkToolTab === '" + tab + "'"));
  assert.match(seasonal, /data-gdp-seasonal-free-reshape="height"/);
  assert.match(seasonal, /data-seasonal-effective-dpi="true"/);
  assert.match(seasonal, /constrainSeasonalArtworkLayer/);
  assert.match(print, /SEASONAL_MIN_PRINT_DPI/);
});

test('Upload Your Own Artwork uses modern single-artwork tabs without fake layering', () => {
  assert.match(upload, /data-gdp-upload-selected-artwork="single"/);
  assert.match(upload, /data-gdp-upload-modern-controls="three-tabs"/);
  for (const tab of ['size', 'position', 'more']) assert.ok(upload.includes("uploadToolTab === '" + tab + "'"));
  assert.doesNotMatch(upload, /<DragDropContext|data-seasonal-v2-artwork-list/);
  assert.match(upload, /data-gdp-upload-free-reshape="width-height"/);
  assert.match(upload, /data-gdp-upload-bleed-crop="true"/);
  assert.match(upload, /data-gdp-fit-artwork="true"/);
  assert.match(upload, /data-gdp-smart-quality="upload-artwork"/);
  assert.match(upload, /data-gdp-artwork-metrics="true"/);
  assert.match(upload, /data-gdp-free-artwork-enhancement="true"/);
  assert.match(upload, /minimized=\{mobilePreviewMinimized \|\| \(enhancementPanelVisible && !previewRestoredInsideEnhancement\)\}/);
  assert.match(upload, /window\.confirm\('Remove this artwork from the current print side/);
  assert.match(upload, /onPatch\(\{ artwork: null, transform:/);
});
