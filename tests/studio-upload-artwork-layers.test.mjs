import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_UPLOAD_ARTWORKS,
  uploadArtworkLayers,
  appendUploadArtworkLayers,
  patchUploadArtworkEditor,
  reorderUploadArtworkLayers,
} from '../src/lib/customStudioV2UploadLayers.js';
import { createInitialStudioV2State, studioV2Reducer, studioV2PrintableSides } from '../src/lib/customStudioV2State.js';

const asset = (name) => ({ path: 'guest-uploads/' + name + '.png', url: 'https://example.test/' + name + '.png', name });
const layer = (name) => ({ id: name, asset: asset(name), transform: { scale: 100, widthScale: 100, heightScale: 100, x: 0, y: 0, rotation: 0 }, visible: true });

test('legacy single artwork stays printable and becomes a canonical editable layer', () => {
  const old = { artwork: asset('legacy'), transform: { scale: 70, rotation: 15, x: 2, y: 3 } };
  assert.equal(uploadArtworkLayers(old).length, 1);
  const patched = patchUploadArtworkEditor(old, { transform: { scale: 65, rotation: 0, x: 0, y: 0 } });
  assert.equal(patched.layers[0].asset.path, old.artwork.path);
  assert.equal(patched.layers[0].transform.scale, 65);
});

test('batch additions preserve stable order, individual transforms, and an eight layer cap', () => {
  const initial = { artwork: null, layers: null };
  const input = Array.from({ length: 12 }, (_, i) => layer('layer' + i));
  const result = appendUploadArtworkLayers(initial, input);
  assert.equal(MAX_UPLOAD_ARTWORKS, 8);
  assert.deepEqual(result.layers.map((item) => item.id), input.slice(0, 8).map((item) => item.id));
  assert.equal(result.activeLayerId, 'layer7');
  assert.equal(input.length, 12);
  assert.equal(appendUploadArtworkLayers(result, [input[0]]).layers.length, 8);
});

test('hold-drag reorder moves the top row without modifying source or artwork details', () => {
  const input = [layer('bottom'), layer('middle'), layer('top')];
  const before = JSON.stringify(input);
  const next = reorderUploadArtworkLayers(input, 0, 2);
  assert.deepEqual(next.map((item) => item.id), ['top', 'bottom', 'middle']);
  assert.equal(JSON.stringify(input), before);
  assert.strictEqual(reorderUploadArtworkLayers(input, 0, 0), input);
});

test('selection, hide, edit and deletion operate only on targeted uploaded layer', () => {
  let editor = appendUploadArtworkLayers({}, [layer('one'), layer('two')]);
  editor = { ...editor, ...patchUploadArtworkEditor(editor, { activeLayerId: 'one' }) };
  assert.equal(editor.artwork.name, 'one');
  editor = { ...editor, ...patchUploadArtworkEditor(editor, { transform: { ...editor.transform, x: 9 } }) };
  assert.equal(editor.layers[0].transform.x, 9);
  assert.equal(editor.layers[1].transform.x, 0);
  editor = { ...editor, ...patchUploadArtworkEditor(editor, { layers: editor.layers.map((l) => l.id === 'one' ? { ...l, visible: false } : l), activeLayerId: 'one' }) };
  assert.equal(editor.layers[0].visible, false);
  editor = { ...editor, ...patchUploadArtworkEditor(editor, { layers: editor.layers.slice(1), activeLayerId: 'two' }) };
  assert.equal(editor.layers.length, 1);
  assert.equal(editor.artwork.name, 'two');
});

test('front/back and approval invalidate independently on upload changes', () => {
  let s = { ...createInitialStudioV2State(), designPath: 'upload' };
  s = studioV2Reducer(s, { type: 'APPEND_UPLOAD_ARTWORKS', side: 'front', layers: [layer('front')] });
  assert.deepEqual(studioV2PrintableSides(s), ['front']);
  s = studioV2Reducer(s, { type: 'APPEND_UPLOAD_ARTWORKS', side: 'back', layers: [layer('back')] });
  assert.deepEqual(studioV2PrintableSides(s), ['front', 'back']);
  s = studioV2Reducer(s, { type: 'PATCH_EDITOR', path: 'upload', side: 'front', patch: { layers: [{ ...layer('front'), visible: false }] } });
  assert.deepEqual(studioV2PrintableSides(s), ['back']);
  assert.equal(s.upload.sides.back.layers[0].id, 'back');
});

test('editor, review, production and draft rehydration all use the same per-side layer array', () => {
  const editor = readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx', 'utf8');
  const page = readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
  const production = readFileSync('src/lib/customStudioV2Production.js', 'utf8');
  const assets = readFileSync('src/lib/customStudioV2Assets.js', 'utf8');
  assert.match(editor, /type="file" multiple/);
  assert.match(editor, /UploadedLayersPreview/);
  assert.match(editor, /onAppendArtworks\(additions,/);
  assert.match(page, /layers: uploadLayers\.map/);
  assert.match(page, /uploadArtworkLayers\(editor\)\.forEach/);
  assert.match(production, /for \(const layer of layers\)/);
  assert.match(production, /dpi = 300/);
  assert.match(assets, /Promise\.all\(uploadArtworkLayers\(sideState\)\.map/);
});
