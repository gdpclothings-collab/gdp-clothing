import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = readFileSync(new URL('../src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', import.meta.url), 'utf8');
const production = readFileSync(new URL('../src/lib/customStudioV2ProtectedProduction.js', import.meta.url), 'utf8');

test('photo visibility is preview-only, not an order or production field', () => {
  assert.match(editor, /data-gdp-photo-focus-mode="preview-only"/);
  assert.match(editor, /const \[previewHiddenPhotoIds, setPreviewHiddenPhotoIds\] = useState\(\[\]\)/);
  assert.match(editor, /const \[previewFocusPhotoIds, setPreviewFocusPhotoIds\] = useState\(\[\]\)/);
  assert.match(editor, /!previewHiddenPhotoIds\.includes\(layer\.id\)/);
  assert.match(editor, /!previewFocusPhotoIds\.length \|\| previewFocusPhotoIds\.includes\(layer\.id\)/);
  assert.doesNotMatch(editor, /onPatch\(\{\s*preview(?:Hidden|Focus)PhotoIds/);
  assert.doesNotMatch(production, /preview(?:Hidden|Focus)PhotoIds/);
});

test('focus works in main and mobile garment previews and is cleared before approval', () => {
  assert.match(editor, /previewFocusPhotoIds=\{usesLayerLab \? previewFocusPhotoIds : \[\]\}/);
  assert.match(editor, /previewFocusPhotoIds=\{previewFocusPhotoIds\}/);
  assert.match(editor, /if \(previewVisibilityChanged\) \{ resetPreviewVisibility\(\); return; \}/);
  assert.match(editor, /setPreviewFocusPhotoIds\(\(ids\) => ids\.includes\(id\)/);
  assert.match(editor, /ids\.length >= 2 \? \[ids\[1\], id\]/);
  assert.match(editor, /setPreviewHiddenPhotoIds\(\[\]\); setPreviewFocusPhotoIds\(\[\]\)/);
});

test('signed bend reuses supported arc-up, arc-down and straight settings', () => {
  assert.match(editor, /data-gdp-text-flexible-curve="photoshop-style"/);
  assert.match(editor, /min=\{-100\} max=\{100\}/);
  assert.match(editor, /bend < 0 \? 'arc-down' : bend > 0 \? 'arc-up' : 'straight'/);
  assert.match(editor, /curveAmount: Math\.abs\(bend\)/);
  assert.match(editor, /curve === 'wave'/);
  assert.equal((editor.match(/<FlexibleCurveControl style=\{textStyle\} onChange=\{patchTextStyle\}/g) || []).length, 2);
});
