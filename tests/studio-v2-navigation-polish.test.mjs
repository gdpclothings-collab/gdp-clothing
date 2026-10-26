import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getStudioBrowseSnapshot, refreshStudioBrowseSnapshot } from '../src/lib/studioV2BrowseCache.js';

test('public browse data is reused across unmounts while network fetches still refresh it', async () => {
  assert.equal(getStudioBrowseSnapshot(), null);

  let releaseCatalog;
  let catalogRequests = 0;
  const loadCatalog = () => {
    catalogRequests += 1;
    return new Promise((resolve) => { releaseCatalog = resolve; });
  };
  const loadSettings = async () => ({ frontBackFee: 10 });

  const first = refreshStudioBrowseSnapshot(loadCatalog, loadSettings);
  const second = refreshStudioBrowseSnapshot(loadCatalog, loadSettings);
  assert.strictEqual(first, second, 'concurrent mounts must share one fetch');
  assert.equal(catalogRequests, 1);
  assert.equal(getStudioBrowseSnapshot(), null, 'only successful data may be cached');

  releaseCatalog([{ id: 'public-shirt', name: 'Unisex Shirt' }]);
  const snapshot = await first;
  assert.strictEqual(getStudioBrowseSnapshot(), snapshot);
  assert.equal(snapshot.catalog.length, 1);

  const refreshed = await refreshStudioBrowseSnapshot(
    async () => [{ id: 'public-hoodie', name: 'Unisex Hoodie' }],
    async () => ({ frontBackFee: 15 }),
  );
  assert.equal(refreshed.catalog[0].id, 'public-hoodie');
  assert.equal(refreshed.settings.frontBackFee, 15);
  assert.equal(snapshot.catalog[0].id, 'public-shirt', 'original response must not be mutated');
});

test('background settings failure preserves the last successful settings', async () => {
  const old = getStudioBrowseSnapshot();
  const next = await refreshStudioBrowseSnapshot(
    async () => [{ id: 'public-shirt', name: 'Updated shirt' }],
    async () => { throw new Error('public settings temporarily unavailable'); },
  );
  assert.deepEqual(next.settings, old.settings);
});

test('navigation polish respects same-route browser history and keeps Studio reducer', () => {
  const scroll = fs.readFileSync('src/components/ScrollToTop.jsx', 'utf8');
  const studio = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
  const smoke = fs.readFileSync('scripts/custom-studio-browser-history-smoke.mjs', 'utf8');

  assert.match(scroll, /previous\.pathname === pathname && previous\.hash === hash/);
  assert.match(scroll, /if \(navigationType === "POP"\) return/);
  assert.match(studio, /getStudioBrowseSnapshot\(\)\?\.catalog/);
  assert.match(studio, /refreshStudioBrowseSnapshot\(/);
  assert.match(studio, /studioHistoryShouldPush\(/);
  assert.match(studio, /data-gdp-studio-initial-loading="true"/);
  assert.match(studio, /const top = panel\.getBoundingClientRect\(\)\.top/);
  assert.doesNotMatch(studio, /const frame = window\.requestAnimationFrame\(\(\) => \{/);
  assert.match(smoke, /Home → browser Back → Studio without loading flash/);
});

test('browser history smoke isolates draft recovery from clean catalog navigation', () => {
  const smoke = fs.readFileSync('scripts/custom-studio-browser-history-smoke.mjs', 'utf8');
  assert.match(smoke, /reload → unfinished draft recovered/);
  assert.match(smoke, /const catalogContext = await browser\.newContext\(/);
  assert.match(smoke, /const catalogPage = await catalogContext\.newPage\(/);
  assert.match(smoke, /await gallery\(catalogPage\)\.waitFor/);
  assert.match(smoke, /await catalogPage\.goBack\(/);
  assert.match(smoke, /await catalogContext\.close\(\)/);
  assert.doesNotMatch(smoke, /sessionStorage\.clear\(\)/,
    'clearing session storage before reload lets the pagehide handler restore the draft');
});

test('protected Final Review smoke selects Photo explicitly and preserves failure evidence', () => {
  const smoke = fs.readFileSync('scripts/custom-studio-protected-final-review-smoke.mjs', 'utf8');
  assert.match(smoke, /const photoTool = activeToolbar\.getByRole\('button', \{ name: \/\^Photo\$\/i \}\)/);
  assert.match(smoke, /await photoTool\.click\(\)/);
  assert.match(smoke, /await photoTool\.getAttribute\('aria-pressed'\)/);
  assert.match(smoke, /initialActiveLayer/);
  assert.match(smoke, /-FAILED\.json/);
  assert.match(smoke, /-FAILED\.png/);
  assert.match(smoke, /Approved photo.*initialPhotoImage/);
  assert.match(smoke, /Approved template.*initialTemplateImage/);
  assert.match(smoke, /Step 4 still contains layer selection\/status panels/);
});
