import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
const layout = readFileSync('src/lib/customStudioV2BootlegTextLayout.js', 'utf8');
const api = readFileSync('src/lib/customerApi.js', 'utf8');

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
