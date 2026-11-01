import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_PHOTO_BORDER, normalizePhotoBorder } from '../src/lib/customStudioV2PhotoBorders.js';

const editor = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
const production = readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');
const snapshot = readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');

test('new Bootleg Glow looks restrained, and opt-in None remains untouched', () => {
  assert.equal(DEFAULT_PHOTO_BORDER.style, 'none');
  assert.ok(DEFAULT_PHOTO_BORDER.innerThickness < 30);
  assert.ok(DEFAULT_PHOTO_BORDER.glowSize < 70);
  assert.ok(DEFAULT_PHOTO_BORDER.glowOpacity < 85);
  assert.ok(DEFAULT_PHOTO_BORDER.feather > 70);
  assert.ok(DEFAULT_PHOTO_BORDER.roughness <= 12);
  assert.equal(normalizePhotoBorder({ style: 'none' }).style, 'none');
});

test('live border output is cut out from EVERY photo interior, protecting visible faces', () => {
  const maskDecl = production.indexOf('const photoMaskOutput = borderOutput ? createCanvas');
  const maskDraw = production.indexOf("paint(photoMaskOutput.context, null, 'erase')");
  const borderDraw = production.indexOf("paint(borderOutput.context, preparedBorder, 'borderOnly')");
  const maskComposite = production.indexOf('borderOutput.context.drawImage(photoMaskOutput.canvas, 0, 0)');
  assert.ok(maskDecl >= 0 && maskDecl < maskDraw && maskDraw < borderDraw && borderDraw < maskComposite);
  assert.match(production, /borderOutput\.context\.globalCompositeOperation = 'destination-out'/);
  assert.match(editor, /data-gdp-bootleg-cutout-borders="true"/);
  assert.match(editor, /paintPhotoBorders\(rendered\.borderCanvas\)/);
  assert.match(production, /paint\(output\.context, preparedBorder, 'both'\)/);
  assert.match(production, /globalCompositeOperation = 'source-atop'/);
  assert.match(snapshot, /border: layer\.border \|\| \{ style: 'none' \}/);
});

test('every RangeControl in the protected editor has an individually accessible reset', () => {
  const usages = editor.split('\n').filter((line) => line.includes('<RangeControl'));
  assert.ok(usages.length >= 25, 'expected photo, template, text, sticker and overlay sliders after retiring border effects');
  for (const line of usages) {
    assert.match(line, /onReset=\{\(\) =>/, line.slice(0, 110));
  }
  assert.match(editor, /aria-label=\{\x60Reset \$\{label\}\x60\}/);
  assert.match(editor, /onDoubleClick=\{onReset \?/);
});

test('retired photo border controls are absent, while overlay tint has its reset', () => {
  assert.doesNotMatch(editor, /Photo Border Effects|data-gdp-bootleg-photo-borders|data-gdp-bootleg-glow-controls|Bottom edge fade/);
  assert.doesNotMatch(editor, /resetPhotoBorderStyle|resetBootlegGlow|updateActivePhotoBorder/);
  assert.match(editor, /aria-label="Reset tint color"/);
});

test('photo, template and sticker resets remain independently accessible', () => {
  assert.match(editor, /patchTemplateTransform\(\{ scale: 100 \}\)/);
  assert.match(editor, /patchActivePhotoTransform\(\{ scale: template\?\.defaultTransform\?\.scale \|\| 100 \}\)/);
  assert.match(editor, /patchActivePhotoTransform\(\{ canvasX: resolvePhotoCanvasPosition\(\{\}, template\?\.photoZone \|\| \{\}\)\.x \}\)/);
  assert.match(editor, /patchActivePhotoTransform\(\{ rotation: 0 \}\)/);
  assert.match(editor, /patchActiveSticker\(\{ scale: 42 \}\)/);
  assert.match(editor, /patchActiveSticker\(\{ rotation: 0 \}\)/);
  assert.doesNotMatch(editor, /updateActivePhotoBorder/);
});
