import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessStudioImagePrintQuality } from '../src/lib/studioSmartImageQuality.js';
import { constrainUploadArtworkTransform, resolveUploadArtworkPlacement } from '../src/lib/customStudioV2ArtworkMetrics.js';

const upload = readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx', 'utf8');
const compare = readFileSync('src/components/storefront/custom-studio-v2/StudioArtworkComparison.jsx', 'utf8');
const review = readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');

test('floating preview auto-minimizes only in Upload enhancement controls and still restores on tap', () => {
  assert.match(upload, /enhancementPanelRef = useRef\(null\)/);
  assert.match(upload, /IntersectionObserver\(\(\[entry\]\) =>/);
  assert.match(upload, /observer\.observe\(node\)/);
  assert.match(upload, /return \(\) => observer\.disconnect\(\)/);
  assert.match(upload, /minimized=\{mobilePreviewMinimized \|\| \(enhancementPanelVisible && !previewRestoredInsideEnhancement\)\}/);
  assert.match(upload, /setPreviewRestoredInsideEnhancement\(true\)/);
  assert.match(upload, /data-gdp-free-artwork-enhancement="true"/);
  assert.doesNotMatch(readFileSync('src/components/storefront/custom-studio-v2/useStudioMobileFloatingPreview.js', 'utf8'), /enhancementPanelVisible/);
});

test('comparison provides large touch-scrollable masked slider and 2x zoom with accessible controls', () => {
  assert.match(compare, /data-gdp-smart-compare="slider-zoom"/);
  assert.match(compare, /data-gdp-smart-compare-viewport="true"/);
  assert.match(compare, /overflow-auto/);
  assert.match(compare, /aria-label="Drag to compare original and improved image"/);
  assert.match(compare, /aria-pressed=\{zoom === value\}/);
  assert.match(compare, /clipPath: `inset\(0 \$\{100 - split\}% 0 0\)`/);
  assert.match(upload, /<StudioArtworkComparison originalUrl=\{editor\.artwork\.url\} enhancedUrl=\{enhancementPreview\.url\}/);
  assert.match(upload, /Keep original · Cancel/);
  assert.match(upload, /Restore original artwork/);
});

test('final review covers front and back original-pixel quality without extra checkbox', () => {
  assert.match(review, /state\.designPath === 'upload' \? sides\.flatMap/);
  assert.match(review, /resolveStudioV2PrintGuide\(product, state\.size, side, state\.color\)/);
  assert.match(review, /constrainUploadArtworkTransform\(artwork, profile, editor\.transform \|\| \{\}\)/);
  assert.match(review, /originalPixelWidth: artwork\.originalPixelWidth/);
  assert.match(review, /data-gdp-review-quality-warning="upload-original-pixels"/);
  assert.match(review, /A 300-DPI production export does not restore missing details/);
  assert.match(review, /No extra confirmation is required/);
  assert.doesNotMatch(review, /data-gdp-review-quality-checkbox/);
});

test('preview quality guidance remains low when high-resolution output originated from a tiny image', () => {
  const profile = { widthIn: 12, heightIn: 14 };
  const artwork = { pixelWidth: 1920, pixelHeight: 2152, originalPixelWidth: 960, originalPixelHeight: 1076, sourceDpi: 72, sourceWidthIn: 13.33, sourceHeightIn: 14.94 };
  const placement = resolveUploadArtworkPlacement(artwork, profile, constrainUploadArtworkTransform(artwork, profile, { scale: 100 }));
  const quality = assessStudioImagePrintQuality({ ...artwork, printWidthIn: placement.widthIn, printHeightIn: placement.heightIn });
  assert.equal(quality.tone, 'red');
  assert.ok(quality.dpi < 200);
  assert.match(quality.message, /smaller print/);
});
