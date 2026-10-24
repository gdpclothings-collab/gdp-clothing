import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { containPhotoAlphaBounds, constrainFreePhotoTransform } from '../src/lib/customStudioV2PrintBounds.js';

const editor = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
const layout = readFileSync('src/lib/customStudioV2BootlegTextLayout.js', 'utf8');
const api = readFileSync('src/lib/customerApi.js', 'utf8');
const production = readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');

test('Layer buttons and template / photo / text / sticker selections reveal the inspector', () => {
  assert.match(editor, /const revealLayerControls = \(layer\) =>/);
  assert.match(editor, /onClick=\{\(\) => revealLayerControls\(value\)\}/);
  assert.match(editor, /ref=\{inspectorRef\} data-gdp-bootleg-inspector-scroll/);
  assert.match(editor, /inspector\.scrollIntoView\(\{ behavior, block: 'start' \}\)/);
  assert.match(editor, /inspector\.scrollTo\(\{ top: 0, behavior \}\)/);
  assert.match(editor, /revealLayerControls\('template'\)/);
  assert.match(editor, /revealLayerControls\('text'\)/);
  assert.match(editor, /revealLayerControls\('sticker'\)/);
  assert.match(editor, /revealLayerControls\('photo'\)/);
});
test('Original photos are uploaded first; auto removal is non-destructive for bootleg and memorial', () => {
  const originalIndex = editor.indexOf('const uploaded = await customerApi.uploadArtwork(file);');
  const cleanedIndex = editor.indexOf('const cleaned = await customerApi.removePhotoBackground(file);');
  assert.ok(originalIndex >= 0 && cleanedIndex > originalIndex);
  assert.match(editor, /cleanedUrl: cleaned\.cleanedUrl/);
  assert.match(editor, /cleanedPath: cleaned\.cleanedPath/);
  assert.match(editor, /backgroundMode: 'cleaned'/);
  assert.match(editor, /backgroundRemovalWarning: true/);
  assert.match(editor, /Restore original background/);
  assert.match(api, /async removePhotoBackground\(file\)/);
  assert.match(editor, /const usesLayerLab = isBootleg \|\| isMemorial/);
});
test('Shared text controls expose 1000% range and reset without bypassing print boundaries', () => {
  assert.match(editor, /max="1000"/);
  assert.match(editor, /onDoubleClick=/);
  assert.match(editor, /onReset=\{\(\) => patchTextStyle\(\{ fontScale: 100 \}\)\}/);
  assert.match(editor, /onReset=\{\(\) => patchTextStyle\(\{ rotation: 0 \}\)\}/);
  assert.match(editor, /constrainBootlegTextStyleToCanvas\(/);
  assert.match(layout, /export function constrainBootlegTextStyleToCanvas/);
});

test('transparent PNG/WebP pixels bypass paid background cleanup while opaque images keep it', async () => {
  assert.match(editor, /const preserveTransparency = await imageHasTransparency\(file\)/);
  assert.match(editor, /if \(preserveTransparency\) return \{ \.\.\.original, transparencyPreserved: true \};/);
  assert.ok(editor.indexOf('if (preserveTransparency) return') < editor.indexOf('const cleaned = await customerApi.removePhotoBackground(file);'));
  assert.match(editor, /preservedTransparencyCount/);

  const originalDocument = globalThis.document;
  const originalBitmapFactory = globalThis.createImageBitmap;
  let alpha = 0;
  let closed = 0;
  try {
    globalThis.document = {
      createElement: () => ({
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: new Uint8ClampedArray([20, 30, 40, alpha]) }),
        }),
      }),
    };
    globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close: () => { closed += 1; } });
    const { imageHasTransparency } = await import('../src/lib/studioImageTransparency.js');

    assert.equal(await imageHasTransparency({ type: 'image/png' }), true, 'alpha PNG preserves the original');
    assert.equal(await imageHasTransparency({ type: 'image/webp' }), true, 'alpha WebP preserves the original');
    alpha = 255;
    assert.equal(await imageHasTransparency({ type: 'image/png' }), false, 'opaque PNG still uses normal cleanup');
    assert.equal(await imageHasTransparency({ type: 'image/jpeg' }), false, 'JPEG still uses normal cleanup');
    assert.equal(closed, 3, 'decoded bitmaps are released after inspection');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalBitmapFactory === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = originalBitmapFactory;
  }
});

test('Photo gesture hit areas exclude transparent/letterboxed margins without clipping preview pixels', () => {
  assert.match(editor, /data-gdp-photo-visible-hit-area="true"/);
  assert.match(editor, /clipPath: visibleBounds/);
  assert.match(editor, /className="pointer-events-none h-full w-full select-none object-contain"/);
  assert.match(editor, /onTransform=\{\(transform, visibleBounds\) => patchPhotoTransform/);
  assert.match(editor, /activePhotoVisibleBounds = usePhotoVisibleBounds/);
  assert.match(production, /containPhotoAlphaBounds\(readTemplateAlphaBounds\(loaded.image\)/);
});

test('Visible transparent pixels may reach a print corner without losing ink', () => {
  const zone = { x: 15, y: 12, width: 70, height: 68 };
  const aspect = 0.8;
  const bounds = containPhotoAlphaBounds({ x: 25, y: 20, width: 45, height: 60 }, 1525, 2048, zone, aspect);
  const legacy = constrainFreePhotoTransform({ scale: 90, canvasX: 0, canvasY: 0 }, zone, aspect);
  const moved = constrainFreePhotoTransform({ scale: 90, canvasX: 0, canvasY: 0 }, zone, aspect, bounds);
  assert.ok(moved.canvasX < legacy.canvasX, 'transparent left padding should no longer block moving left');
  assert.ok(moved.canvasY < legacy.canvasY, 'transparent top padding should no longer block moving up');
  const leftInk = moved.canvasX + (bounds.x / 100 - 0.5) * zone.width * moved.scale / 100;
  const topInk = moved.canvasY + (bounds.y / 100 - 0.5) * zone.height * moved.scale / 100;
  assert.ok(leftInk >= -0.0001, 'visible leftmost pixel stays in print');
  assert.ok(topInk >= -0.0001, 'visible topmost pixel stays in print');
});

test('Off-center cutouts reach the same corner at different photo sizes', () => {
  const photoGesture = editor.slice(editor.indexOf('function BootlegPhotoLayer'), editor.indexOf('function StickerLayer'));
  assert.match(photoGesture, /minX: Number\.NEGATIVE_INFINITY/);
  assert.match(photoGesture, /maxX: Number\.POSITIVE_INFINITY/);
  assert.match(photoGesture, /minY: Number\.NEGATIVE_INFINITY/);
  assert.match(photoGesture, /maxY: Number\.POSITIVE_INFINITY/);

  const zone = { x: 15, y: 12, width: 70, height: 68 };
  const aspect = 0.75;
  // An auto-cleaned JPG can have almost all its empty pixels on the left/top.
  // Aligning the dog to the print's top-left then requires a negative image
  // center, not a center artificially clamped to zero.
  const bounds = containPhotoAlphaBounds({ x: 65, y: 65, width: 25, height: 25 }, 1200, 1600, zone, aspect);
  for (const scale of [100, 200, 400]) {
    const positioned = constrainFreePhotoTransform({ scale, canvasX: -1000, canvasY: -1000 }, zone, aspect, bounds);
    assert.ok(positioned.canvasX < 0 && positioned.canvasY < 0, `photo anchor leaves print at ${scale}%`);
    const leftInk = positioned.canvasX + (bounds.x / 100 - 0.5) * zone.width * positioned.scale / 100;
    const topInk = positioned.canvasY + (bounds.y / 100 - 0.5) * zone.height * positioned.scale / 100;
    assert.ok(Math.abs(leftInk) < 0.001, `visible left edge touches print at ${scale}%`);
    assert.ok(Math.abs(topInk) < 0.001, `visible top edge touches print at ${scale}%`);
    const rightInk = positioned.canvasX + ((bounds.x + bounds.width) / 100 - 0.5) * zone.width * positioned.scale / 100;
    const bottomInk = positioned.canvasY + ((bounds.y + bounds.height) / 100 - 0.5) * zone.height * positioned.scale / 100;
    assert.ok(rightInk <= 100.001 && bottomInk <= 100.001, `all visible ink stays inside print at ${scale}%`);
  }
});

test('Alpha-aware rotation, resizing and fallback stay within production-safe bounds', () => {
  const zone = { x: 15, y: 12, width: 70, height: 68 };
  const aspect = 0.8;
  const opaque = constrainFreePhotoTransform({ scale: 100, canvasX: 0, canvasY: 0 }, zone, aspect);
  assert.equal(opaque.canvasX, 35);
  assert.equal(opaque.canvasY, 34);
  const bounds = containPhotoAlphaBounds({ x: 30, y: 10, width: 45, height: 65 }, 1400, 2000, zone, aspect);
  const transformed = constrainFreePhotoTransform({
    canvasX: 100, canvasY: 0, rotation: 37, scale: 240, widthScale: 110, heightScale: 90,
  }, zone, aspect, bounds);
  const c = Math.cos(transformed.rotation * Math.PI / 180);
  const sine = Math.sin(transformed.rotation * Math.PI / 180);
  const sx = transformed.scale * transformed.widthScale / 10000;
  const sy = transformed.scale * transformed.heightScale / 10000;
  for (const sourceX of [bounds.x, bounds.x + bounds.width]) {
    for (const sourceY of [bounds.y, bounds.y + bounds.height]) {
      const localX = (sourceX / 100 - 0.5) * zone.width * sx;
      const localY = (sourceY / 100 - 0.5) * zone.height * sy;
      const printX = transformed.canvasX + c * localX - sine * localY / aspect;
      const printY = transformed.canvasY + sine * localX * aspect + c * localY;
      assert.ok(printX >= -0.001 && printX <= 100.001, 'rotated ink stays horizontally inside print');
      assert.ok(printY >= -0.001 && printY <= 100.001, 'rotated ink stays vertically inside print');
    }
  }
  const widePhoto = containPhotoAlphaBounds({ x: 0, y: 0, width: 100, height: 100 }, 1920, 1080, zone, aspect);
  assert.ok(widePhoto.y > 0, 'object-contain vertical letterboxing is accounted for');
  assert.equal(widePhoto.width, 100);
});
