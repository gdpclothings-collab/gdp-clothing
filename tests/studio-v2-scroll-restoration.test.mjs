import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { studioV2ScrollTop, studioV2StickyHeaderHeight } from '../src/lib/studioV2ScrollRestoration.js';

test('align active Studio panel below the measured sticky header', () => {
  assert.equal(studioV2ScrollTop({
    scrollY: 750, panelTop: -450, headerHeight: 70,
    viewportHeight: 850, documentHeight: 2700,
  }), 216);
  assert.equal(studioV2ScrollTop({
    scrollY: 900, panelTop: -560, headerHeight: 104,
    viewportHeight: 850, documentHeight: 2700,
  }), 222, 'announcement bar must be included in measured header height');
});

test('clamp to top and to document limits for short steps/mobile', () => {
  assert.equal(studioV2ScrollTop({
    scrollY: 0, panelTop: 30, headerHeight: 70,
    viewportHeight: 900, documentHeight: 1200,
  }), 0);
  assert.equal(studioV2ScrollTop({
    scrollY: 130, panelTop: 390, headerHeight: 70,
    viewportHeight: 900, documentHeight: 1100,
  }), 200, 'short step cannot scroll beyond document end');
  assert.equal(studioV2ScrollTop({
    scrollY: 0, panelTop: 430, headerHeight: 70,
    viewportHeight: 900, documentHeight: 800,
  }), 0, 'a step shorter than the viewport cannot scroll');
});

test('derive real sticky navbar height with safe fallback', () => {
  const doc = { querySelector: (selector) => {
    assert.equal(selector, '.gdp-storefront > header');
    return { getBoundingClientRect: () => ({ height: 106.4 }) };
  } };
  assert.equal(studioV2StickyHeaderHeight(doc), 106.4);
  assert.equal(studioV2StickyHeaderHeight({ querySelector: () => null }), 70);
  assert.equal(studioV2StickyHeaderHeight(null), 70);
});

test('navigation history stays in the Studio and browser restoration is scoped', () => {
  const studio = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
  const css = fs.readFileSync('src/components/storefront/custom-studio-v2/customStudioV2Premium.css', 'utf8');
  const smoke = fs.readFileSync('scripts/custom-studio-browser-history-smoke.mjs', 'utf8');

  assert.match(studio, /window\.history\.scrollRestoration = 'manual'/);
  assert.match(studio, /window\.history\.scrollRestoration = previous/);
  assert.match(studio, /studioV2ScrollTop\(/);
  assert.match(studio, /studioV2StickyHeaderHeight\(document\)/);
  assert.match(studio, /panel\.focus\(\{ preventScroll: true \}\)/);
  assert.match(studio, /\[state\.step, garmentView\]/);
  assert.match(css, /scroll-margin-top: calc\(var\(--gdp-store-header-height, 70px\) \+ 14px\)/);
  assert.match(smoke, /assertStudioPanelAligned/);
});
