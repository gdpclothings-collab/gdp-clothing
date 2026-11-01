import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = readFileSync(new URL('../src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', import.meta.url), 'utf8');
const production = readFileSync(new URL('../src/lib/customStudioV2ProtectedProduction.js', import.meta.url), 'utf8');

test('the entire Photo Layers card is separate and immediately after the upload card', () => {
  assert.match(editor, /data-gdp-studio-library-pane="templates-only"/);
  assert.doesNotMatch(editor, /libraryTab|setLibraryTab/);
  assert.equal((editor.match(/data-gdp-bootleg-photo-layer-list="true"/g) || []).length, 1);
  assert.match(editor, /data-gdp-photo-layers-location="below-upload"/);
  assert.match(editor, /const photoLayersPanel = usesLayerLab \? \(/);
  const uploadCard = editor.slice(editor.indexOf('const photoPanel = ('), editor.indexOf('const textPanel ='));
  assert.match(uploadCard, /data-gdp-photo-upload-guidance="auto-remove-background"/);
  assert.match(uploadCard, /Add another photo/);
  assert.doesNotMatch(uploadCard, /data-gdp-bootleg-photo-layer-list/);
  const inspector = editor.slice(editor.indexOf('<section ref={inspectorRef}'));
  assert.match(inspector, /\{activeBootlegLayer === 'photo' \? <>\{photoPanel\}\{photoLayersPanel\}<\/> : null\}/);
  assert.ok(inspector.indexOf('{photoPanel}') < inspector.indexOf('{photoLayersPanel}'), 'photo layers follow the entire upload card');
});

test('drag rows, Eye/Focus and photo-specific editing stay in the moved card', () => {
  const start = editor.indexOf('const photoLayersPanel =');
  const end = editor.indexOf('const photoPanel =', start);
  const section = editor.slice(start, end);
  assert.match(section, /data-gdp-photo-focus-mode="preview-only"/);
  assert.match(section, /<DragDropContext/);
  assert.match(section, /<Draggable key=\{layer\.id\}/);
  assert.match(section, /data-gdp-inline-selected-photo-controls=\{layer\.id\}/);
  assert.match(section, /\{selectedPhotoControls\}/);
  assert.match(section, /<EyeOff size=\{16\}/);
  assert.match(section, /<Focus size=\{16\}/);
  assert.match(editor, /syncPhotos\(reordered, dragged\.id\)/);
});

test('the 300-DPI photo stack and non-layer upload path are unaffected', () => {
  assert.match(editor, /\{!usesLayerLab \? selectedPhotoControls : null\}/);
  assert.match(editor, /data-gdp-bootleg-panel=\{isBootleg \? 'photo' : undefined\}/);
  assert.match(production, /photoLayers\(editor\)\.sort\(\(a, b\) => Number\(a\.order \|\| 0\) - Number\(b\.order \|\| 0\)\)/);
});
