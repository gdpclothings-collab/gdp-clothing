import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  QUICK_DESIGN_BACKGROUNDS,
  QUICK_DESIGN_MAX_PHOTOS,
  QUICK_DESIGN_MAX_FILE_BYTES,
  validateQuickDesignFile,
  quickDesignLayoutCount,
} from '../src/lib/quickDesignCanvas.js';

assert.equal(QUICK_DESIGN_MAX_PHOTOS, 5);
assert.equal(QUICK_DESIGN_MAX_FILE_BYTES, 10 * 1024 * 1024);
assert.equal(quickDesignLayoutCount('A'), 5);
assert.equal(quickDesignLayoutCount('B'), 5);
assert.ok(QUICK_DESIGN_BACKGROUNDS.length >= 5, 'Must reuse real GDP bootleg backgrounds');
for (const template of QUICK_DESIGN_BACKGROUNDS) {
  assert.equal(template.category, 'photo_bootleg');
  assert.ok(existsSync(resolve('public' + template.fullAsset)), 'Missing GDP background: ' + template.fullAsset);
}
assert.equal(validateQuickDesignFile({ type: 'image/jpeg', size: 1000 }), '');
assert.equal(validateQuickDesignFile({ type: 'image/png', size: 1000 }), '');
assert.equal(validateQuickDesignFile({ type: 'image/webp', size: 1000 }), '');
assert.ok(validateQuickDesignFile({ type: 'image/heic', size: 1000 }));
assert.ok(validateQuickDesignFile({ type: 'image/jpeg', size: 12 * 1024 * 1024 }));

const app = readFileSync('src/App.jsx', 'utf8');
const nav = readFileSync('src/components/storefront/StoreNav.jsx', 'utf8');
const page = readFileSync('src/pages/QuickDesign.jsx', 'utf8');
const canvas = readFileSync('src/lib/quickDesignCanvas.js', 'utf8');
assert.match(app, /path="\/quick-design" element=\{<QuickDesign \/>}/);
assert.match(nav, /label: "Quick Design", path: "\/quick-design"/);
assert.match(page, /Promise\.all|renderQuickDesignArtwork/);
assert.match(page, /salesLeadApi\.submit/);
assert.match(page, /original photos and previews are NOT uploaded/);
assert.match(page, /rightsConfirmed/);
assert.match(canvas, /drawWatermark\(ctx\)/);
assert.doesNotMatch(canvas, /fetch\(|supabase\.|openai|replicate|remove\.bg/i, 'Preview generation must remain local and free');
assert.doesNotMatch(page, /checkout\/payment|stripe\.confirm|createPaymentIntent/);
console.log('PASS – Quick Design MVP static integration, asset presence, local rendering and request safeguards');
