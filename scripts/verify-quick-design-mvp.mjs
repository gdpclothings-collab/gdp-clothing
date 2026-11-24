import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  QUICK_DESIGN_BACKGROUNDS,
  QUICK_DESIGN_MAX_PHOTOS,
  QUICK_DESIGN_MAX_FILE_BYTES,
  validateQuickDesignFile,
  quickDesignLayoutCount,
  getQuickDesignSubjectFit,
  QUICK_DESIGN_PRINT_SIZE,
  getQuickDesignHeadlineY,
  QUICK_DESIGN_NAME_PHOTO_GAP_IN,
  QUICK_DESIGN_NAME_PHOTO_GAP_PX,
  getQuickDesignDTFStormAlpha,
  getQuickDesignStormTopScale,
} from '../src/lib/quickDesignCanvas.js';
import { QUICK_DESIGN_GARMENTS, QUICK_DESIGN_COLORS, QUICK_DESIGN_SIDES, QUICK_DESIGN_PRINT_PLACEMENTS, getQuickDesignStudioFabricAsset, QUICK_DESIGN_BLANK_ATLAS_URL, QUICK_DESIGN_BLANK_ATLAS_SIZE, getQuickDesignBlankGarmentCrop, getQuickDesignBalancedArtworkPlacement, getQuickDesignGarmentPrintZone, QUICK_DESIGN_GARMENT_SIZE_SCALES, QUICK_DESIGN_TORSO_CENTERS } from '../src/lib/quickDesignGarmentMockup.js';
import { detectQuickDesignBackground } from '../src/lib/quickDesignTransparency.js';
import { getQuickDesignPhaseCLayout, getQuickDesignPhaseCRenderOrder, getQuickDesignFacePriorityRegion, getQuickDesignCollageConnections, QUICK_DESIGN_PHASE_C_REFERENCE } from '../src/lib/quickDesignPhaseCLayout.js';

// Reference-image QA: the selected GDP storm remains behind the uploaded
// dogs, but its upper, lower and side edges MUST NOT be a printed rectangle.
assert.equal(getQuickDesignStormTopScale(.16), .72,
  'Upper storm source is compressed to keep details inside the shirt');
assert.equal(getQuickDesignStormTopScale(.70), 1,
  'Bottom storm bitmap retains its original width');
assert.equal(getQuickDesignDTFStormAlpha(255, .5, .2), 0,
  'No hard poster edge should appear above the personalized name');
assert.equal(getQuickDesignDTFStormAlpha(255, .02, .6), 0,
  'The left edge must blend out instead of printing a straight boundary');
assert.equal(getQuickDesignDTFStormAlpha(255, .98, .6), 0,
  'The right edge must blend out instead of printing a straight boundary');
assert.equal(getQuickDesignDTFStormAlpha(255, .5, .99), 0,
  'Background must end in an irregular fade rather than a bottom box');
assert.equal(getQuickDesignDTFStormAlpha(9, .5, .65), 0,
  'Discard invisible haze that can cause DTF underbase artifacts');
assert.ok(getQuickDesignDTFStormAlpha(255, .5, .66) >= 120,
  'Storm colours must remain visible behind the pets');
assert.ok(getQuickDesignDTFStormAlpha(255, .5, .66) < 0.70 * 255,
  'Even brightest flames remain visually secondary to dogs and letters');
assert.equal(QUICK_DESIGN_MAX_PHOTOS, 5);
assert.equal(QUICK_DESIGN_MAX_FILE_BYTES, 10 * 1024 * 1024);
assert.equal(quickDesignLayoutCount(), 5);
assert.equal(await detectQuickDesignBackground({ type: 'image/jpeg', size: 100 }), 'needs-removal');
assert.equal(await detectQuickDesignBackground({ type: 'image/heic', size: 100 }), 'unreadable');
const transparencyCheck = readFileSync('src/lib/quickDesignTransparency.js', 'utf8');
assert.match(transparencyCheck, /cornersAreTransparent/);
assert.match(transparencyCheck, /already-transparent/);
assert.doesNotMatch(transparencyCheck, /fetch\(|supabase\.functions|api\.remove\.bg|X-API-Key/i,
  'Alpha preflight must be local and free');
assert.equal(QUICK_DESIGN_PHASE_C_REFERENCE.nameAtTop, true);
assert.equal(QUICK_DESIGN_PHASE_C_REFERENCE.subjectCentered, true);
assert.equal(QUICK_DESIGN_PHASE_C_REFERENCE.backgroundAnchoredBottom, true);
assert.equal(QUICK_DESIGN_PHASE_C_REFERENCE.transparentArtworkEdge, true);
for (let count = 1; count <= 5; count += 1) {
  const layout = getQuickDesignPhaseCLayout(count);
  assert.equal(layout.length, count, 'Every uploaded photo must be used once');
  for (const slot of layout) {
    assert.ok(slot.x >= 0 && slot.y >= 0 && slot.w > 0 && slot.h > 0);
    assert.ok(slot.x + slot.w <= 1.001 && slot.y + slot.h <= 1.001,
      'Phase H pet composition must fit the A3 print layout');
  }
  assert.deepEqual(getQuickDesignPhaseCRenderOrder(count).map((item) => item.photoIndex).sort(),
    Array.from({length: count}, (_, i) => i), 'Every uploaded pet must appear once');
  const heroTop = layout[0].y * QUICK_DESIGN_PRINT_SIZE.previewHeightPx;
  const nameY = getQuickDesignHeadlineY(count);
  assert.ok(nameY > QUICK_DESIGN_PRINT_SIZE.previewHeightPx * .145,
    'Personalized name must sit visibly closer to uploaded faces than the old floating header');
  assert.ok(heroTop - nameY >= 42 && heroTop - nameY <= 57,
    'Name baseline must sit about one font-half-height directly above the primary photo');
}
assert.equal(getQuickDesignPhaseCLayout(1)[0].role, 'hero');
assert.equal(QUICK_DESIGN_NAME_PHOTO_GAP_IN, .1);
assert.equal(QUICK_DESIGN_NAME_PHOTO_GAP_PX, 6,
  'Tight owner-requested gap is about 6 pixels at A3 preview scale');
for (const photoCount of [1, 2, 3, 4, 5]) {
  for (const { photoTop, nameBottom } of [
    { photoTop: 340, nameBottom: 255 },
    { photoTop: 455, nameBottom: 280 },
  ]) {
    const y = getQuickDesignHeadlineY(photoCount, { photoTop, nameBottom });
    const previousY = getQuickDesignHeadlineY(photoCount);
    const resultingGap = photoTop - (nameBottom + y - previousY);
    assert.ok(Math.abs(resultingGap - QUICK_DESIGN_NAME_PHOTO_GAP_PX) <= 1,
      'Solid name-to-photo gap must be close to 0.1 inch, independent of photo count');
  }
}
for (let count = 2; count <= 5; count += 1) {
  const layers = getQuickDesignPhaseCLayout(count);
  const connections = getQuickDesignCollageConnections(count);
  const seen = new Set([0]);
  let previousSize = 0;
  while (previousSize !== seen.size) {
    previousSize = seen.size;
    for (const { photoIndex, connectsTo } of connections) {
      if (seen.has(photoIndex)) connectsTo.forEach(i => seen.add(i));
    }
  }
  assert.equal(seen.size, count, 'All 2–5 collage layers must touch a connected subject, with no isolated photos');
  const left = Math.min(...layers.map(s => s.x));
  const right = Math.max(...layers.map(s => s.x + s.w));
  assert.ok(Math.abs((left + right) / 2 - .5) < .014,
    'All photo counts should remain optically centered and balanced');
  if (count >= 3) {
    const supportPhotos = layers.filter(s => s.role === 'support');
    assert.equal(supportPhotos.length, 2);
    assert.ok(Math.abs((supportPhotos[0].x + supportPhotos[1].x + supportPhotos[0].w) - 1) < .001,
      'Mirrored left/right support photos should share symmetrical horizontal bounds');
  }
}

const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.h && a.y + a.h > b.y;
for (let count = 1; count <= 5; count += 1) {
  const layers = getQuickDesignPhaseCRenderOrder(count);
  const faces = layers.map(getQuickDesignFacePriorityRegion);
  for (let i = 0; i < layers.length; i += 1) {
    assert.ok(faces[i].w > 0 && faces[i].h > 0);
    assert.ok(faces[i].x >= 0 && faces[i].y >= 0 &&
      faces[i].x + faces[i].w <= 1 && faces[i].y + faces[i].h <= 1,
    'The face-priority region should remain inside the artwork');
    for (let j = i + 1; j < layers.length; j += 1) {
      assert.equal(intersects(faces[i], layers[j]), false,
        `Face-priority region of image ${layers[i].photoIndex + 1} is covered by later image ${layers[j].photoIndex + 1} for count ${count}`);
    }
  }
}
for (const [sw, sh] of [[1000, 1000], [200, 1200], [1200, 200], [400, 800], [800, 400]]) {
  const fitted = getQuickDesignSubjectFit(sw, sh, 320, 460);
  assert.deepEqual(fitted.crop, { x: 0, y: 0, w: sw, h: sh },
    'Opaque photos retain the complete face and source image');
  assert.ok(fitted.imageW <= 320 && fitted.imageH <= 460 && fitted.x >= 0 && fitted.y >= 0,
    'Opaque photos must fit without cropped edges');
  assert.ok(Math.abs(fitted.imageW / fitted.imageH - sw / sh) < 1e-8,
    'No stretched pet or person anatomy');
}
const transparentCutout = getQuickDesignSubjectFit(800, 1200, 300, 400, { x: 50, y: 80, w: 600, h: 800 });
assert.ok(transparentCutout.imageW <= 300 && transparentCutout.imageH <= 400,
  'Trimmed transparent subject must fit without cropping');

assert.deepEqual(QUICK_DESIGN_GARMENTS.map((item) => item.id), ['tshirt', 'sweatshirt', 'hoodie']);
assert.deepEqual(QUICK_DESIGN_SIDES.map((item) => item.id), ['front', 'back']);
assert.deepEqual(QUICK_DESIGN_COLORS.map((item) => item.id), ['black', 'white']);
assert.deepEqual(QUICK_DESIGN_COLORS.map((item) => item.label), ['Black', 'White']);
let checkedCombinations = 0;
for (const garment of QUICK_DESIGN_GARMENTS) {
  for (const color of QUICK_DESIGN_COLORS) {
    for (const side of QUICK_DESIGN_SIDES) {
      checkedCombinations += 1;
      const position = QUICK_DESIGN_PRINT_PLACEMENTS[garment.id]?.[side.id];
      assert.equal(position?.length, 4, 'Every garment/side needs a print position');
      const [x, y, w, h] = position;
      assert.ok(x >= 160 && x + w <= 440, 'Large print must still remain inside garment torso');
      assert.ok(y >= 140 && y + h <= (garment.id === 'hoodie' ? 455 : 495),
        'Large artwork must avoid the hoodie kangaroo pocket and the garment hem');
      assert.ok(w >= 225 && w <= 260 && h >= 265 && h <= 345,
        'Phase I design must visibly exceed old small Phase H print zone');
      assert.ok(Math.abs((x + w / 2) - 300) < .001, 'Large artwork must be horizontally centered');
      assert.ok(color.id === 'black' || color.id === 'white');
    }
  }
}
assert.equal(checkedCombinations, 12, '3 garments × 2 colors × 2 print sides');

// Calibrated to the owner's reference T-shirt (prominent full chest layout).
assert.deepEqual(QUICK_DESIGN_PRINT_PLACEMENTS.tshirt.front, [170, 151, 260, 340]);
assert.deepEqual(QUICK_DESIGN_PRINT_PLACEMENTS.sweatshirt.front, [177, 161, 246, 314]);
assert.deepEqual(QUICK_DESIGN_PRINT_PLACEMENTS.hoodie.front, [185, 185, 230, 268]);
assert.equal(QUICK_DESIGN_GARMENT_SIZE_SCALES.XS, .78);
assert.equal(QUICK_DESIGN_GARMENT_SIZE_SCALES.S, .90);
for (const garment of QUICK_DESIGN_GARMENTS) {
  for (const side of QUICK_DESIGN_SIDES) {
    const base = getQuickDesignGarmentPrintZone(garment.id, side.id, 'M');
    assert.deepEqual(base.slice(1), QUICK_DESIGN_PRINT_PLACEMENTS[garment.id][side.id].slice(1));
    assert.equal(base[0] + base[2] / 2, QUICK_DESIGN_TORSO_CENTERS[garment.id].black[side.id]);
    for (const color of QUICK_DESIGN_COLORS) {
      const torsoCenter = QUICK_DESIGN_TORSO_CENTERS[garment.id][color.id][side.id];
      for (const size of ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']) {
        const zone = getQuickDesignGarmentPrintZone(garment.id, side.id, size, color.id);
        assert.ok(zone[2] <= base[2] && zone[3] <= base[3],
          'Selected size may not enlarge beyond the safe mockup zone');
        assert.ok(Math.abs(zone[0] + zone[2] / 2 - torsoCenter) < 1e-8,
          'Optical print center must match the torso in the actual selected garment photo');
        assert.ok(Math.abs(zone[1] + zone[3] / 2 - (base[1] + base[3] / 2)) < 1e-8,
          'Selected size must preserve vertical placement');
        assert.ok(zone[0] >= 155 && zone[0] + zone[2] <= 465,
          'Garment print must remain inside torso safety bounds');
        const otherSide = getQuickDesignGarmentPrintZone(garment.id,
          side.id === 'front' ? 'back' : 'front', size, color.id);
        assert.deepEqual(zone.slice(1).slice(1), otherSide.slice(2),
          'Front/back print width and height must match each other');
        assert.equal(zone[1], otherSide[1],
          'Front/back print vertical placement must remain identical');
      }
    }
  }
}


// Phase G: twelve real blank-image regions sourced from the customer-approved
// black/white front/back garment sheet. All are clean, local image assets.
const atlasData = readFileSync(resolve('public' + QUICK_DESIGN_BLANK_ATLAS_URL));
assert.equal(atlasData.subarray(0, 4).toString(), 'RIFF', 'Atlas is an actual local WebP image');
assert.equal(atlasData.subarray(8, 12).toString(), 'WEBP', 'Garment images must decode as WebP');
assert.deepEqual(QUICK_DESIGN_BLANK_ATLAS_SIZE, {
  width: 1536, height: 720, cellWidth: 256, cellHeight: 360,
});
const atlasRegions = new Set();
for (const garment of QUICK_DESIGN_GARMENTS) {
  assert.deepEqual(QUICK_DESIGN_PRINT_PLACEMENTS[garment.id].front,
    QUICK_DESIGN_PRINT_PLACEMENTS[garment.id].back,
    'Front/back artwork scale and vertical placement must match per garment');
  for (const color of QUICK_DESIGN_COLORS) {
    for (const side of QUICK_DESIGN_SIDES) {
      const crop = getQuickDesignBlankGarmentCrop(garment.id, color.id, side.id);
      assert.equal(crop.sw, 256);
      assert.equal(crop.sh, 360);
      assert.ok(crop.sx >= 0 && crop.sy >= 0 &&
        crop.sx + crop.sw <= 1536 && crop.sy + crop.sh <= 720,
        'No garment should crop outside the 12-view original blank sheet');
      assert.ok(crop.dx >= 0 && crop.dy >= 0 &&
        crop.dx + crop.dw <= 600 && crop.dy + crop.dh <= 720,
        'Garment preview should remain inside customer preview canvas');
      atlasRegions.add(crop.sx + ':' + crop.sy);
    }
  }
}
assert.equal(atlasRegions.size, 12, 'Each garment, color and side must map to its own approved blank image');

for (const side of ['front', 'back']) {
  for (const color of ['black', 'white']) {
    const path = getQuickDesignStudioFabricAsset('sweatshirt', side, color);
    assert.equal(path, '/images/custom-studio/gildan-crewneck-' + side + '-colors.svg#' + color);
    assert.ok(existsSync(resolve('public' + path.split('#')[0])),
      'Missing approved Custom Studio ' + side + ' fabric asset');
    assert.equal(getQuickDesignStudioFabricAsset('tshirt', side, color), null);
    assert.equal(getQuickDesignStudioFabricAsset('hoodie', side, color), null);
  }
}


assert.ok(QUICK_DESIGN_BACKGROUNDS.length >= 5, 'Must reuse real GDP bootleg backgrounds');
for (const template of QUICK_DESIGN_BACKGROUNDS) {
  assert.equal(template.category, 'photo_bootleg');
  assert.ok(existsSync(resolve('public' + template.fullAsset)), 'Missing GDP background: ' + template.fullAsset);
}
assert.equal(validateQuickDesignFile({ type: 'image/jpeg', size: 1000 }), '');
assert.equal(validateQuickDesignFile({ type: 'image/png', size: 1000 }), '');
assert.equal(validateQuickDesignFile({ type: 'image/webp', size: 1000 }), '');
assert.ok(validateQuickDesignFile({ type: 'image/heic', size: 1000 }));
assert.ok(validateQuickDesignFile({ type: 'image/jpeg', size: 12 * 1024 * 1024 }));

const app = readFileSync('src/App.jsx', 'utf8');
const nav = readFileSync('src/components/storefront/StoreNav.jsx', 'utf8');
const page = readFileSync('src/pages/QuickDesign.jsx', 'utf8');
const canvas = readFileSync('src/lib/quickDesignCanvas.js', 'utf8');
assert.match(app, /path="\/quick-design" element=\{<QuickDesign \/>}/);
assert.match(nav, /label: "Quick Design", path: "\/quick-design"/);
assert.match(page, /Promise\.all|renderQuickDesignArtwork/);
assert.match(page, /salesLeadApi\.submit/);
assert.match(page, /original photos and previews are NOT uploaded/);
assert.match(page, /rightsConfirmed/);
assert.doesNotMatch(canvas, /drawWatermark\(|GDP CLOTHING  •  SAMPLE|watermark.*fillText/i,
  'Neither preview nor A3 artwork may contain repeated sample watermarks');
assert.doesNotMatch(canvas, /fetch\(|supabase\.|openai|replicate|remove\.bg/i, 'Preview generation must remain local and free');
assert.doesNotMatch(page, /checkout\/payment|stripe\.confirm|createPaymentIntent/);
assert.match(canvas, /const PREVIEW_H = 1061/);
assert.deepEqual(
  { widthMm: QUICK_DESIGN_PRINT_SIZE.widthMm, heightMm: QUICK_DESIGN_PRINT_SIZE.heightMm,
    widthPx: QUICK_DESIGN_PRINT_SIZE.targetWidthPx, heightPx: QUICK_DESIGN_PRINT_SIZE.targetHeightPx },
  { widthMm: 297, heightMm: 420, widthPx: 3508, heightPx: 4961 }
);
assert.ok(Math.abs(QUICK_DESIGN_PRINT_SIZE.previewWidthPx / QUICK_DESIGN_PRINT_SIZE.previewHeightPx - 297 / 420) < .0005);
assert.match(canvas, /outputSize === 'a3'/);
assert.match(canvas, /canvas\.width \/ PREVIEW_W, canvas\.height \/ PREVIEW_H/,
  'A3 render must rerender source photos and original effects at A3 output scale');
assert.match(canvas, /detailScale = Math.max\(1, ctx\.getTransform\(\)\.a\)/,
  'Photo and backdrop layers must rasterize at export resolution');
assert.match(canvas, /quickDesignFont/);
assert.match(canvas, /paintPremiumTextGlyph/);
assert.match(canvas, /fontSizePercent = 100/);
assert.match(canvas, /premiumStyle = 'gold-chrome'/);
const mockupCode = readFileSync('src/lib/quickDesignGarmentMockup.js', 'utf8');
assert.match(mockupCode, /selectedGarment === 'hoodie'/);
assert.match(mockupCode, /selectedSide = side === 'back'/);
assert.match(mockupCode, /not certified/);
assert.match(mockupCode, /selectedColor = QUICK_DESIGN_COLORS/);
assert.match(mockupCode, /const OUTPUT_SCALE = 2/, 'Render double-density device mockups');
assert.match(mockupCode, /loadApprovedBlankGarments\(\)/,
  'The customer-approved sheet must be attempted before old fabric fallbacks');
assert.match(mockupCode, /ctx\.drawImage\(approvedAtlas, crop\.sx, crop\.sy, crop\.sw, crop\.sh/,
  'The displayed garment must come from the selected blank atlas region');
assert.ok(mockupCode.indexOf('const approvedAtlas = await loadApprovedBlankGarments()') <
  mockupCode.indexOf('const fabricAssetUrl = getQuickDesignStudioFabricAsset(selectedGarment, selectedSide, selectedColor)'),
  'Prioritize the approved customer garment sheet over Custom Studio fallback assets');

assert.ok(mockupCode.includes('renderStudioCrewneckFabric(ctx, studioGarment, selectedColor)'),
  'Quick Design must reuse existing Custom Studio fabric templates for crewneck garments');

assert.match(mockupCode, /ctx\.scale\(OUTPUT_SCALE, OUTPUT_SCALE\)/);
assert.match(mockupCode, /ctx\.imageSmoothingQuality = 'high'/);
assert.match(mockupCode, /drawSeamDetails\(ctx, selectedGarment, selectedColor\)/);
assert.match(mockupCode, /getQuickDesignGarmentPrintZone\(garment, side, size, color\)/,
  'Art renderer must respect selected garment size and larger placement zones');
assert.match(page, /size: customer\.size/,
  'React must pass size into the actual garment mockup renderer');
assert.match(page, /garmentSide, customer\.size, placementChosen, previewBusy/,
  'Switching garment size must refresh the preview');
assert.doesNotMatch(canvas, /GDP CLOTHING  •  SAMPLE|function drawWatermark/,
  'Phase H requires a clean sample free of repeated text overlays');
assert.match(page, /A3 portrait, 297 x 420 mm/);
assert.doesNotMatch(page, /Previews are watermarked|Artwork format: 12 x 16 inches/);
assert.match(mockupCode, /getQuickDesignBalancedArtworkPlacement/);
assert.match(mockupCode, /measureQuickDesignArtworkContent/,
  'Artwork must center the visible alpha content, not the transparent image bounds');
assert.match(mockupCode, /visualCenterX/,
  'Art placement must include alpha-weighted optical centering');
assert.match(mockupCode, /getQuickDesignGarmentPrintZone\(garment, side, size, color\)/,
  'Selected garment colour and print side must guide actual cloth torso axis');
assert.notEqual(QUICK_DESIGN_TORSO_CENTERS.tshirt.white.front, 300,
  'Generated garment images are not all centered at x=300');
assert.match(canvas, /measureQuickDesignHeadlineBottom\(/);
assert.match(canvas, />= 128\) return y \+ 1/,
  'Measure the main lettering rather than distant blur/glow');
assert.match(canvas, /getQuickDesignVisiblePhotoTop\(/);
assert.match(canvas, /paintHeadline\(ctx, headline, alignedHeadlineY/,
  'Headline Y must derive from visible rendered photo and glyph bounds');
for (const garment of QUICK_DESIGN_GARMENTS) {
  const zone = QUICK_DESIGN_PRINT_PLACEMENTS[garment.id].front;
  const skewedArtwork = getQuickDesignBalancedArtworkPlacement(zone, 750, 1061, { x: 220, y: 160, w: 290, h: 550 });
  assert.ok(Math.abs(skewedArtwork.dx + skewedArtwork.dw / 2 - 300) < .001,
    'Visible design must be horizontally centered for ' + garment.id);
  assert.ok(Math.abs(skewedArtwork.dy + skewedArtwork.dh / 2 - (zone[1] + zone[3] / 2)) < .001,
    'Visible design must be vertically centered in the printable chest for ' + garment.id);
  assert.ok(skewedArtwork.dw <= zone[2] && skewedArtwork.dh <= zone[3],
    'Visible artwork must remain entirely inside the selected print zone');
}
assert.match(page, /only\s+\{garmentSide\}\s+printing/i);

assert.match(mockupCode, /color === 'white'/);
assert.match(mockupCode, /fillGarment\(ctx, outline, selectedColor\)/);
assert.match(mockupCode, /drawHood\(ctx, selectedSide, selectedColor\)/);
assert.match(mockupCode, /drawArtwork\(ctx, artwork, selectedGarment, selectedSide, selectedColor, size\)/);
assert.match(mockupCode, /selectedColor\.toUpperCase\(\)/);
assert.match(page, /Your garment preview/);
assert.match(page, /data-gdp-garment-first="true"/, 'Garment selection must be first');
assert.ok(page.indexOf('data-gdp-garment-first="true"') < page.indexOf('number="2">Upload photos'), 'Garment choice precedes photo upload');
assert.match(page, /data-gdp-color-selector="true"/, 'Color choices must be visible after garment selection');
assert.match(page, /QUICK_DESIGN_COLORS\.map/, 'Both black and white selectors must render');
assert.ok(page.indexOf('data-gdp-color-selector="true"') < page.indexOf('aria-label="Choose print side"'), 'Garment → Color → Front/Back order must be preserved');
assert.match(page, /setGarmentColor\(''\)/, 'Changing garment resets color');
assert.match(page, /setGarmentSide\(''\)/, 'Changing color resets print side');
assert.match(page, /selectedColor && QUICK_DESIGN_SIDES/, 'All 3 choices must gate photo upload and mockup');
assert.match(page, /disabled=\{!placementChosen\}/, 'Uploading is blocked until all three choices are made');
assert.match(page, /color: garmentColor/, 'Color must reach the garment painter');
assert.match(page, /garmentColor \+ '-' \+ garment \+ '-' \+ garmentSide/, 'Downloaded and shared mockup filename must include color');
assert.match(page, /'Requested garment color: '/, 'Customer request must record garment color');
assert.match(page, /garmentType: selectedColor\.label/, 'Lead submission must include garment color');
assert.match(page, /data-gdp-preview-gated="true"/, 'Mockup must require explicit garment and side');
assert.match(page, /data-gdp-garment-image="true"/);
assert.match(page, /setGarmentSide\(''\)/, 'Switching garment resets side');
assert.match(page, /renderQuickDesignGarmentMockup\(/, 'Selected garment must render');
assert.doesNotMatch(page, /data-gdp-mockup-gallery|QUICK_DESIGN_GARMENTS\.flatMap/,
  'Do not display a six-image gallery instead of the selected preview');
assert.match(page, /placementChosen/, 'Require garment/side before submission');
assert.doesNotMatch(page, /Compare your two samples|Choose Sample [AB]|Sample [AB]/, 'Phase C must not expose Sample A/B');
assert.match(page, /Premium text style/);
assert.match(page, /Name font size/);
assert.match(page, /'Requested print side: '/);
assert.match(page, /fontSizePercent,/);
assert.match(page, /premiumStyle,/);
assert.doesNotMatch(mockupCode, /fetch\(|remove\.bg|stripe|openai/i, 'Garment preview must run without network or paid generation');
assert.match(canvas, /curve === 'up' \|\| curve === 'down'/);
assert.match(page, /data-gdp-remove-photos="true"/, 'One clear removal button must follow upload');
assert.match(page, /data-gdp-removal-help="true"/, 'Troubleshooting must be collapsible');
assert.match(page, /<summary className="cursor-pointer py-1 font-semibold text-white\/80">Background removal help<\/summary>/);
assert.doesNotMatch(page, /Automatic background removal with remove\.bg \(optional\)/, 'Do not show duplicate lengthy consent checkbox');
assert.doesNotMatch(page, /Phase B preview: background removal starts OFF/, 'Remove long development notice');
assert.match(page, /Uses remove\.bg for opaque photos only/, 'Keep short external-provider consent next to button');
assert.match(page, /url: item\.cutoutUrl \|\| item\.url/, 'Keep successfully processed cutouts when processing is paused or fails');
assert.match(page, /requestQuickDesignRemoveBgCutout\(target\.file\)/);
assert.match(page, /detectQuickDesignBackground\(target\.file\)/);
assert.match(page, /bgStatus: 'inspecting'/,
  'Local alpha classification must run immediately after any upload');
assert.match(page, /bgStatus === 'inspecting'/);
assert.match(page, /item\.bgStatus === 'eligible'/,
  'Opaque-only button eligibility must be explicit');
assert.match(page, /showRemovalHelp && <details/,
  'Hide remove.bg controls entirely after transparent-only uploads');
assert.match(page, /data-gdp-transparency-ready="true"/);
assert.match(canvas, /getQuickDesignHeadlineY\(images\.length\)/,
  'Name placement must use current photo layout without changing uploaded images');
assert.ok(page.indexOf('photos.filter((item) => item.bgStatus === \'inspecting\')') <
  page.indexOf("const target = photos.find((item) => item.bgStatus === 'pending')"),
  'Free local transparency detection must precede remove.bg processing');
assert.match(page, /transparency === 'already-transparent'/);
assert.match(page, /data-gdp-photo-status="transparent"/);
assert.doesNotMatch(page, /removeQuickDesignBackground\(/, 'Experimental device model must not process uploads anymore');
const help = readFileSync('src/components/storefront/QuickDesignHelp.jsx', 'utf8');
const fontStyles = readFileSync('src/pages/quickDesignFonts.css', 'utf8');
assert.match(page, /data-gdp-help-trigger="header"/);
assert.match(page, /data-gdp-help-trigger="request"/);
assert.match(page, /<QuickDesignHelp onClose=/);
assert.match(help, /role="dialog" aria-modal="true"/);
assert.match(help, /https:\/\/gdpclothing\.ca\/pages\/contact/);
assert.match(help, /Copy design details/);
assert.match(help, /automatically checks PNG\/WebP transparency locally/);
assert.match(help, /Step 1: choose a T-shirt/);
assert.match(help, /then choose Black or White/);
assert.match(help, /'Garment colour: ' \+ \(details\?\.garmentColor/);
assert.doesNotMatch(help, /Phase B Samples A|Sample A or B/);
assert.match(fontStyles, /fonts\.googleapis\.com/);
assert.match(fontStyles, /Anton.*Bangers.*Bebas\+Neue.*Graduate.*Rye/);
assert.doesNotMatch(page + help + canvas, /api\.openai\.com|createPaymentIntent|stripe\.confirm|https:\/\/api\.remove\.bg/i, 'Browser must never embed a remove.bg endpoint/key or payment integration');
assert.match(page, /href="https:\/\/www\.remove\.bg\/" target="_blank" rel="noopener noreferrer"/);
assert.match(page, /setAutoCutout\(false\)/);
assert.match(page, /overflow-x-clip/);
assert.match(page, /data-gdp-photo-grid="true"/);
assert.match(page, /setCutoutUnavailable\(true\)/);
assert.match(page, /setAutoCutout\(false\)/);
assert.match(canvas, /trimmedAlphaBounds/);
assert.match(canvas, /paintPhaseCPortraits/);
assert.match(canvas, /getQuickDesignSubjectFit\(sw, sh, w, h, crop\)/,
  'Photo rendering must use non-cropping contain mode for both opaque and transparent sources');
assert.doesNotMatch(canvas, /Math.max\(layer.width \/ crop.w, layer.height \/ crop.h\)/,
  'Cover scaling would crop faces');
assert.match(canvas, /export async function renderQuickDesignNamePreview/);
assert.match(canvas, /paintHeadline\(ctx, headline \|\| 'YOUR NAME', 195/,
  'The selected-font preview must share the final curved letter renderer');
assert.match(page, /data-gdp-font-curve=\{curve\}/);
assert.match(page, /data-gdp-font-preview="true"/);
assert.match(page, /Make photo /);
assert.match(page, /makeMainPhoto\(item.id\)/);

assert.match(canvas, /paintStormBottom/);
assert.match(canvas, /getQuickDesignStormTopScale/);
assert.match(canvas, /cleanQuickDesignDTFStormLayer\(bg, layer\.width, layer\.height\)/,
  'DTF alpha cleanup must run on separate background-only layer before subjects');
assert.match(canvas, /drawQuickDesignCompressedStorm\(bg, background, sw, sh, coverScale\)/,
  'Render full original storm source using upper-only compressed stripe mapping');
assert.match(canvas, /sourceW = PREVIEW_W \/ coverScale/,
  'Upper-side compression must retain all originally visible background pixels');
assert.doesNotMatch(canvas, /const topStart = 0\.39 \+ shoulder/,
  'Do not reinstate the destructive prior upper-shoulder mask');
assert.match(canvas, /rgba\(255,255,255,1\).*?/,
  'Preserve the original graduated storm transparency');
assert.ok(canvas.indexOf('cleanQuickDesignDTFStormLayer(bg, layer.width, layer.height)') <
  canvas.indexOf('function paintPhaseCPortraits'),
  'DTF cleanup must never alter original customer photos or lettering');
assert.match(canvas, /stripHeight = 128/,
  'A3 output must avoid a single full-resolution 70MB pixel copy during cleanup');
assert.match(canvas, /destination-in/);
assert.match(canvas, /canvas\.getContext\('2d', \{ alpha: true \}\)/);
assert.doesNotMatch(canvas, /Promise\.all\(\['A', 'B'\]/, 'Only one artwork composition allowed');
const client = readFileSync('src/lib/quickDesignRemoveBgClient.js', 'utf8');
assert.match(client, /supabase\.functions\.invoke\('gdp-quick-design-remove-bg'/);
assert.doesNotMatch(client, /X-API-Key|GDP_REMOVEBG_API_KEY|https:\/\/api\.remove\.bg/);
const edge = readFileSync('supabase/functions/gdp-quick-design-remove-bg/index.ts', 'utf8');
assert.match(edge, /form\.set\('size', 'preview'\)/);
assert.match(edge, /MAX_MONTHLY_PREVIEW_CALLS = 50/);
assert.doesNotMatch(edge, /Deno\.env\.get\('GDP_REMOVEBG_ENABLED'\)/, 'Activation is controlled by deploy, not an unconfigured second switch');
assert.ok(edge.includes("const FREE_CALLS_SAFETY_BUFFER = 5"), 'Must keep a safety margin for shared free API allowance');
assert.ok(edge.includes("const REMOVE_BG_ACCOUNT = 'https://api.remove.bg/v1.0/account'"), 'Read-only shared free balance check is required');
assert.ok(edge.indexOf('const balanceResponse = await fetch(REMOVE_BG_ACCOUNT') < edge.indexOf('const upstream = await fetch(REMOVE_BG_API'), 'Free-balance check MUST happen before processing');
assert.ok(edge.includes('freeCalls <= FREE_CALLS_SAFETY_BUFFER'), 'Fail closed when free calls too low');
assert.ok(edge.includes("Deno.env.get('REMOVE_BG_API_KEY')"), 'Quick Design must reuse the existing Custom Studio remove.bg secret');
assert.ok(!edge.includes("Deno.env.get('GDP_REMOVEBG_API_KEY')"), 'Do not require a second remove.bg secret');
const customRemoveBg = readFileSync('supabase/functions/remove-photo-background/index.ts', 'utf8');
assert.ok(customRemoveBg.includes('Deno.env.get("REMOVE_BG_API_KEY")'), 'Custom Studio uses the same server-side secret');
assert.ok(customRemoveBg.includes('providerForm.append("size", "auto")'), 'The existing Custom Studio output mode still needs a shared billing-cap review');
assert.ok(edge.includes("const branch = /^https:"), 'Cloudflare preview origin allowlist must stay scoped');
assert.ok(edge.includes("const salt = Deno.env.get('GDP_REMOVEBG_HASH_SALT') || getServerKey()"), 'Reuse existing server secret instead of requiring another key');
assert.match(edge, /reserve_quick_design_removebg_preview/);
assert.match(edge, /ALLOWED_MIMES/);
assert.match(edge, /function validSignature/);
assert.doesNotMatch(edge, /form\.set\('size', '(?:full|auto|50MP)'\)/);
const quota = readFileSync('supabase/migrations/20261122000000_quick_design_removebg_free_preview_quota.sql', 'utf8');
assert.match(quota, /on conflict\(month_utc\) do update/i);
assert.match(quota, /where private\.quick_design_removebg_monthly_quota\.attempts < v_monthly_limit/);
assert.match(quota, /revoke all on function public\.reserve_quick_design_removebg_preview/);
assert.match(quota, /grant execute on function public\.reserve_quick_design_removebg_preview[\s\S]*to service_role/);


assert.match(page, /Request submission disabled in preview/);
assert.doesNotMatch(page, /subline: subline \|\| 'CUSTOM BOOTLEG'/);
const headers = readFileSync('public/_headers', 'utf8');
assert.match(headers, /Content-Security-Policy:/);
assert.doesNotMatch(headers, /https:\/\/cdn\.jsdelivr\.net|huggingface\.co|wasm-unsafe-eval/, 'No device-model CDN or WASM CSP exceptions should remain');
assert.doesNotMatch(headers, /\/quick-design\n  Content-Security-Policy:/, 'Quick Design must inherit the standard strict CSP');
console.log('PASS – Phase C black/white garment-first color-second side-third mockups, single-side request, guarded remove.bg');

