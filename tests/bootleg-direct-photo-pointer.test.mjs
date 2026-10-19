import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
const gesture = readFileSync('src/components/storefront/custom-studio-v2/useTouchTransformV2.js', 'utf8');
const production = readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');

const photoComponent = editor.slice(editor.indexOf('function BootlegPhotoLayer('), editor.indexOf('function StickerLayer('));
const previewComponent = editor.slice(editor.indexOf('function ProtectedPreview('), editor.indexOf('export default function ProtectedTemplateEditorV2('));
const textComponent = editor.slice(editor.indexOf('function BootlegTextLayer('), editor.indexOf('function ProtectedPreview('));

test('every Bootleg photo accepts pointer selection and drag in the initial gesture', () => {
  assert.match(photoComponent, /enabled: true/);
  assert.match(photoComponent, /onPointerDown=\{\(event\) => \{ if \(!selected\) onSelect\(\); gesture\.onPointerDown\(event\); \}\}/);
  assert.match(photoComponent, /pointer-events-auto cursor-pointer/);
  assert.match(photoComponent, /pointer-events-auto cursor-grab/);
  assert.match(photoComponent, /onChange: \(next\) => onTransform\(constrainFreePhotoTransform\(\{/);
  assert.match(gesture, /setPointerCapture\?\.\(event\.pointerId\)/);
  assert.match(gesture, /if \(gesture\.mode === 'drag' && points\.length === 1\)/);
  assert.match(gesture, /if \(gesture\.mode === 'pinch' && points\.length >= 2\)/);
});

test('preview changes active photo from the canvas without navigating back to controls', () => {
  assert.match(previewComponent, /onActiveLayerChange\?\.\('photo'\); onPatch\(\{ activePhotoId: layer\.id, activeStickerId: '' \}\)/);
  assert.match(previewComponent, /pointerEvents: 'none'/);
  assert.match(previewComponent, /data-gdp-bootleg-free-photo-canvas/);
  assert.match(previewComponent, /layer\.id === activePhotoId && activeLayer === 'photo'/);
});

test('text hit testing allows taps through empty text canvas but preserves text glyph gestures', () => {
  assert.match(textComponent, /scope === 'bootleg' \? 'pointer-events-none'/);
  assert.match(textComponent, /scope === 'bootleg' \? 'pointer-events-none' : ''/);
  assert.match(textComponent, /pointerEvents=\{selected && scope === 'bootleg' \? 'visiblePainted' : undefined\}/);
  assert.match(textComponent, /enabled: selected && Boolean\(layout\)/);
  assert.match(textComponent, /data-gdp-memorial-text-layer/);
});

test('mobile tools show all five tabs; overlay effects retain separate non-gesture controls', () => {
  assert.match(editor, /grid-cols-3 gap-2 rounded-2xl/);
  assert.match(editor, /sm:grid-cols-5/);
  assert.match(editor, /activeBootlegLayer === 'overlay' \? overlayPanel : null/);
  assert.match(editor, /Overlay selected · use the sliders to adjust its effect/);
  assert.match(editor, /Tap any photo to select and move it immediately/);
});

test('photo selection does not change the overlay-alpha masking or export pipeline', () => {
  assert.match(previewComponent, /globalCompositeOperation = 'destination-in'/);
  assert.match(previewComponent, /data-gdp-bootleg-print-overlay="alpha-masked"/);
  assert.match(production, /globalCompositeOperation = 'source-atop'/);
  assert.match(production, /paintBootlegOverlay\(output\.context/);
});
