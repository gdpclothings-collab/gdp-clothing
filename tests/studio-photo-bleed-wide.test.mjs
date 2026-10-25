import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { constrainFreePhotoTransform } from '../src/lib/customStudioV2PrintBounds.js';
import { constrainUploadArtworkTransform, resolveUploadArtworkPlacement } from '../src/lib/customStudioV2ArtworkMetrics.js';

const profile = { widthIn: 12, heightIn: 16 };
const zone = { x: 15, y: 12, width: 70, height: 68 };
const artwork = {
  pixelWidth: 3600, pixelHeight: 3600, sourceWidthIn: 12,
  sourceHeightIn: 12, sourceDpi: 300,
  contentBounds: { left: 0.1, right: 0.9, top: 0.1, bottom: 0.9 },
};

test('photo bleed keeps requested size, rotation and overshoot instead of silently shrinking', () => {
  for (const rotation of [-90, -33, 0, 45, 90]) {
    const input = { bleedCrop: true, scale: 650, widthScale: 170, heightScale: 70, rotation, canvasX: -30, canvasY: 140 };
    const result = constrainFreePhotoTransform(input, zone, 0.75, { x: 10, y: 10, width: 80, height: 80 });
    assert.equal(result.scale, input.scale);
    assert.equal(result.widthScale, input.widthScale);
    assert.equal(result.heightScale, input.heightScale);
    assert.equal(result.rotation, rotation);
    assert.equal(result.canvasX, -30);
    assert.equal(result.canvasY, 140);
  }
});

test('older photo transforms still fit inside print bounds', () => {
  const input = { scale: 650, widthScale: 170, heightScale: 70, rotation: 0, canvasX: -30, canvasY: 140 };
  const result = constrainFreePhotoTransform(input, zone, .75);
  assert.equal(result.bleedCrop, undefined);
  assert.ok(result.scale < input.scale);
  assert.ok(result.canvasX >= 0 && result.canvasX <= 100);
  assert.ok(result.canvasY >= 0 && result.canvasY <= 100);
});

test('Upload Artwork bleed allows clipping while legacy artwork remains safely fitted', () => {
  const input = { bleedCrop: true, scale: 250, widthScale: 150, heightScale: 130, rotation: 25, x: 90, y: -90 };
  const result = constrainUploadArtworkTransform(artwork, profile, input);
  assert.equal(result.scale, 250);
  assert.equal(result.x, 90);
  assert.equal(result.y, -90);
  const placement = resolveUploadArtworkPlacement(artwork, profile, result);
  assert.equal(placement.outsideRecommendedArea, true);
  const safe = constrainUploadArtworkTransform(artwork, profile, { ...input, bleedCrop: false });
  assert.ok(safe.scale < 250);
  assert.equal(resolveUploadArtworkPlacement(artwork, profile, safe).outsideRecommendedArea, false);
});

test('all customer upload paths have matching opt-in UI and bounded preview/production output', () => {
  const editor = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
  const upload = readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx', 'utf8');
  const protectedPng = readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');
  const uploadPng = readFileSync('src/lib/customStudioV2Production.js', 'utf8');
  const mobile = readFileSync('src/components/storefront/custom-studio-v2/StudioMobilePreviewMirror.jsx', 'utf8');
  const seasonal = readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx', 'utf8');
  assert.match(editor, /data-gdp-photo-bleed-crop/);
  assert.match(editor, /bleedCrop: true/);
  assert.match(editor, /constrainFreePhotoTransform/);
  assert.match(editor, /data-gdp-bootleg-free-photo-canvas/);
  assert.match(editor, /absolute left-1\/2 -translate-x-1\/2 overflow-hidden rounded-lg border border-dashed/);
  assert.match(upload, /data-gdp-upload-bleed-crop/);
  assert.match(upload, /bleedCrop: true/);
  assert.match(upload, /overflow-hidden rounded-lg border-2 border-dashed/);
  assert.match(mobile, /data-gdp-mirror-print-guide/);
  assert.match(mobile, /overflow-hidden/);
  // Production output canvases have the exact printable size. Canvas drawImage
  // clips at those bounds, using the same saved transform as the previews.
  assert.match(protectedPng, /constrainFreePhotoTransform\(transform/);
  assert.match(protectedPng, /context\.drawImage\(loaded\.image/);
  assert.match(uploadPng, /constrainUploadArtworkTransform\(artwork, profile, editor\.transform/);
  assert.match(uploadPng, /output\.context\.drawImage\(loaded\.image/);
  // Seasonal is a separate catalog-artwork pathway and is not changed by V1.
  assert.match(seasonal, /constrainSeasonalArtworkLayer/);
});
