import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizePhotoBorder, hasPhotoBorder, createPhotoBorderImage, drawPreparedPhotoBorder,
  DEFAULT_PHOTO_BORDER, PHOTO_BORDER_STYLES,
} from '../src/lib/customStudioV2PhotoBorders.js';

const editor = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
const producer = readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');
const snapshot = readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
const admin = readFileSync('src/pages/TemplateManager.jsx', 'utf8');

test('None is default; absent or invalid borders do not paint existing photos', () => {
  assert.equal(normalizePhotoBorder().style, 'none');
  assert.equal(normalizePhotoBorder({ style: 'unexpected' }).style, 'none');
  assert.equal(hasPhotoBorder(null), false);
  assert.equal(hasPhotoBorder({ style: 'glow', opacity: 0 }), false);
  assert.equal(hasPhotoBorder({ style: 'rough', thickness: 0 }), false);
  assert.equal(createPhotoBorderImage(null, 200, 200, { style: 'glow' }), null);
  assert.equal(PHOTO_BORDER_STYLES.length, 5);
});

test('Settings sanitize untrusted values and preserve admin-configured defaults', () => {
  const safe = normalizePhotoBorder({ style: 'outline', color: 'url(x)', thickness: 999, opacity: -1, softness: 200, distress: -1 });
  assert.deepEqual([safe.style, safe.color, safe.thickness, safe.opacity, safe.softness, safe.distress], ['outline', '#ffffff', 100, 0, 100, 0]);
  assert.equal(DEFAULT_PHOTO_BORDER.style, 'none');
  assert.match(editor, /settings\?\.photoBorderOptions/);
  assert.match(admin, /data-gdp-admin-photo-borders="true"/);
  assert.match(admin, /saveCustomStudioSettings\(settings\)/);
});

test('Alpha stencil is built from the real source image, not a rectangle', () => {
  const ops = [];
  const ctx = {
    _op: 'source-over',
    set globalCompositeOperation(value) { ops.push(['mode', value]); this._op = value; },
    get globalCompositeOperation() { return this._op; },
    drawImage(...args) { ops.push(['drawImage', ...args]); },
    fillRect(...args) { ops.push(['fillRect', ...args]); },
  };
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) => {
      assert.equal(tag, 'canvas');
      return { width: 0, height: 0, getContext: () => ctx };
    },
  };
  try {
    const photo = { marker: 'transparency-bearing-png' };
    for (const style of ['outline', 'glow', 'rough']) {
      ops.length = 0;
      const result = createPhotoBorderImage(photo, 500, 1000, { style, color: '#ff0000', thickness: 40 });
      assert.ok(result?.canvas);
      assert.ok(result.leftPad > 0 && result.topPad > 0);
      assert.ok(result.widthScale > 1);
      assert.ok(ops.some((entry) => entry[0] === 'drawImage' && entry[1] === photo), style);
      assert.ok(ops.some((entry) => entry[0] === 'mode' && entry[1] === 'source-in'), style);
      assert.ok(ops.some((entry) => entry[0] === 'mode' && entry[1] === 'destination-out'), style);
      assert.equal(ops.at(-1)[1], 'source-over', style);
    }
    ops.length = 0;
    assert.equal(createPhotoBorderImage(photo, 500, 1000, null), null);
    assert.equal(ops.length, 0);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('A prepared border is drawn with photo-local geometry and saved alpha', () => {
  const ops = [];
  const ctx = {
    globalAlpha: 0.75,
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    drawImage: (...args) => ops.push(args),
  };
  drawPreparedPhotoBorder(ctx, { canvas: 'stencil', leftPad: 0.1, topPad: 0.2, widthScale: 1.2, heightScale: 1.4, opacity: 0.5 }, 300, 200);
  assert.deepEqual(ops[1], ['stencil', -180, -140, 360, 280]);
  assert.equal(ops[2], 'restore');
  assert.equal(ctx.globalAlpha, 0.375);
});

test('Compositor draws borders with photos and mirrors them to preview before overlay', () => {
  assert.match(producer, /createPhotoBorderImage\\(photoSource\\.image, photoSource\\.width, photoSource\\.height, layer\\.border\\)/);
  assert.match(producer, /borderOutput\.context\.globalCompositeOperation = 'destination-out'/);
  assert.match(producer, /paint\(borderOutput\.context, preparedBorder, 'borderOnly'\)/);
  assert.match(producer, /paint\(output\.context, preparedBorder, 'both'\)/);
  assert.match(producer, /borderCanvas: borderOutput\?\.canvas/);
  assert.match(editor, /data-gdp-bootleg-cutout-borders="true"/);
  assert.match(editor, /paintPhotoBorders\(rendered\.borderCanvas\)/);
  assert.match(editor, /if \(!\(overlayActive \|\| bordersActive\)/);
  assert.match(producer, /globalCompositeOperation = 'source-atop'/);
});

test('Each selected photo owns independent border settings included in order hash', () => {
  assert.match(editor, /data-gdp-bootleg-photo-borders="selected-photo-only"/);
  assert.match(editor, /layer\.id === activePhoto\.id \? \{ \.\.\.layer, border: normalized \} : layer/);
  assert.match(editor, /activePhotoBorder\.style === preset\.id/);
  assert.match(snapshot, /border: layer\.border \|\| \{ style: 'none' \}/);
});
