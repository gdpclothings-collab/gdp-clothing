import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fitSeasonalArtwork, SEASONAL_MIN_PRINT_DPI } from '../src/lib/seasonalArtwork.js';

const size = { width: 12, height: 16 };
const art = {
  aspect_ratio: 10.7 / 12,
  max_width_in: 10.7,
  max_height_in: 12,
};

test('seasonal artwork can fill 12-inch print width from 10.7-inch 300-PPI master', () => {
  const result = fitSeasonalArtwork(art, size, 120);
  assert.equal(result.width, 12);
  assert.equal(result.maxWidth, 12);
  assert.ok(result.height <= 16);
  assert.ok(result.effectiveDpi >= 200);
  assert.ok(result.effectiveDpi < 300);
});

test('never exceed print area and never output lower than 200-PPI source quality', () => {
  const tests = [
    { aspect_ratio: 1, max_width_in: 2, max_height_in: 2 },
    { aspect_ratio: 2, max_width_in: 2, max_height_in: 1 },
    { aspect_ratio: 0.5, max_width_in: 1, max_height_in: 2 },
  ];
  for (const master of tests) {
    const result = fitSeasonalArtwork(master, size, 999, 999, 999);
    assert.ok(result.width <= size.width + 0.001);
    assert.ok(result.height <= size.height + 0.001);
    assert.ok(result.width <= master.max_width_in * (300 / SEASONAL_MIN_PRINT_DPI) + 0.001);
    assert.ok(result.height <= master.max_height_in * (300 / SEASONAL_MIN_PRINT_DPI) + 0.001);
    assert.ok(result.x + result.width <= size.width + 0.001);
    assert.ok(result.y + result.height <= size.height + 0.001);
    assert.ok(result.effectiveDpi >= 200);
  }
});

test('placement and aspect are stable when requested size is smaller than max', () => {
  const result = fitSeasonalArtwork(art, size, 5, 3, 4);
  assert.equal(result.width, 5);
  assert.ok(Math.abs(result.height - 5 / art.aspect_ratio) < 0.0001);
  assert.equal(result.x, 3);
  assert.equal(result.y, 4);
  assert.ok(result.effectiveDpi >= 640 && result.effectiveDpi <= 642);
});

test('invalid or unapproved source dimensions cannot be printed', () => {
  assert.equal(fitSeasonalArtwork({ aspect_ratio: 1, max_width_in: 0, max_height_in: 8 }, size, 12), null);
  assert.equal(fitSeasonalArtwork(null, size, 12), null);
  assert.equal(fitSeasonalArtwork(art, { width: 0, height: 16 }, 12), null);
});

test('gallery photographs stay unchanged and seasonal rotation remains in the library only', () => {
  const gallery = fs.readFileSync('src/components/storefront/custom-studio-v2/CustomStudioV2GeneratedGallery.jsx', 'utf8');
  const fallback = fs.readFileSync('src/components/storefront/custom-studio-v2/CustomStudioV2DesignGallery.jsx', 'utf8');
  const editor = fs.readFileSync('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx', 'utf8');
  assert.ok(gallery.includes("'/images/custom-studio/gallery/seasonal-designs.webp'"));
  assert.ok(!gallery.includes('data-gdp-seasonal-featured-card'));
  assert.ok(!gallery.includes('seasonalFeature'));
  assert.ok(!fallback.includes('data-gdp-seasonal-featured-card'));
  assert.ok(editor.includes('data-seasonal-max-print-size="true"'));
  assert.ok(editor.includes('resolveSeasonalFeature'));
  assert.ok(editor.includes('onLayersChange(nextLayers, nextActive)'));
});

test('backend migration retains both source and print boundary validations', () => {
  const sql = fs.readFileSync('supabase/migrations/20261017152000_seasonal_print_resize_200ppi_floor.sql', 'utf8');
  assert.equal(sql.match(/w > a.max_width_in \* 1\.5 or h > a.max_height_in \* 1\.5/g)?.length, 2);
  assert.ok(sql.includes("x + w > (area->>'width')::numeric + 0.001"));
  assert.ok(sql.includes('SECURITY DEFINER'));
  assert.ok(sql.includes("SET search_path TO ''"));
});
