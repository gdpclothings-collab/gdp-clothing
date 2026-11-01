import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reorderStudioV2PhotoLayers } from '../src/lib/customStudioV2PhotoLayers.js';

const editorSource = readFileSync(new URL('../src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', import.meta.url), 'utf8');
const productionSource = readFileSync(new URL('../src/lib/customStudioV2ProtectedProduction.js', import.meta.url), 'utf8');

const original = [
  { id: 'bottom', order: 0, asset: { name: '2028.png' }, transform: { x: 21 }, visible: true },
  { id: 'middle', order: 1, asset: { name: '2029.png' }, transform: { x: 12 }, visible: true },
  { id: 'top', order: 2, asset: { name: '2031.png' }, transform: { x: 4 }, visible: true },
];

test('dragging the bottom row to the top puts its photo in front', () => {
  const result = reorderStudioV2PhotoLayers(original, 2, 0);
  assert.deepEqual(result.map((layer) => layer.id), ['middle', 'top', 'bottom']);
  assert.deepEqual(result.map((layer) => layer.order), [0, 1, 2]);
  assert.equal(result.at(-1).asset.name, '2028.png');
  assert.equal(result.at(-1).transform.x, 21);
  assert.deepEqual(original.map((layer) => layer.order), [0, 1, 2], 'the saved input remains immutable');
});

test('dragging the top row to the bottom sends its photo behind', () => {
  const result = reorderStudioV2PhotoLayers(original, 0, 2);
  assert.deepEqual(result.map((layer) => layer.id), ['top', 'bottom', 'middle']);
  assert.equal(result[0].asset.name, '2031.png');
});

test('reordering handles middle rows, legacy arrays and invalid drops safely', () => {
  const result = reorderStudioV2PhotoLayers(original, 1, 0);
  assert.deepEqual(result.map((layer) => layer.id), ['bottom', 'top', 'middle']);
  assert.deepEqual(reorderStudioV2PhotoLayers(original, 0, 0), original);
  assert.deepEqual(reorderStudioV2PhotoLayers(original, 0, -1), original);
  assert.deepEqual(reorderStudioV2PhotoLayers(original, 50, 1), original);
  assert.deepEqual(reorderStudioV2PhotoLayers(null, 0, 1), []);
  const legacy = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(reorderStudioV2PhotoLayers(legacy, 1, 0).map((layer) => layer.id), ['b', 'a']);
});

test('mobile, desktop, Focus/Eye and the production file share the persisted photo order', () => {
  assert.match(editorSource, /onDragEnd=\{handlePhotoDragEnd\}/);
  assert.match(editorSource, /<Droppable droppableId=/);
  assert.match(editorSource, /<Draggable key=\{layer\.id\}/);
  assert.match(editorSource, /\.\.\.dragProvided\.dragHandleProps/);
  assert.match(editorSource, /\[\.\.\.photos\]\.reverse\(\)\.map/);
  assert.match(editorSource, /syncPhotos\(reordered, dragged\.id\)/);
  assert.match(editorSource, /data-gdp-photo-sort-direction="top-first"/);
  assert.match(editorSource, /data-gdp-photo-focus-mode="preview-only"/);
  assert.match(editorSource, /<EyeOff size=\{16\}/);
  assert.match(editorSource, /<Focus size=\{16\}/);
  assert.match(editorSource, /Number\(a\.order \|\| 0\) - Number\(b\.order \|\| 0\)/);
  assert.match(productionSource, /photoLayers\(editor\)\.sort\(\(a, b\) => Number\(a\.order \|\| 0\) - Number\(b\.order \|\| 0\)\)/);
});
