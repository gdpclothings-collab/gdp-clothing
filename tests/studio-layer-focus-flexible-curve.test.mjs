import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextPreviewHiddenPhotoIds, nextPreviewFocusPhotoIds, previewPhotoVisible, previewIsFiltered } from '../src/lib/customStudioV2PreviewFocus.js';

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
