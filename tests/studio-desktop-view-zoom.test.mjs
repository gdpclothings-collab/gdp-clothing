import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  clampStudioViewPan,
  clampStudioViewZoom,
  STUDIO_VIEW_MAX_ZOOM,
  STUDIO_VIEW_MIN_ZOOM,
} from '../src/lib/studioGarmentViewZoom.js';

test('garment view zoom is bounded and Fit corresponds to 100%', () => {
  assert.equal(clampStudioViewZoom(10), STUDIO_VIEW_MIN_ZOOM);
  assert.equal(clampStudioViewZoom(900), STUDIO_VIEW_MAX_ZOOM);
  assert.equal(clampStudioViewZoom(125), 125);
  assert.equal(clampStudioViewZoom(Number.NaN), 100);
});

test('zoom pan stays centered at 100% and inside the canvas at 200%', () => {
  assert.deepEqual(clampStudioViewPan(100, 400, 500, 30, -20), { x: 0, y: 0 });
  assert.deepEqual(clampStudioViewPan(50, 400, 500, 30, -20), { x: 0, y: 0 });
  assert.deepEqual(clampStudioViewPan(200, 400, 500, 300, -300), { x: 200, y: -250 });
  assert.deepEqual(clampStudioViewPan(150, 400, 500, 22, -18), { x: 22, y: -18 });
});

test('all V2 editing paths use view-only garment zoom without changing artwork state', () => {
  for (const editor of [
    'src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx',
    'src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx',
    'src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx',
  ]) {
    const code = readFileSync(new URL('../' + editor, import.meta.url), 'utf8');
    assert.match(code, /import StudioDesktopViewZoom from/);
    assert.match(code, /<StudioDesktopViewZoom side=\{side\}/);
  }
  const component = readFileSync(new URL('../src/components/storefront/custom-studio-v2/StudioDesktopViewZoom.jsx', import.meta.url), 'utf8');
  assert.match(component, /data-gdp-view-only="true"/);
  assert.match(component, /aria-label="Fit entire garment in preview"/);
  assert.match(component, /onPointerDown=\{beginPan\}/);
  assert.doesNotMatch(component, /onPatch|onLayersChange|render.*Png|localStorage|sessionStorage/);
});
