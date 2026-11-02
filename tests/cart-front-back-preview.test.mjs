import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartPreviewSides, mergeRefreshedCartPreviews } from '../src/lib/cartPreviewSides.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

for (const designPath of ['seasonal', 'bootleg', 'memorial', 'upload']) {
  test(`${designPath}: independent front and back approved mockups`, () => {
    const item = {
      isCustom: true,
      designPath,
      placement: 'front_back',
      image: 'front-legacy-url',
      customerMockups: {
        front: { path: 'front-mockup.png', url: 'front-approved-url' },
        back: { path: 'back-mockup.png', url: 'back-approved-url' },
      },
      productionFiles: {
        front: { path: 'front-300dpi.png', dpi: 300 },
        back: { path: 'back-300dpi.png', dpi: 300 },
      },
    };
    assert.deepEqual(cartPreviewSides(item), [
      { side: 'front', url: 'front-approved-url' },
      { side: 'back', url: 'back-approved-url' },
    ]);
    assert.notEqual(item.customerMockups.front.url, item.customerMockups.back.url);
    assert.equal(item.productionFiles.front.dpi, 300);
    assert.equal(item.productionFiles.back.dpi, 300);
  });
}

test('legacy front/back saved cart item remains readable without inventing a back image', () => {
  assert.deepEqual(cartPreviewSides({ isCustom: true, placement: 'front_back', image: 'original-approved-front' }), [
    { side: 'front', url: 'original-approved-front' },
  ]);
});

test('single-sided and back-only cart items retain their intended print side', () => {
  assert.deepEqual(cartPreviewSides({ isCustom: true, placement: 'front', image: 'front-only' }), [
    { side: 'front', url: 'front-only' },
  ]);
  assert.deepEqual(cartPreviewSides({ isCustom: true, placement: 'back', image: 'back-only' }), [
    { side: 'back', url: 'back-only' },
  ]);
});

test('DTF and ready-to-wear items never enter the garment-side gallery', () => {
  assert.deepEqual(cartPreviewSides({ isDtf: true, isCustom: true, image: 'film' }), []);
  assert.deepEqual(cartPreviewSides({ isCustom: false, image: 'product' }), []);
});

test('all new Studio paths upload side-specific mockups separately from production art', () => {
  const studioV2 = read('../src/pages/CustomStudioV2.jsx');
  const legacy = read('../src/pages/CustomStudio.jsx');
  for (const source of [studioV2, legacy]) {
    assert.match(source, /for \(const side of (sides|printedSides)\)/);
    assert.match(source, /customerMockups\[side\]\s*=\s*\{[\s\S]{0,250}?\bpath\s*:/);
    assert.match(source, /customerMockupPaths:/);
    assert.match(source, /customerMockupPath: primaryMockup\.path/);
    assert.match(source, /customerMockups,/);
  }
  assert.match(studioV2, /productionFiles\[side\] = \{/);
  assert.match(legacy, /productionFiles\[side\] = \{/);
  assert.match(studioV2, /dpi: rendered\.dpi/);
  assert.match(legacy, /dpi: 300/);
});

test('cart reload re-signs side-specific customer paths using existing authorized signing routes', () => {
  const cart = read('../src/lib/CartContext.jsx');
  assert.match(cart, /Object\.entries\(storedItem\.customerMockups \|\| \{\}\)/);
  assert.match(cart, /signCustomPreviewPath\(mockup\.path, user\)/);
  assert.match(cart, /createSignedUrl\(path, 3600\)/);
  assert.match(cart, /action: "signGuestCustomUpload", path/);
  assert.match(cart, /\.map\(persistableCartItem\)/);
});

test('delayed mockup signing preserves cart edits, additions, and removals', () => {
  const original = {
    key: 'custom-one', isCustom: true, placement: 'front_back', imagePath: 'guest/one/front.png',
    image: 'expired-front', quantity: 1,
    customerMockups: {
      front: { path: 'guest/one/front.png', url: 'expired-front' },
      back: { path: 'guest/one/back.png', url: 'expired-back' },
    },
    productionFiles: { front: { dpi: 300, path: 'print-front' }, back: { dpi: 300, path: 'print-back' } },
  };
  const refreshed = {
    ...original, image: 'signed-front',
    customerMockups: {
      front: { ...original.customerMockups.front, url: 'signed-front' },
      back: { ...original.customerMockups.back, url: 'signed-back' },
    },
  };
  const added = { key: 'custom-two', isCustom: true, image: 'new-design', quantity: 1 };
  const changedQuantity = { ...original, quantity: 3 };
  const merged = mergeRefreshedCartPreviews([changedQuantity, added], [original], [refreshed]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].quantity, 3);
  assert.equal(merged[0].image, 'signed-front');
  assert.equal(merged[0].customerMockups.back.url, 'signed-back');
  assert.deepEqual(merged[0].productionFiles, original.productionFiles);
  assert.equal(merged[1], added);
  assert.deepEqual(mergeRefreshedCartPreviews([], [original], [refreshed]), []);

  const editedArtwork = {
    ...original,
    customerMockups: { ...original.customerMockups, back: { path: 'guest/two/back.png', url: 'new-back' } },
  };
  assert.equal(mergeRefreshedCartPreviews([editedArtwork], [original], [refreshed])[0], editedArtwork);
  const movedToSaved = { ...original, placement: 'back' };
  assert.equal(mergeRefreshedCartPreviews([movedToSaved], [original], [refreshed])[0], movedToSaved);
});

test('saved cart URL refresh never replaces whole arrays with an older snapshot', () => {
  const cart = read('../src/lib/CartContext.jsx');
  assert.doesNotMatch(cart, /setItems\(refreshed\)/);
  assert.doesNotMatch(cart, /setSaved\(refreshed\)/);
  assert.match(cart, /setItems\(\(current\) => mergeRefreshedCartPreviews\(current, storedItems, refreshed\)\)/);
  assert.match(cart, /setSaved\(\(current\) => mergeRefreshedCartPreviews\(current, storedSaved, refreshed\)\)/);
});

test('the cart uses a keyboard-accessible, mobile-friendly front/back selector', () => {
  const preview = read('../src/components/storefront/CartGarmentPreview.jsx');
  const activeCart = read('../src/pages/CartV2.jsx');
  assert.match(preview, /aria-pressed=\{active\?\.side === side\}/);
  assert.match(preview, /onClick=\{\(\) => chooseSide\(side\)\}/);
  assert.match(preview, /grid grid-cols-2 gap-2/);
  assert.match(preview, /data-gdp-cart-preview-side/);
  assert.match(activeCart, /<CartGarmentPreview item=\{item\} \/>/);
});
