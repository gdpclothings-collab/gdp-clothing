import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { constrainBootlegTextStyleToCanvas } from '../src/lib/customStudioV2BootlegTextLayout.js';

const width = 1000;
const height = 1400;
const zone = { x: 11, y: 79, width: 78, height: 16 };
const withinPrint = (result) => {
  const b = result.layout.bounds;
  assert.ok(b.minX >= -0.01 && b.maxX <= width + 0.01, `horizontal overflow: ${JSON.stringify(b)}`);
  assert.ok(b.minY >= -0.01 && b.maxY <= height + 0.01, `vertical overflow: ${JSON.stringify(b)}`);
  assert.equal(result.layout.overflow.any, false);
};

test('short bootleg headline reaches full 1000% via width auto-fit', () => {
  const result = constrainBootlegTextStyleToCanvas({
    text: { headline: 'HELLO' }, zone,
    style: { fontScale: 1000, canvasX: 50, canvasY: 50, curve: 'straight' }, width, height,
  });
  assert.equal(result.style.fontScale, 1000);
  assert.ok(result.layout.horizontalFit < 1 && result.layout.horizontalFit >= 0.35);
  withinPrint(result);
});

test('curved and rotated text remains inside production boundaries', () => {
  for (const curve of ['straight', 'arc-up', 'arc-down', 'wave']) {
    const result = constrainBootlegTextStyleToCanvas({
      text: { headline: 'COSMIC' }, zone,
      style: { fontScale: 1000, canvasX: 99, canvasY: 99, rotation: 25, curve, curveAmount: 70 },
      width, height,
    });
    withinPrint(result);
    assert.ok(result.style.fontScale <= 1000);
  }
});

test('very long copy respects print safety instead of stretching past it', () => {
  const result = constrainBootlegTextStyleToCanvas({
    text: { headline: 'W'.repeat(70) }, zone,
    style: { fontScale: 1000, canvasX: 50, canvasY: 50 }, width, height,
  });
  withinPrint(result);
  assert.ok(result.style.fontScale < 1000);
});

test('preview outline removed and print renderer uses same width auto-fit', () => {
  const ui = readFileSync(new URL('../src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', import.meta.url), 'utf8');
  const print = readFileSync(new URL('../src/lib/customStudioV2ProtectedProduction.js', import.meta.url), 'utf8');
  assert.ok(!ui.includes('data-gdp-bootleg-text-bounds="true"'));
  assert.ok(ui.includes('data-gdp-text-autofit='));
  assert.ok(ui.includes('maxScale: 1000'));
  assert.ok(print.includes('context.scale(layout.horizontalFit, 1)'));
});
