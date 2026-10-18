import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_PHOTO_BORDER,
  normalizePhotoBorder,
  createBottomFadedPhotoImage,
} from '../src/lib/customStudioV2PhotoBorders.js';

const borders = readFileSync('src/lib/customStudioV2PhotoBorders.js', 'utf8');
const output = readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');
const editor = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');

test('existing customers keep unchanged photo pixels; optional bottom fade is bounded', () => {
  assert.equal(DEFAULT_PHOTO_BORDER.style, 'none');
  assert.equal(DEFAULT_PHOTO_BORDER.bottomFade, 0);
  assert.equal(normalizePhotoBorder({}).bottomFade, 0);
  assert.equal(normalizePhotoBorder({ bottomFade: 800 }).bottomFade, 80);
  assert.equal(normalizePhotoBorder({ bottomFade: -100 }).bottomFade, 0);
  const image = { marker: 'original' };
  assert.equal(createBottomFadedPhotoImage(image, 800, 600, {}), null);
  assert.equal(createBottomFadedPhotoImage(image, 800, 600, { style: 'bootlegGlow', bottomFade: 0 }), null);
  assert.ok(DEFAULT_PHOTO_BORDER.innerThickness >= 15 && DEFAULT_PHOTO_BORDER.innerThickness <= 28);
  assert.ok(DEFAULT_PHOTO_BORDER.glowSize >= 45 && DEFAULT_PHOTO_BORDER.glowSize <= 65);
  assert.ok(DEFAULT_PHOTO_BORDER.glowOpacity >= 60 && DEFAULT_PHOTO_BORDER.glowOpacity <= 80);
});

test('bottom fade masks source alpha before both border and actual photograph', () => {
  const log = [];
  const prev = globalThis.document;
  const gradient = { addColorStop: (...p) => log.push(['stop', ...p]) };
  const ctx = {
    globalCompositeOperation: 'source-over',
    drawImage: (...p) => log.push(['drawImage', ...p]),
    createLinearGradient: (...p) => { log.push(['gradient', ...p]); return gradient; },
    fillRect: (...p) => log.push(['fillRect', ...p]),
  };
  globalThis.document = { createElement: (name) => {
    assert.equal(name, 'canvas');
    return { width: 0, height: 0, getContext: () => ctx };
  } };
  try {
    const source = { marker: 'cutout' };
    const faded = createBottomFadedPhotoImage(source, 500, 1000, { bottomFade: 35 });
    assert.equal(faded.width, 500);
    assert.equal(faded.height, 1000);
    assert.deepEqual(log[0], ['drawImage', source, 0, 0, 500, 1000]);
    assert.deepEqual(log.filter((op) => op[0] === 'stop').map((op) => op[1]), [0, .65, 1]);
    assert.equal(log.at(-1)[0], 'fillRect');
    assert.equal(ctx.globalCompositeOperation, 'source-over');
  } finally {
    globalThis.document = prev;
  }
  assert.match(output, /const photoSource = createBottomFadedPhotoImage\(loaded\.image, loaded\.width, loaded\.height, layer\.border\) \|\| loaded/);
  assert.match(output, /createPhotoBorderImage\(photoSource\.image, photoSource\.width, photoSource\.height, layer\.border\)/);
  assert.match(output, /drawFreePhoto\(context, photoSource/);
  assert.match(output, /drawContain\(context, photoSource/);
});

test('stronger Bootleg Glow uses blur plus a saturated color rim, then a white cutout stroke', () => {
  const soft = borders.indexOf("compositeCtx.drawImage(soft, 0, 0)");
  const hot = borders.indexOf("compositeCtx.drawImage(spread, 0, 0)");
  const white = borders.indexOf("compositeCtx.drawImage(rim, 0, 0)");
  assert.ok(soft > 0 && hot > soft && white > hot);
  assert.match(borders, /spreadCtx\.globalCompositeOperation = 'destination-out'/);
  assert.match(borders, /softCtx\.filter = blurRadius > 0/);
  assert.match(borders, /spreadCtx\.fillStyle = border\.glowColor/);
  assert.match(borders, /rimCtx\.fillStyle = border\.innerColor/);
  assert.match(editor, /data-gdp-bootleg-glow-controls="true"/);
});

test('mobile preview and 300-DPI export share a non-destructive bottom fade', () => {
  assert.match(editor, /data-gdp-bootleg-photo-bottom-fade="selected-photo-only"/);
  assert.match(editor, /<RangeControl label="Bottom edge fade" value=\{activePhotoBorder\.bottomFade\}/);
  assert.match(editor, /const fadeMask = bottomFade > 0/);
  assert.match(editor, /maskImage: fadeMask, WebkitMaskImage: fadeMask/);
  assert.match(editor, /scope === 'bootleg' \? normalizePhotoBorder\(layer\.border\)\.bottomFade : 0/);
  assert.match(output, /paint\(output\.context, preparedBorder, 'both'\)/);
  assert.match(output, /borderCanvas: borderOutput\?\.canvas/);
  assert.match(output, /globalCompositeOperation = 'source-atop'/);
});
