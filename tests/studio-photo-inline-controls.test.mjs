import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = readFileSync(new URL('../src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', import.meta.url), 'utf8');
const production = readFileSync(new URL('../src/lib/customStudioV2ProtectedProduction.js', import.meta.url), 'utf8');

test('photo selection expands one inline editor immediately under its draggable row', () => {
  assert.match(editor, /const \[expandedPhotoId, setExpandedPhotoId\] = useState\(''\)/);
  assert.match(editor, /setExpandedPhotoId\(\(id\) => id === layer\.id \? '' : layer\.id\)/);
  assert.match(editor, /aria-expanded=\{expandedPhotoId === layer\.id && activePhotoId === layer\.id\}/);
  const draggableStart = editor.indexOf('<Draggable key={layer.id}');
  const inlineRegion = editor.indexOf('data-gdp-inline-selected-photo-controls={layer.id}');
  const draggableEnd = editor.indexOf('</Draggable>', draggableStart);
  assert.ok(draggableStart >= 0 && draggableStart < inlineRegion && inlineRegion < draggableEnd, 'the controls expand underneath the chosen draggable photo');
  assert.match(editor, /\{expandedPhotoId === layer\.id && activePhotoId === layer\.id \? \(/);
  assert.match(editor, /onBeforeCapture=\{\(\) => setExpandedPhotoId\(''\)\}/, 'collapse before measuring drag dimensions');
});

test('all selected-photo actions are reused exactly once, not duplicated below preview', () => {
  assert.equal((editor.match(/const selectedPhotoControls = activePhoto \? \(/g) || []).length, 1);
  assert.equal((editor.match(/Reset selected photo/g) || []).length, 1);
  assert.equal((editor.match(/data-gdp-photo-free-reshape="width-height"/g) || []).length, 1);
  assert.equal((editor.match(/data-gdp-photo-bleed-crop="true"/g) || []).length, 1);
  assert.equal((editor.match(/data-gdp-bootleg-photo-borders="selected-photo-only"/g) || []).length, 1);
  assert.match(editor, /onClick=\{\(\) => moveActivePhoto\(-1\)\}/);
  assert.match(editor, /onClick=\{\(\) => moveActivePhoto\(1\)\}/);
  assert.match(editor, /onClick=\{duplicateActivePhoto\}/);
  assert.match(editor, /onClick=\{deleteActivePhoto\}/);
  assert.match(editor, /onClick=\{toggleActiveBackground\}/);
  assert.match(editor, /<RangeControl label="Rotation"/);
  assert.match(editor, /selectedPhotoControls\}\s*<\/div>/, 'reused inline below selected row');
  assert.match(editor, /\{!usesLayerLab \? selectedPhotoControls : <p data-gdp-photo-controls-relocated=/, 'keep legacy upload editor while removing duplicate bootleg/memorial inspector controls');
});

test('upload, hide/focus, reordering, saved photo state and print renderer remain unchanged', () => {
  assert.match(editor, /data-gdp-photo-upload-guidance="auto-remove-background"/);
  assert.match(editor, /onAppendPhotos\(safeAdditions, activeId\)/);
  assert.match(editor, /data-gdp-photo-focus-mode="preview-only"/);
  assert.match(editor, /<EyeOff size=\{16\}/);
  assert.match(editor, /<Focus size=\{16\}/);
  assert.match(editor, /DragDropContext onBeforeCapture=/);
  assert.match(editor, /reorderStudioV2PhotoLayers\(photos, source\.index, destination\.index\)/);
  assert.match(editor, /syncPhotos\(reordered, dragged\.id\)/);
  assert.match(production, /photoLayers\(editor\)\.sort\(\(a, b\) => Number\(a\.order \|\| 0\) - Number\(b\.order \|\| 0\)\)/);
});
