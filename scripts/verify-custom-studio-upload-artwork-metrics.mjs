import fs from 'node:fs';
import {
  readEmbeddedArtworkDensity,
  resolveUploadArtworkPlacement,
  studioV2ArtworkQuality,
} from '../src/lib/customStudioV2ArtworkMetrics.js';

function assert(condition, message) {
  if (!condition) throw new Error(`Custom Studio artwork metrics verification failed: ${message}`);
}

function near(actual, expected, tolerance = 0.02) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

const editor = fs.readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx', 'utf8');
const production = fs.readFileSync('src/lib/customStudioV2Production.js', 'utf8');
const profile = { widthIn: 11.25, heightIn: 14 };

const paddedTwelveInchArtwork = {
  pixelWidth: 3600,
  pixelHeight: 3600,
  sourceDpi: 300,
  sourceDpiX: 300,
  sourceDpiY: 300,
  sourceWidthIn: 12,
  sourceHeightIn: 12,
  contentBounds: { left: 0.05, top: 0.05, right: 0.95, bottom: 0.95 },
};

const original = resolveUploadArtworkPlacement(paddedTwelveInchArtwork, profile, { scale: 100, x: 0, y: 0, rotation: 0 });
assert(near(original.widthIn, 12) && near(original.heightIn, 12), '12 × 12 in artwork must remain 12 × 12 in at 100%');
assert(original.sizeSource === 'embedded-physical-size', '300-DPI physical sizing must remain authoritative');
assert(near(original.effectiveDpi, 300), '12 in / 3600 px artwork must report 300 effective DPI');
assert(original.outsideRecommendedArea === false, 'transparent padding must not create a false outside-area warning');

const fullCanvas = resolveUploadArtworkPlacement({ ...paddedTwelveInchArtwork, contentBounds: { left: 0, top: 0, right: 1, bottom: 1 } }, profile, { scale: 100, x: 0, y: 0, rotation: 0 });
assert(fullCanvas.outsideRecommendedArea === true, 'printable pixels wider than the garment max area must warn');
assert(near(fullCanvas.overflow.left, 0.375) && near(fullCanvas.overflow.right, 0.375), 'overflow must be reported in physical inches');

const enlarged = resolveUploadArtworkPlacement(paddedTwelveInchArtwork, profile, { scale: 125, x: 0, y: 0, rotation: 0 });
assert(near(enlarged.widthIn, 15) && near(enlarged.effectiveDpi, 240), 'effective DPI must update as customer resizing changes print size');
assert(studioV2ArtworkQuality(enlarged.effectiveDpi).label === 'Acceptable', '200–299 DPI must be classified as acceptable');

const mobile72DpiArtwork = {
  pixelWidth: 1254,
  pixelHeight: 1254,
  sourceDpi: 72,
  sourceDpiX: 72,
  sourceDpiY: 72,
  sourceWidthIn: 17.4167,
  sourceHeightIn: 17.4167,
  contentBounds: { left: 0, top: 0, right: 1, bottom: 1 },
};
const mobileFit = resolveUploadArtworkPlacement(mobile72DpiArtwork, profile, { scale: 100, x: 0, y: 0, rotation: 0 });
assert(mobileFit.sizeSource === 'low-confidence-dpi-fit', '72-DPI mobile metadata must not control physical print size');
assert(near(mobileFit.widthIn, 11.25) && near(mobileFit.heightIn, 11.25), 'square 72-DPI mobile artwork must auto-fit proportionally to the garment print area');
assert(near(mobileFit.effectiveDpi, 111.5, 0.1), 'effective DPI must be calculated from the fitted print size');
assert(mobileFit.outsideRecommendedArea === false, 'auto-fitted low-DPI mobile artwork must not start outside the print area');

const mobile96DpiArtwork = { ...mobile72DpiArtwork, sourceDpi: 96, sourceDpiX: 96, sourceDpiY: 96, sourceWidthIn: 13.0625, sourceHeightIn: 13.0625 };
const mobile96Fit = resolveUploadArtworkPlacement(mobile96DpiArtwork, profile, { scale: 100, x: 0, y: 0, rotation: 0 });
assert(mobile96Fit.sizeSource === 'low-confidence-dpi-fit', '96-DPI screen metadata must use safe proportional auto-fit');
assert(near(mobile96Fit.widthIn, 11.25) && near(mobile96Fit.heightIn, 11.25), '96-DPI screen artwork must keep its aspect ratio while fitting');

const minimumTrustedArtwork = { ...paddedTwelveInchArtwork, sourceDpi: 150, sourceDpiX: 150, sourceDpiY: 150, sourceWidthIn: 10, sourceHeightIn: 10 };
const minimumTrusted = resolveUploadArtworkPlacement(minimumTrustedArtwork, profile, { scale: 100, x: 0, y: 0, rotation: 0 });
assert(minimumTrusted.sizeSource === 'embedded-physical-size' && near(minimumTrusted.widthIn, 10), '150-DPI physical metadata must remain trusted');

const legacy = resolveUploadArtworkPlacement({ pixelWidth: 3600, pixelHeight: 3600 }, profile, { scale: 100, x: 0, y: 0, rotation: 0 });
assert(near(legacy.widthIn, 8.1), 'artwork without embedded DPI must preserve the previous 72% contain behavior');

const png = new Uint8Array(33);
png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
const view = new DataView(png.buffer);
view.setUint32(8, 9, false);
png.set([112, 72, 89, 115], 12);
view.setUint32(16, 11811, false);
view.setUint32(20, 11811, false);
view.setUint8(24, 1);
const density = readEmbeddedArtworkDensity(png.buffer, 'image/png');
assert(density && near(density.dpiX, 300, 0.2) && near(density.dpiY, 300, 0.2), 'PNG pHYs 300-DPI metadata must be recognized');

for (const token of [
  'analyzeStudioV2ArtworkFile',
  'data-gdp-artwork-metrics="true"',
  'Current print size',
  'Effective DPI',
  'Transparent padding is ignored',
  'Reset to original size & top position',
  'setLegacyArtworkDimensions',
  'artworkForPlacement',
  'topAlignedArtworkTransform',
  'placement?.printableBounds?.minY',
  'transform: topAlignedArtworkTransform(artwork, printGuide)',
  'New artwork starts at the top of the printable area',
]) assert(editor.includes(token), `upload editor contract is missing: ${token}`);

assert(!editor.includes('onPatch({ artwork: { ...editor.artwork, pixelWidth, pixelHeight } })'), 'legacy dimension hydration must not invalidate an already confirmed restored design');
assert(editor.includes('setLegacyArtworkDimensions({ url: editor.artwork.url, pixelWidth, pixelHeight })'), 'legacy dimensions must stay local to the preview instead of mutating the approved draft');

assert(production.includes("import { resolveUploadArtworkPlacement } from '@/lib/customStudioV2ArtworkMetrics';"), 'production renderer must share the exact placement math');
assert(production.includes('const placement = resolveUploadArtworkPlacement({'), 'upload production rendering must use shared physical placement');
assert(production.includes('const drawWidth = placement.widthIn * output.safeDpi;'), 'production width must be derived from physical inches');
assert(production.includes('const drawHeight = placement.heightIn * output.safeDpi;'), 'production height must be derived from physical inches');

console.log('Custom Studio upload artwork metrics verification passed.');
