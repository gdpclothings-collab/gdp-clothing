import test from 'node:test';
import assert from 'node:assert/strict';
import { createCartLocalMockup, safeCartLocalMockup, writeCartPreviewsWithFallback } from '../src/lib/cartLocalMockupPreview.js';

const jpeg = 'data:image/jpeg;base64,' + 'AAAA';
const webp = 'data:image/webp;base64,' + 'AAAA';
test('only bounded, inert raster data URLs are accepted', () => {
  assert.equal(safeCartLocalMockup(jpeg), jpeg);
  assert.equal(safeCartLocalMockup(webp), webp);
  assert.equal(safeCartLocalMockup('data:image/svg+xml;base64,AAAA'), '');
  assert.equal(safeCartLocalMockup('javascript:alert(1)'), '');
  assert.equal(safeCartLocalMockup('data:image/jpeg;base64,' + 'A'.repeat(140_000)), '');
  assert.equal(safeCartLocalMockup(null), '');
});
test('derived thumbnail uses 320x400 JPEG, no uploaded print master persistence', async () => {
  const originalDocument = globalThis.document;
  const originalImage = globalThis.Image;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const calls = [];
  try {
    URL.createObjectURL = (blob) => { calls.push(['create', blob]); return 'blob:mockup'; };
    URL.revokeObjectURL = (url) => calls.push(['revoke', url]);
    globalThis.Image = class { constructor() { this.naturalWidth = 1200; this.naturalHeight = 1500; } set src(_value) { this.onload(); } };
    globalThis.document = { createElement(name) {
      assert.equal(name, 'canvas');
      return {
        width: 0, height: 0,
        getContext: () => ({ fillRect: (...args) => calls.push(['fill', ...args]), drawImage: (...args) => calls.push(['draw', ...args]) }),
        toDataURL: (mime, quality) => { calls.push(['encode', mime, quality]); return jpeg; },
      };
    } };
    const blob = { type: 'image/png', name: 'approved-customer-mockup' };
    assert.equal(await createCartLocalMockup(blob), jpeg);
    assert(calls.some(c => c[0] === 'draw' && c[4] === 320 && c[5] === 400));
    assert(calls.some(c => c[0] === 'encode' && c[1] === 'image/jpeg' && c[2] === 0.68));
    assert(calls.some(c => c[0] === 'revoke' && c[1] === 'blob:mockup'));
  } finally {
    globalThis.document = originalDocument;
    globalThis.Image = originalImage;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
test('browser API unavailable never prevents cart checkout', async () => {
  const original = globalThis.document;
  try { delete globalThis.document; assert.equal(await createCartLocalMockup({}), ''); }
  finally { globalThis.document = original; }
});

test('both approved garment sides survive reload via bounded local preview URLs', async () => {
  const { cartPreviewSides } = await import('../src/lib/cartPreviewSides.js');
  const item = {
    isCustom: true, placement: 'front_back', image: 'https://old.example/expired.png',
    customerMockups: {
      front: { url: 'https://old.example/front.png', localPreview: jpeg },
      back: { url: 'https://old.example/back.png', localPreview: webp },
    },
    productionFiles: { front: { path: 'production/front-300dpi.png', dpi: 300 }, back: { path: 'production/back-300dpi.png', dpi: 300 } },
  };
  const saved = JSON.parse(JSON.stringify(item));
  assert.deepEqual(cartPreviewSides(saved), [{ side: 'front', url: jpeg }, { side: 'back', url: webp }]);
  assert.deepEqual(saved.productionFiles, item.productionFiles);
  const legacy = { ...item, customerMockups: undefined };
  assert.deepEqual(cartPreviewSides(legacy), [{ side: 'front', url: legacy.image }]);
  assert.deepEqual(cartPreviewSides({ ...item, isDtf: true }), []);
  assert.deepEqual(cartPreviewSides({ ...item, customerMockups: { front: { url: 'fallback', localPreview: 'data:image/svg+xml;base64,AAAA' } } }), [{ side: 'front', url: 'fallback' }]);
});

test('signing hydration merges only urls; local preview bytes remain unchanged', async () => {
  const { mergeRefreshedCartPreviews } = await import('../src/lib/cartPreviewSides.js');
  const original = { key: 'custom_example', isCustom: true, placement: 'front_back', customerMockups: {
    front: { path: 'guest/front.png', url: 'old', localPreview: jpeg },
    back: { path: 'guest/back.png', url: 'old-back', localPreview: webp },
  } };
  const refreshed = { ...original, customerMockups: { front: { ...original.customerMockups.front, url: 'new' }, back: { ...original.customerMockups.back, url: 'new-back' } } };
  const [result] = mergeRefreshedCartPreviews([original], [original], [refreshed]);
  assert.equal(result.customerMockups.front.localPreview, jpeg);
  assert.equal(result.customerMockups.back.localPreview, webp);
  assert.equal(result.customerMockups.back.url, 'new-back');
});


test('cart local thumbnail storage persists under browser capacity', () => {
  const state = new Map();
  const storage = { setItem: (key, value) => state.set(key, value) };
  const item = { isCustom: true, image: 'https://approved.example/front', customerMockups: { front: { path: 'approved/front.png', localPreview: jpeg } } };
  assert.equal(writeCartPreviewsWithFallback('gdp_cart_v2__guest', [item], storage), true);
  assert.equal(JSON.parse(state.get('gdp_cart_v2__guest'))[0].customerMockups.front.localPreview, jpeg);
});

test('quota exceeded drops only optional thumbnails, retaining cart and print file references', () => {
  const state = new Map();
  const maxLength = 670;
  const storage = { setItem(key, value) {
    if (value.length > maxLength) throw Object.assign(new Error('Storage full'), { name: 'QuotaExceededError' });
    state.set(key, value);
  } };
  const jpegLong = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
  const item = { key: 'custom_1', isCustom: true, placement: 'front_back', quantity: 3, price: 30, image: 'https://approved.example/front', customerMockups: {
    front: { path: 'approved/front.png', url: 'https://approved.example/front', localPreview: jpegLong },
    back: { path: 'approved/back.png', url: 'https://approved.example/back', localPreview: jpegLong },
  }, productionFiles: { front: { path: 'locked/front-300dpi.png', dpi: 300 }, back: { path: 'locked/back-300dpi.png', dpi: 300 } } };
  assert.equal(writeCartPreviewsWithFallback('gdp_cart_v2__guest', [item], storage), true);
  const [persisted] = JSON.parse(state.get('gdp_cart_v2__guest'));
  assert.equal(persisted.customerMockups.front.localPreview, undefined);
  assert.equal(persisted.customerMockups.back.localPreview, undefined);
  assert.equal(persisted.customerMockups.back.path, item.customerMockups.back.path);
  assert.deepEqual(persisted.productionFiles, item.productionFiles);
  assert.equal(persisted.quantity, 3);
  assert.equal(persisted.price, 30);
  assert.equal(item.customerMockups.front.localPreview, jpegLong);
});

test('hard storage failure never overwrites the last saved cart', () => {
  const lastCart = '[{"key":"previous-order"}]';
  const state = new Map([['gdp_cart_v2__guest', lastCart]]);
  const storage = { setItem() { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); } };
  assert.equal(writeCartPreviewsWithFallback('gdp_cart_v2__guest', [{ key: 'new', isCustom: true }], storage), false);
  assert.equal(state.get('gdp_cart_v2__guest'), lastCart);
  assert.equal(writeCartPreviewsWithFallback('gdp_cart_v2__guest', [], { setItem() { throw Object.assign(new Error('private browsing'), { name: 'SecurityError' }); } }), false);
  assert.equal(writeCartPreviewsWithFallback('', [], storage), false);
});
