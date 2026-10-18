import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOOTLEG_OVERLAY_PRESETS, DEFAULT_BOOTLEG_OVERLAY,
  normalizeBootlegOverlay, paintBootlegOverlay,
} from '../src/lib/customStudioV2BootlegOverlays.js';

function contextSpy() {
  const calls = [];
  const context = {
    calls,
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    beginPath: () => calls.push(['beginPath']),
    rect: (...args) => calls.push(['rect', ...args]),
    clip: () => calls.push(['clip']),
    translate: (...args) => calls.push(['translate', ...args]),
    rotate: (...args) => calls.push(['rotate', ...args]),
    scale: (...args) => calls.push(['scale', ...args]),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    stroke: () => calls.push(['stroke']),
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    arc: (...args) => calls.push(['arc', ...args]),
    fill: () => calls.push(['fill']),
    createRadialGradient: (...args) => {
      calls.push(['radial', ...args]);
      return { addColorStop: (...values) => calls.push(['colorStop', ...values]) };
    },
  };
  return context;
}

test('an empty or unrecognized preset never changes customer artwork', () => {
  assert.equal(normalizeBootlegOverlay().id, 'none');
  assert.equal(normalizeBootlegOverlay({ id: 'not-a-real-effect' }).id, 'none');
  assert.equal(paintBootlegOverlay(contextSpy(), 100, 200, DEFAULT_BOOTLEG_OVERLAY), false);
  assert.equal(paintBootlegOverlay(contextSpy(), 100, 200, { id: 'grain', opacity: 0 }), false);
  assert.equal(paintBootlegOverlay(contextSpy(), 100, 200, { id: 'grain', enabled: false }), false);
});

test('overlay settings are bounded and never rely on arbitrary color strings', () => {
  const result = normalizeBootlegOverlay({ id: 'tint', opacity: 900, scale: -1, rotation: 1200, x: -500, y: 700, color: 'url(bad)' });
  assert.deepEqual([result.opacity, result.scale, result.rotation, result.x, result.y], [100, 25, 180, 0, 100]);
  assert.equal(result.color, DEFAULT_BOOTLEG_OVERLAY.color);
});

test('all presets clip before any transform, then restore canvas state', () => {
  for (const preset of BOOTLEG_OVERLAY_PRESETS.filter((item) => item.id !== 'none')) {
    const context = contextSpy();
    assert.equal(paintBootlegOverlay(context, 600, 750, { id: preset.id, opacity: 55, scale: 250, rotation: 180, x: 100, y: 0 }), true, preset.id);
    const op = (name) => context.calls.findIndex((entry) => entry[0] === name);
    assert.equal(op('save'), 0, preset.id);
    assert.deepEqual(context.calls.find((entry) => entry[0] === 'rect'), ['rect', 0, 0, 600, 750], preset.id);
    assert.ok(op('clip') > op('rect') && op('clip') < op('translate'), preset.id);
    assert.equal(context.calls.at(-1)[0], 'restore', preset.id);
  }
});

test('rendering is deterministic for the same effect and print rectangle', () => {
  const left = contextSpy();
  const right = contextSpy();
  paintBootlegOverlay(left, 900, 1200, { id: 'grunge' });
  paintBootlegOverlay(right, 900, 1200, { id: 'grunge' });
  assert.deepEqual(left.calls, right.calls);
});

test('editor preview and 300 DPI export use the identical print-boundary renderer', () => {
  const preview = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
  const production = readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');
  const checkout = readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
  assert.match(preview, /isBootleg \? <canvas ref=\{overlayCanvasRef\}/);
  assert.match(preview, /data-gdp-bootleg-print-overlay="alpha-masked"/);
  assert.match(preview, /paintBootlegOverlay\(context, canvas.width, canvas.height, latestOverlayRef.current\)/);
  assert.match(production, /paintBootlegOverlay\(output.context, output.widthPx, output.heightPx, editor.overlay\)/);
  assert.match(checkout, /state.designPath === 'bootleg' \? \{ overlay:/);
  assert.match(preview, /activeBootlegLayer === 'overlay' \? overlayPanel : null/);
});

test('production alpha lock applies after all artwork and preserves transparent holes', () => {
  const production = readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');
  const stickerEnd = production.lastIndexOf('await drawStickers(output.context');
  const compositor = production.lastIndexOf("output.context.globalCompositeOperation = 'source-atop'");
  const effect = production.lastIndexOf('paintBootlegOverlay(output.context');
  const png = production.lastIndexOf('blob: await canvasPng(output.canvas)');
  assert.ok(stickerEnd >= 0 && stickerEnd < compositor && compositor < effect && effect < png);
  assert.match(production, /if \(returnDesignCanvas\) \{\s*return \{ canvas: output.canvas,/);
  assert.match(production, /output.context.restore\(\)/);
});

test('live preview uses production-composed design alpha rather than a rectangular mask', () => {
  const preview = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
  assert.match(preview, /renderProtectedStudioV2PngAdvanced\(\{/);
  assert.match(preview, /returnDesignCanvas: true/);
  assert.match(preview, /context.globalCompositeOperation = 'destination-in'/);
  assert.match(preview, /context.drawImage\(maskCanvas, 0, 0\)/);
  assert.match(preview, /overlayMaskRef.current = null/);
  assert.match(preview, /if \(!maskCanvas\) return;/);
  assert.match(preview, /data-gdp-design-alpha-mask="true"/);
  assert.match(preview, /pointer-events-none absolute inset-0 z-\[45\]/);
});
