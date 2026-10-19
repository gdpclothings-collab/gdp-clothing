import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialStudioV2State, studioV2MissingArtworkMessage, studioV2SideHasContent } from '../src/lib/customStudioV2State.js';

const source = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx','utf8');
const seasonal = readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx','utf8');
const upload = readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx','utf8');
const mirror = readFileSync('src/components/storefront/custom-studio-v2/StudioMobilePreviewMirror.jsx','utf8');

test('mobile layer inspector has auto-visible live preview only when main garment is offscreen', () => {
  assert.match(source, /const \[mobilePreviewOutOfView, setMobilePreviewOutOfView\] = useState\(false\)/);
  assert.match(source, /IntersectionObserver\(\(\[entry\]\) => \{/);
  assert.match(source, /inspectorInView && !mainInView/);
  assert.match(source, /\(max-width: 639px\)/);
  assert.match(source, /<StudioMobilePreviewMirror side=\{side\} minimized=\{mobilePreviewDismissed\}/);
  assert.match(source, /<ProtectedPreview compact product=\{product\}/);
  assert.match(mirror, /pointer-events-none mx-auto mt-2/);
});
test('pinned preview is closable and restores on return to the main garment', () => {
  assert.match(source,/setMobilePreviewDismissed\(true\)/);
  assert.match(source,/setMobilePreviewDismissed\(false\)/);
  assert.match(source,/if \(mainInView\) setMobilePreviewDismissed\(false\)/);
  assert.match(source,/garmentObserver\.disconnect\(\)/);
  assert.match(source,/inspectorObserver\.disconnect\(\)/);
  assert.match(source,/mobile\.removeEventListener\?\.\('change', update\)/);
});
test('compact mirror removes redundant footer and warning but retains print geometry', () => {
  assert.match(source, /function ProtectedPreview\(\{[\s\S]*?compact = false \}\)/);
  assert.match(source, /!compact && bootlegTextLayouts\.some/);
  assert.match(source, /!compact \? <p className="mt-2 text-center/);
  assert.match(source, /<div ref=\{canvasRef\} data-gdp-print-guide="true"/);
  assert.match(source, /transform: `rotate\(\$\{templateTransform\.rotation\}deg\) scale/);
});
test('desktop layout stays three-column and mobile layer picker fits on one row', () => {
  assert.match(source,/xl:grid-cols-\[minmax\(280px,\.82fr\)_minmax\(420px,1\.4fr\)_minmax\(300px,\.86fr\)\]/);
  assert.match(source,/bootlegLayerButtons\.length === 5 \? 'grid-cols-5' : bootlegLayerButtons\.length === 4 \? 'grid-cols-4'/);
  assert.match(source,/sm:hidden/);
  assert.match(source,/data-gdp-bootleg-confirm-action=\{isBootleg \? 'persistent'/);
});

test('every design path mirrors its live print placement without covering mobile controls', () => {
  assert.match(mirror, /data-gdp-mobile-preview-safe="controls-unobstructed"/);
  assert.match(mirror, /sm:hidden/);
  assert.doesNotMatch(mirror, /\bfixed\b/);
  assert.match(seasonal, /<StudioMobilePreviewMirror side=\{side\}/);
  assert.match(seasonal, /<StudioMobileGarmentMirror garmentPreview=\{garmentPreview\}/);
  assert.match(seasonal, /entry\.layout\.width \/ area\.width/);
  assert.match(upload, /<StudioMobilePreviewMirror side=\{side\}/);
  assert.match(upload, /<StudioMobileGarmentMirror garmentPreview=\{garmentPreview\}/);
  assert.match(upload, /data-gdp-upload-mirror-artwork="true"/);
  assert.match(upload, /transform\.widthScale \/ 10000/);
});

test('mobile seasonal selection opens controls on tap, not mid-drag', () => {
  assert.match(seasonal, /if \(tapped && event\.type === 'pointerup'\) onEdit\?\./);
  assert.match(seasonal, /tapStart\.current\.moved = true/);
  assert.match(seasonal, /ref=\{inspectorRef\}/);
});

test('upload editor gives every resizing and positioning slider a reset', () => {
  for (const key of ['scale', 'widthScale', 'heightScale', 'x', 'y', 'rotation']) {
    assert.match(upload, new RegExp('onReset=\\{\\(\\) => patchTransform\\(\\{ ' + key + ': ' + (['scale', 'widthScale', 'heightScale'].includes(key) ? 100 : 0) + ' \\}\\)\\}'));
  }
});

test('bootleg and memorial approval never accept a hidden customer photo via a legacy alias', () => {
  for (const path of ['bootleg', 'memorial']) {
    const state = createInitialStudioV2State();
    state.designPath = path;
    const front = state[path].sides.front;
    front.templateId = 'sample-template';
    front.photo = { path: 'old/photo.png', url: '/old-photo.png' };
    front.photos = [{ id: 'hidden', visible: false, asset: { path: 'photo.png', url: '/photo.png' } }];
    assert.equal(studioV2SideHasContent(state, 'front'), false);
    assert.match(studioV2MissingArtworkMessage(state), /customer photo/);
    front.photos[0].visible = true;
    assert.equal(studioV2SideHasContent(state, 'front'), true);
    front.photos = [];
    assert.equal(studioV2SideHasContent(state, 'front'), true, 'legacy single-photo drafts remain valid');
  }
});

test('all four paths explain missing artwork without bypassing approval', () => {
  const state = createInitialStudioV2State();
  state.designPath = 'seasonal';
  assert.match(studioV2MissingArtworkMessage(state), /Seasonal artwork/);
  state.designPath = 'upload';
  assert.match(studioV2MissingArtworkMessage(state), /Upload a printable artwork/);
  state.designPath = 'bootleg';
  assert.match(studioV2MissingArtworkMessage(state), /protected template/);
});
