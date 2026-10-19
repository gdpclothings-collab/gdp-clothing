import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx','utf8');

test('mobile layer inspector has auto-visible live preview only when main garment is offscreen', () => {
  assert.match(source, /const \[mobilePreviewOutOfView, setMobilePreviewOutOfView\] = useState\(false\)/);
  assert.match(source, /IntersectionObserver\(\(\[entry\]\) => \{/);
  assert.match(source, /inspectorInView && !mainInView/);
  assert.match(source, /\(max-width: 639px\)/);
  assert.match(source, /data-gdp-mobile-live-preview=\{mobilePreviewDismissed \? 'minimized' : 'pinned'\}/);
  assert.match(source, /<ProtectedPreview compact product=\{product\}/);
  assert.match(source, /aria-hidden="true" className="pointer-events-none select-none"/);
});
test('pinned preview is closable and restores on return to the main garment', () => {
  assert.match(source,/setMobilePreviewDismissed\(true\)/);
  assert.match(source,/setMobilePreviewDismissed\(false\)/);
  assert.match(source,/if \(mainInView\) setMobilePreviewDismissed\(false\)/);
  assert.match(source,/garmentObserver\.disconnect\(\)/);
  assert.match(source,/inspectorObserver\.disconnect\(\)/);
  assert.match(source,/mobile\.removeEventListener\?\.\('change', update\)/);
});
test('compact mirror removes redundant footer and warning but retains print geometry', () => {
  assert.match(source, /function ProtectedPreview\(\{[\s\S]*?compact = false \}\)/);
  assert.match(source, /!compact && bootlegTextLayouts\.some/);
  assert.match(source, /!compact \? <p className="mt-2 text-center/);
  assert.match(source, /<div ref=\{canvasRef\} data-gdp-print-guide="true"/);
  assert.match(source, /transform: `rotate\(\$\{templateTransform\.rotation\}deg\) scale/);
});
test('desktop layout stays three-column and mobile layer picker fits on one row', () => {
  assert.match(source,/xl:grid-cols-\[minmax\(280px,\.82fr\)_minmax\(420px,1\.4fr\)_minmax\(300px,\.86fr\)\]/);
  assert.match(source,/bootlegLayerButtons\.length === 5 \? 'grid-cols-5' : bootlegLayerButtons\.length === 4 \? 'grid-cols-4'/);
  assert.match(source,/sm:hidden/);
  assert.match(source,/data-gdp-bootleg-confirm-action=\{isBootleg \? 'persistent'/);
});
