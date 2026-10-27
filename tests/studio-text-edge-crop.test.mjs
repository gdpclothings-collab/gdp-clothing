import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bootlegSliderToAnchor,
  constrainBootlegTextStyleToCanvas,
  resolveBootlegAnchorRanges,
} from '../src/lib/customStudioV2BootlegTextLayout.js';
import { applyPremiumTextPreset, PREMIUM_TEXT_STYLES } from '../src/lib/customStudioV2PremiumTextStyles.js';
import { buildBootlegTextStatePatch, resolveBootlegTextLayers } from '../src/lib/customStudioV2BootlegTextLayers.js';

const text = { headline: 'STORM' };
const zone = { x: 12, y: 78, width: 76, height: 16 };
const dimensions = { width: 1000, height: 1200 };
const render = (style, size = dimensions) => constrainBootlegTextStyleToCanvas({ text, zone, style, ...size });

test('legacy saved text retains the preexisting automatic safe-fit until moved', () => {
  const savedStyle = { fontScale: 1000, canvasX: 50, canvasY: 50, rotation: 0 };
  const result = render(savedStyle);
  assert.equal(result.style.textEdgeCrop, undefined);
  assert.equal(result.layout.overflow.any, false);
  assert.equal(result.layout.horizontalFit < 1, true);
  assert.equal(savedStyle.fontScale, 1000, 'saved design is not mutated');
});

test('repositioned text retains requested scale and freely crops at every edge', () => {
  const style = { fontScale: 1000, canvasX: -15, canvasY: 118, rotation: 25, textEdgeCrop: true };
  const result = render(style);
  assert.equal(result.style.fontScale, 1000);
  assert.equal(result.style.canvasX, -15);
  assert.equal(result.style.canvasY, 118);
  assert.equal(result.layout.horizontalFit, 1);
  assert.equal(result.layout.textEdgeCrop, true);
  assert.equal(result.layout.overflow.any, true);
  assert.equal(result.adjusted, false);
  assert.equal(style.textEdgeCrop, true);
});

test('crop coordinates and huge saved font requests remain bounded', () => {
  const result = render({ textEdgeCrop: true, fontScale: 1_000_000, canvasX: -900, canvasY: 900 });
  assert.equal(result.style.fontScale, 1000);
  assert.equal(result.style.canvasX, -100);
  assert.equal(result.style.canvasY, 200);
});

test('text alignment controls reach the glyph boundary on all four sides', () => {
  const start = render({ fontScale: 130, canvasX: 50, canvasY: 50, textEdgeCrop: true });
  const ranges = resolveBootlegAnchorRanges(start.layout, true);
  for (const [axis, value, side, edge] of [
    ['x', 0, 'glyphBounds', 'minX'], ['x', 100, 'glyphBounds', 'maxX'],
    ['y', 0, 'glyphBounds', 'minY'], ['y', 100, 'glyphBounds', 'maxY'],
  ]) {
    const anchor = bootlegSliderToAnchor(value, ranges[axis]);
    const moved = render({
      ...start.style,
      [axis === 'x' ? 'canvasX' : 'canvasY']: anchor / dimensions[axis === 'x' ? 'width' : 'height'] * 100,
    });
    const target = value === 0 ? 0 : dimensions[axis === 'x' ? 'width' : 'height'];
    assert.ok(Math.abs(moved.layout[side][edge] - target) < 0.001, `${axis} ${value}% edge aligned`);
  }
});

test('premium presets and straight, arc and wave modes keep 300-DPI geometry ratios', () => {
  assert.equal(PREMIUM_TEXT_STYLES.length, 10);
  for (const preset of PREMIUM_TEXT_STYLES) {
    for (const curve of ['straight', 'arc-up', 'arc-down', 'wave']) {
      const style = {
        ...applyPremiumTextPreset({ fontScale: 230, canvasX: -8, canvasY: 112, textEdgeCrop: true }, preset.id),
        curve, curveAmount: 65, rotation: 17,
      };
      const low = render(style);
      const high = render(style, { width: 3600, height: 4320 });
      assert.equal(low.layout.horizontalFit, high.layout.horizontalFit, preset.id);
      assert.equal(low.layout.textEdgeCrop, high.layout.textEdgeCrop, preset.id);
      for (const key of ['minX', 'maxX', 'minY', 'maxY']) {
        assert.ok(Math.abs(low.layout.glyphBounds[key] * 3.6 - high.layout.glyphBounds[key]) < 0.001,
          `${preset.id}/${curve}/${key}: 300-DPI proportion`);
      }
      if (curve !== 'straight') {
        assert.equal(low.layout.headline.glyphs.length, high.layout.headline.glyphs.length);
        for (let index = 0; index < low.layout.headline.glyphs.length; index += 1) {
          assert.ok(Math.abs(low.layout.headline.glyphs[index].rotation - high.layout.headline.glyphs[index].rotation) < 0.001,
            `${preset.id}/${curve}: glyph rotation parity`);
        }
      }
    }
  }
});

test('text edge-crop flag round-trips through saved and restored layer styles', () => {
  const layer = { id: 'text-1', text, style: { canvasX: 105, canvasY: -3, textEdgeCrop: true } };
  const patch = buildBootlegTextStatePatch({ textStyle: {} }, [layer], 'text-1', {});
  const restored = resolveBootlegTextLayers(patch, {});
  assert.equal(restored[0].style.textEdgeCrop, true);
  assert.equal(restored[0].style.canvasX, 105);
  assert.equal(restored[0].style.canvasY, -3);
  assert.equal(patch.textStyle.textEdgeCrop, true);
});

test('browser font ink measurements remove heuristic spacing without moving saved anchors', () => {
  const style = { textEdgeCrop: true, fontScale: 130, canvasX: 42, canvasY: 35, rotation: 0 };
  const fallback = render(style).layout;
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({ getContext: () => ({
      measureText: () => ({
        actualBoundingBoxLeft: 40, actualBoundingBoxRight: 45,
        actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 5,
      }),
    }) }),
  };
  try {
    const measured = render(style).layout;
    assert.equal(measured.centerX, fallback.centerX);
    assert.equal(measured.centerY, fallback.centerY);
    assert.equal(measured.glyphBounds.maxX - measured.glyphBounds.minX, 85);
    assert.notEqual(measured.glyphBounds.maxX - measured.glyphBounds.minX,
      fallback.glyphBounds.maxX - fallback.glyphBounds.minX);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('mobile/desktop gestures, print clipping and the production painter use the same crop flag', () => {
  const editor = readFileSync(new URL('../src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', import.meta.url), 'utf8');
  const production = readFileSync(new URL('../src/lib/customStudioV2ProtectedProduction.js', import.meta.url), 'utf8');
  assert.match(editor, /bootlegGestureLimits\(layout, true\)/);
  assert.match(editor, /textEdgeCrop: true,/);
  assert.match(editor, /patchTextStyle\(\{ textEdgeCrop: true, canvasX, canvasY \}\)/);
  assert.match(editor, /data-gdp-print-guide="true"[\s\S]*?overflow-hidden/);
  assert.match(production, /constrainBootlegTextStyleToCanvas\(\{ text, zone, style, width: widthPx, height: heightPx \}\)/);
  assert.match(production, /paintPremiumTextLayout\(context, layout, safeStyle\)/);
});
