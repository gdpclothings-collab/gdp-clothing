import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessStudioImagePrintQuality, chooseBasicEnhancementScale } from '../src/lib/studioSmartImageQuality.js';

test('quality check uses actual source pixels divided by physical print inches', () => {
  const good = assessStudioImagePrintQuality({ pixelWidth: 3600, pixelHeight: 3600, printWidthIn: 12, printHeightIn: 12 });
  assert.equal(good.label, 'Good for printing');
  assert.equal(good.dpi, 300);
  const warn = assessStudioImagePrintQuality({ pixelWidth: 2400, pixelHeight: 2400, printWidthIn: 12, printHeightIn: 12 });
  assert.equal(warn.label, 'Could be improved');
  const bad = assessStudioImagePrintQuality({ pixelWidth: 600, pixelHeight: 600, printWidthIn: 12, printHeightIn: 12 });
  assert.equal(bad.label, 'Low quality at this size');
  assert.equal(bad.recommendedWidthIn, 2);
});

test('interpolated 2x pixels never inflate original print quality assessment', () => {
  const quality = assessStudioImagePrintQuality({
    pixelWidth: 3600, pixelHeight: 3600,
    originalPixelWidth: 800, originalPixelHeight: 800,
    printWidthIn: 12, printHeightIn: 12,
  });
  assert.equal(quality.tone, 'red');
  assert.ok(quality.dpi < 100);
  assert.match(quality.message, /cannot restore missing detail/);
});

test('missing dimensions and zero sizes are not called printable', () => {
  assert.equal(assessStudioImagePrintQuality({ pixelWidth: 500, pixelHeight: 500 }).label, 'Quality not checked');
  assert.equal(assessStudioImagePrintQuality({ pixelWidth: 0, pixelHeight: 500, printWidthIn: 3, printHeightIn: 3 }).dpi, 0);
});

test('basic free enhancer has strict size ceiling and a bounded scale factor', () => {
  assert.equal(chooseBasicEnhancementScale(0, 400), 0);
  assert.equal(chooseBasicEnhancementScale(400, 400), 2);
  assert.equal(chooseBasicEnhancementScale(6000, 4000), 0);
  assert.ok(chooseBasicEnhancementScale(1800, 1800) > 1);
  assert.ok(chooseBasicEnhancementScale(1800, 1800) < 2);
});

test('non-destructive Studio guard: original preserved, opt-in preview, and no payment changes', () => {
  const upload = readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx', 'utf8');
  assert.match(upload, /createBasicStudioEnhancement/);
  assert.match(upload, /originalArtwork: original/);
  assert.match(upload, /Restore original artwork/);
  assert.match(upload, /Apply improvement/);
  assert.match(upload, /data-gdp-smart-quality/);
  assert.doesNotMatch(upload, /stripe|checkout|paymentIntent/i);
  const refreshed = readFileSync('src/lib/customStudioV2Assets.js', 'utf8');
  assert.match(refreshed, /originalArtwork: await refreshAsset\(artwork\.originalArtwork\)/);
});
