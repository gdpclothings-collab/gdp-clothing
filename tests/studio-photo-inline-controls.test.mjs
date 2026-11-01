import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = readFileSync(new URL('../src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', import.meta.url), 'utf8');
const production = readFileSync(new URL('../src/lib/customStudioV2ProtectedProduction.js', import.meta.url), 'utf8');

test('selecting a photo expands only its compact inspector below the draggable photo row', () => {
  assert.match(editor, /const \[expandedPhotoId, setExpandedPhotoId\] = useState\(''\)/);
  assert.match(editor, /setExpandedPhotoId\(\(id\) => id === layer\.id \? '' : layer\.id\)/);
  assert.match(editor, /aria-expanded=\{expandedPhotoId === layer\.id && activePhotoId === layer\.id\}/);
  const draggableStart = editor.indexOf('<Draggable key={layer.id}');
  const inlineRegion = editor.indexOf('data-gdp-inline-selected-photo-controls={layer.id}');
  const draggableEnd = editor.indexOf('</Draggable>', draggableStart);
  assert.ok(draggableStart >= 0 && draggableStart < inlineRegion && inlineRegion < draggableEnd, 'controls expand under the selected draggable row');
  assert.match(editor, /onBeforeCapture=\{\(\) => setExpandedPhotoId\(''\)\}/);
  assert.match(editor, /data-gdp-modern-photo-controls="three-tabs"/);
  assert.match(editor, /role="tablist" aria-label="Photo adjustment tools"/);
  for (const tab of ["'size'", "'position'", "'more'"]) assert.ok(editor.includes(`photoToolTab === ${tab}`));
  assert.match(editor, /setMobilePreviewDismissed\(true\)/, 'the floating mirror gets out of the way while photo tools are open');
});

test('Copy and Delete belong to each photo row and target that row rather than only the selected photo', () => {
  const start = editor.indexOf('const photoLayersPanel =');
  const end = editor.indexOf('const photoPanel =', start);
  const panel = editor.slice(start, end);
  assert.match(panel, /data-gdp-photo-row-copy=\{layer\.id\}/);
  assert.match(panel, /onClick=\{\(\) => duplicatePhoto\(layer\.id\)\}/);
  assert.match(panel, /data-gdp-photo-row-delete=\{layer\.id\}/);
  assert.match(panel, /onClick=\{\(\) => deletePhoto\(layer\.id\)\}/);
  assert.match(editor, /const source = photos\.find\(\(layer\) => layer\.id === photoId\)/);
  assert.match(editor, /remaining = photos\.filter\(\(layer\) => layer\.id !== photoId\)/);
  assert.match(editor, /nextPhotos\.splice\(insertionIndex \+ 1, 0, duplicate\)/, 'copies appear directly above the source in the stack');
  assert.ok(panel.includes('<GripVertical size={18} />'), 'drag grip remains available');
  assert.doesNotMatch(panel, /Send photo backward|Bring photo forward|moveActivePhoto/, 'layer arrows were removed');
});

test('size, position and advanced photo tools remain complete without border effects', () => {
  assert.equal((editor.match(/const selectedPhotoControls = activePhoto \? \(/g) || []).length, 1);
  assert.equal((editor.match(/Reset selected photo/g) || []).length, 1);
  assert.equal((editor.match(/data-gdp-photo-free-reshape="width-height"/g) || []).length, 1);
  assert.equal((editor.match(/data-gdp-photo-bleed-crop="true"/g) || []).length, 1);
  assert.match(editor, /onClick=\{toggleActiveBackground\}/);
  assert.match(editor, /<RangeControl label="Rotation"/);
  assert.match(editor, /selectedPhotoControls\}\s*<\/div>/, 'inline controls are reused under the selected row');
  assert.match(editor, /\{!usesLayerLab \? selectedPhotoControls : null\}/, 'the legacy upload editor retains controls');
  assert.doesNotMatch(editor, /Photo Border Effects|data-gdp-bootleg-photo-borders|data-gdp-bootleg-glow-controls|Bottom edge fade/);
  assert.match(editor, /\{activeBootlegLayer === 'photo' \? <>\{photoPanel\}\{photoLayersPanel\}<\/> : null\}/, 'the Photo Layers card stays below the entire upload card');
});

test('preview-only Eye/Focus, drag reordering, saved photo order and 300-DPI render stay intact', () => {
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
