import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const smoke = readFileSync('scripts/custom-studio-visual-smoke.mjs', 'utf8');
const preview = readFileSync('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx', 'utf8');
const metrics = readFileSync('src/lib/customStudioV2ArtworkMetrics.js', 'utf8');
const globalCss = readFileSync('src/index.css', 'utf8');

test('responsive smoke expects automatic safe containment rather than deliberate bleed', () => {
  assert.match(smoke,/expected automatically safe print bounds/);
  assert.match(smoke,/geometry\.guideOverflow === "hidden"/);
  assert.match(smoke,/geometry\.overflowState === "inside"/);
  assert.match(smoke,/!escapesGuide/);
  assert.doesNotMatch(smoke,/guideOverflow === "visible"/);
  assert.doesNotMatch(smoke,/expectWarning: true/);
  assert.doesNotMatch(smoke,/assert\(escapesGuide/);
});
test('oversized uploads are fitted, not silently replaced or cropped', () => {
  assert.match(smoke,/name: "oversized-auto-fit"/);
  assert.match(smoke,/if \(scenario\.expectAutoFit\)/);
  assert.match(smoke,/oversized embedded source was not reduced to fit/);
  assert.match(smoke,/original embedded physical size was lost/);
  assert.match(smoke,/source resolution was lost/);
  assert.match(smoke,/effective image resolution/);
  assert.match(metrics,/export function constrainUploadArtworkTransform/);
  assert.match(preview,/constrainUploadArtworkTransform\(artworkForPlacement, printGuide, rawTransform\)/);
  assert.match(preview,/overflow-hidden rounded-lg border-2 border-dashed/);
  assert.match(preview,/style=\{\{ \.\.\.printGuide\.style, overflow: 'hidden' \}\}/);
  assert.match(globalCss,/html body \[data-gdp-print-guide="true"\]\[data-gdp-upload-overflow-preview\] \{\s*overflow: hidden !important;/);
});
test('smoke still covers every viewport and output screenshot', () => {
  for(const name of ['desktop','tablet','mobile'])assert.ok(smoke.includes('name: "'+name+'"'),name);
  assert.match(smoke,/custom-studio-visual-\$\{viewport\.name\}-\$\{scenario\.name\}\.png/);
  assert.match(smoke,/assertNoHorizontalOverflow/);
  assert.match(smoke,/pageErrors\.length === 0/);
});

test('live production metrics use real whitespace and digit classes', () => {
  assert.ok(smoke.includes(String.raw`metricsText.match(/Current print size\s*([\d.]+)\s*[×x]\s*([\d.]+)\s*in/i)`));
  assert.ok(smoke.includes(String.raw`metricsText.match(/Effective DPI\s*([\d.]+)\s*DPI/i)`));
});
