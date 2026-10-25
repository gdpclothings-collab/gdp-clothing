import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rasterizeReviewPreviewCanvases } from '../src/lib/customStudioV2ReviewCanvasParity.js';

const guard = readFileSync(new URL('../src/components/storefront/custom-studio-v2/CustomStudioV2PresentationGuard.jsx', import.meta.url), 'utf8');

test('Final Review preserves painted premium text and other canvas artwork in order', () => {
  const originals = [
    { width: 800, height: 280, label: 'Editable Photo Bootleg STORM text', png: 'data:image/png;base64,STORM' },
    { width: 1000, height: 1200, label: 'Photo border effect', png: 'data:image/png;base64,BORDER' },
  ];
  const sources = originals.map((item) => ({
    width: item.width,
    height: item.height,
    getAttribute: (key) => key === 'aria-label' ? item.label : null,
    toDataURL: (format) => {
      assert.equal(format, 'image/png');
      return item.png;
    },
  }));
  const replacements = [];
  const clones = originals.map((item, index) => ({
    className: index ? 'absolute inset-0' : 'h-full w-full',
    style: { cssText: index ? 'opacity:0.5' : 'width:100%' },
    replaceWith(image) { replacements[index] = image; },
  }));
  const sourceSection = { querySelectorAll: (selector) => selector === 'canvas' ? sources : [] };
  const cloneSection = {
    querySelectorAll: (selector) => selector === 'canvas' ? clones : [],
    ownerDocument: {
      createElement(tag) {
        assert.equal(tag, 'img');
        return { style: {}, setAttribute(name, value) { this[name] = value; } };
      },
    },
  };
  rasterizeReviewPreviewCanvases(sourceSection, cloneSection);
  assert.equal(replacements.length, 2);
  assert.deepEqual(replacements.map((image) => image.src), originals.map((item) => item.png));
  assert.deepEqual(replacements.map((image) => image.alt), originals.map((item) => item.label));
  assert.deepEqual(replacements.map((image) => image.width), originals.map((item) => item.width));
  assert.deepEqual(replacements.map((image) => image.height), originals.map((item) => item.height));
  assert.deepEqual(replacements.map((image) => image.className), clones.map((item) => item.className));
  assert.equal(replacements[0].style.cssText, clones[0].style.cssText);
  assert.equal(replacements[1].style.cssText, clones[1].style.cssText);
  assert.ok(replacements.every((image) => image['data-gdp-final-review-canvas-bitmap'] === 'true'));
  assert.ok(replacements.every((image) => image.draggable === false && image.style.pointerEvents === 'none'));
  assert.equal(sources[0].width, originals[0].width, 'the live Step 3 canvas stays untouched');
});

test('non-serializable canvases are left unchanged and cannot crash review snapshotting', () => {
  let converted = false;
  const source = {
    querySelectorAll: () => [{
      width: 400, height: 80,
      toDataURL: () => { throw new Error('SecurityError: tainted canvas'); },
    }],
  };
  const clone = {
    querySelectorAll: () => [{ replaceWith() { converted = true; } }],
    ownerDocument: { createElement() { throw new Error('Must not create an image'); } },
  };
  const priorWarn = console.warn;
  let warnings = 0;
  try {
    console.warn = () => { warnings += 1; };
    assert.doesNotThrow(() => rasterizeReviewPreviewCanvases(source, clone));
  } finally {
    console.warn = priorWarn;
  }
  assert.equal(converted, false);
  assert.equal(warnings, 1);
});

test('review snapshot uses cloned canvas bitmaps and captures on click before React unmount', () => {
  assert.match(guard, /const clone = section\.cloneNode\(true\);[\s\S]*?rasterizeReviewPreviewCanvases\(section, clone\)/s);
  assert.match(guard, /reviewPreviewSnapshots\.set\(side, clone\.outerHTML\)/);
  assert.match(guard, /const snapshotBeforeFinalReview = \(event\) =>/);
  assert.match(guard, /root\.addEventListener\('click', snapshotBeforeFinalReview, true\)/);
  assert.match(guard, /root\.removeEventListener\('click', snapshotBeforeFinalReview, true\)/);
  assert.match(guard, /snapshotLiveGarmentPreviews\(\);/);
});
