import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextPreviewHiddenPhotoIds, nextPreviewFocusPhotoIds, previewPhotoVisible, previewIsFiltered } from '../src/lib/customStudioV2PreviewFocus.js';
import { appendStudioV2PhotoLayers, uploadedPhotoIdsPresent } from '../src/lib/customStudioV2PhotoLayers.js';
import { createInitialStudioV2State, studioV2Reducer } from '../src/lib/customStudioV2State.js';
import { constrainBootlegTextStyleToCanvas } from '../src/lib/customStudioV2BootlegTextLayout.js';
import { applyPremiumTextPreset } from '../src/lib/customStudioV2PremiumTextStyles.js';

const editor = readFileSync(new URL('../src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/CustomStudioV2.jsx', import.meta.url), 'utf8');
const production = readFileSync(new URL('../src/lib/customStudioV2ProtectedProduction.js', import.meta.url), 'utf8');

test('preview hide restores the original photo without changing saved data', () => {
  const photo = { id: 'p1', visible: true, asset: { url: 'sample' } };
  const original = JSON.stringify(photo);
  const hidden = nextPreviewHiddenPhotoIds([], 'p1');
  assert.deepEqual(hidden, ['p1']);
  assert.equal(previewPhotoVisible(photo, hidden, []), false);
  assert.equal(previewIsFiltered(hidden, []), true);
  const restored = nextPreviewHiddenPhotoIds(hidden, 'p1');
  assert.deepEqual(restored, []);
  assert.equal(previewPhotoVisible(photo, restored, []), true);
  assert.equal(previewIsFiltered(restored, []), false);
  assert.equal(JSON.stringify(photo), original);
});

test('Focus Mode isolates one or two photos and replaces the oldest on a third selection', () => {
  const one = nextPreviewFocusPhotoIds([], 'p1');
  const two = nextPreviewFocusPhotoIds(one, 'p2');
  const third = nextPreviewFocusPhotoIds(two, 'p3');
  assert.deepEqual(one, ['p1']);
  assert.deepEqual(two, ['p1', 'p2']);
  assert.deepEqual(third, ['p2', 'p3']);
  assert.equal(previewPhotoVisible({ id: 'p1' }, [], two), true);
  assert.equal(previewPhotoVisible({ id: 'p3' }, [], two), false);
  assert.deepEqual(nextPreviewFocusPhotoIds(third, 'p2'), ['p3']);
  assert.deepEqual(nextPreviewFocusPhotoIds(['p1'], 'p2', 1), ['p2']);
  assert.deepEqual(nextPreviewFocusPhotoIds(['p3'], 'p3'), []);
  assert.equal(previewPhotoVisible({ id: 'p3', visible: false }, [], []), false);
});

test('photo filtering is editor-only; preview and production cannot share hidden flags', () => {
  assert.match(editor, /data-gdp-photo-focus-mode="preview-only"/);
  assert.match(editor, /previewPhotoVisible\(layer, previewHiddenPhotoIds, previewFocusPhotoIds\)/);
  assert.match(editor, /previewFocusPhotoIds=\{usesLayerLab \? previewFocusPhotoIds : \[\]\}/);
  assert.match(editor, /previewFocusPhotoIds=\{previewFocusPhotoIds\}/);
  assert.doesNotMatch(editor, /onPatch\(\{\s*preview(?:Hidden|Focus)PhotoIds/);
  assert.doesNotMatch(production, /preview(?:Hidden|Focus)PhotoIds/);
});

test('the page-level approval and Final Review are blocked while editing visibility is filtered', () => {
  assert.match(editor, /onPreviewVisibilityChange\?\.\(previewVisibilityChanged\)/);
  assert.match(editor, /onPreviewVisibilityChange\?\.\(false\)/);
  assert.match(editor, /if \(previewVisibilityChanged\) \{ resetPreviewVisibility\(\); return; \}/);
  assert.match(page, /data-gdp-preview-focus-approval-block="true"/);
  assert.match(page, /disabled=\{!hasArtwork \|\| previewVisibilityActive\}/);
  assert.match(page, /if \(!previewVisibilityActive\) dispatch\(\{ type: 'CONFIRM_FINAL_LAYOUT'/);
  assert.match(page, /if \(isFiltered\) setState\(\(current\) => studioV2Reducer\(current, \{ type: 'CONFIRM_FINAL_LAYOUT', value: false \}\)\)/);
  assert.match(page, /baseCanContinue && !previewVisibilityActive/);
  assert.match(page, /step === 'review' && previewVisibilityActive/);
});

test('signed bend, wave depth and reset preserve the existing print curve contract', () => {
  assert.match(editor, /data-gdp-text-flexible-curve="photoshop-style"/);
  assert.match(editor, /min=\{-100\} max=\{100\}/);
  assert.match(editor, /bend < 0 \? 'arc-down' : bend > 0 \? 'arc-up' : 'straight'/);
  assert.match(editor, /curveAmount: Math\.abs\(bend\)/);
  assert.match(editor, /curve === 'wave'/);
  assert.equal((editor.match(/<FlexibleCurveControl style=\{textStyle\} onChange=\{patchTextStyle\}/g) || []).length, 2);
  assert.match(production, /renderProtectedStudioV2PngAdvanced/);
});

test('premium arc up, arc down and wave keep preview/300-DPI glyph geometry aligned', () => {
  for (const curve of ['arc-up', 'arc-down', 'wave']) {
    const style = { ...applyPremiumTextPreset({ fontScale: 100, canvasX: 50, canvasY: 50 }, 'gold-chrome'), curve, curveAmount: 80 };
    const options = { text: { headline: 'STORM' }, zone: { x: 12, y: 78, width: 76, height: 16 }, style };
    const low = constrainBootlegTextStyleToCanvas({ ...options, width: 1000, height: 1200 });
    const high = constrainBootlegTextStyleToCanvas({ ...options, width: 3000, height: 3600 });
    assert.equal(low.layout.headline.kind, 'glyphs', curve);
    assert.equal(high.layout.headline.kind, 'glyphs', curve);
    assert.equal(low.layout.headline.glyphs.length, high.layout.headline.glyphs.length, curve);
    for (let i = 0; i < low.layout.headline.glyphs.length; i += 1) {
      const a = low.layout.headline.glyphs[i];
      const b = high.layout.headline.glyphs[i];
      assert.ok(Math.abs(a.x / 1000 - b.x / 3000) < 0.003, `${curve}: X parity for glyph ${i}`);
      assert.ok(Math.abs(a.y / 1200 - b.y / 3600) < 0.003, `${curve}: Y parity for glyph ${i}`);
      assert.ok(Math.abs(a.rotation - b.rotation) < 0.3, `${curve}: rotation parity for glyph ${i}`);
    }
  }
});

test('five completed uploads append atomically and preserve each stable ID', () => {
  const files = Array.from({ length: 5 }, (_, index) => ({
    id: `photo-${index + 1}`,
    type: 'photo',
    asset: { name: `storm${index + 1}.png`, path: `uploads/storm${index + 1}.png` },
    transform: { scale: 100, x: index, y: index },
    visible: true,
  }));
  const originalIds = files.map((file) => file.id);
  assert.equal(appendStudioV2PhotoLayers([], files).length, 5);
  assert.equal(appendStudioV2PhotoLayers(files.slice(0, 2), files.slice(2)).length, 5);
  assert.equal(appendStudioV2PhotoLayers(files, files.slice(0, 2)).length, 5, 'duplicate batch is idempotent');
  assert.equal(appendStudioV2PhotoLayers(files, [{ id: 'sixth' }], 5).length, 5, 'slot limit retains prior items');

  let state = createInitialStudioV2State();
  state = studioV2Reducer(state, { type: 'APPEND_EDITOR_PHOTOS', path: 'bootleg', side: 'front', photos: files, activePhotoId: files.at(-1).id });
  const editor = state.bootleg.sides.front;
  assert.equal(editor.photos.length, 5, 'five uploaded files must yield five layers, not one');
  assert.deepEqual(editor.photos.map((layer) => layer.id), originalIds);
  assert.equal(editor.activePhotoId, 'photo-5');
  assert.equal(editor.photo.path, 'uploads/storm1.png', 'legacy primary photo alias stays available');
  assert.equal(uploadedPhotoIdsPresent(editor.photos, originalIds), true);
  assert.equal(uploadedPhotoIdsPresent(editor.photos.slice(0, 1), originalIds), false);
  const edited = studioV2Reducer(state, { type: 'PATCH_EDITOR', path: 'bootleg', side: 'front', patch: { textStyle: { curve: 'arc-up', curveAmount: 70 } } });
  assert.equal(edited.bootleg.sides.front.photos.length, 5, 'text edits cannot discard uploaded photos');
  const hidden = nextPreviewHiddenPhotoIds([], 'photo-2');
  assert.equal(edited.bootleg.sides.front.photos.length, 5, 'hide changes the preview only');
  assert.equal(previewPhotoVisible(edited.bootleg.sides.front.photos[1], hidden, []), false);
  assert.equal(previewPhotoVisible(edited.bootleg.sides.front.photos[1], [], []), true);
  const otherSide = studioV2Reducer(edited, { type: 'APPEND_EDITOR_PHOTOS', path: 'memorial', side: 'back', photos: files.slice(0, 2) });
  assert.equal(otherSide.bootleg.sides.front.photos.length, 5, 'side and design path are isolated');
  assert.equal(otherSide.memorial.sides.back.photos.length, 2);
});

test('focus design uses one persistent layer list, compact tabs, and verified upload confirmation', () => {
  assert.match(editor, /data-gdp-studio-library-pane="modern-tabs"/);
  assert.match(editor, /data-gdp-photo-layer-row=\{layer\.id\}/);
  assert.equal((editor.match(/data-gdp-bootleg-photo-layer-list="true"/g) || []).length, 1, 'duplicate photo list removed');
  assert.match(editor, /uploadedPhotoIdsPresent\(photos, pending\.ids\)/);
  assert.match(editor, /onAppendPhotos\(safeAdditions, activeId\)/);
  assert.match(page, /type: 'APPEND_EDITOR_PHOTOS'/);
  assert.match(editor, /data-gdp-modern-text-controls="three-tabs"/);
  assert.match(editor, /data-gdp-text-edge-align="safe-print-boundary"/);
  assert.match(editor, /role="tabpanel" aria-label="Text styling"/);
  assert.match(editor, /role="tabpanel" aria-label="Text position"/);
  assert.match(editor, /role="tabpanel" aria-label="Text effects"/);
});
