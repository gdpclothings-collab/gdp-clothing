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
assert.match(canvas, /const PREVIEW_H = 1000/);
assert.match(canvas, /targetWidthPx: 3600, targetHeightPx: 4800/);
assert.match(canvas, /quickDesignFont/);
assert.match(canvas, /curve === 'up' \|\| curve === 'down'/);
assert.match(page, /Automatic background removal \(experimental\)/);
assert.match(page, /Request submission disabled in preview/);
assert.doesNotMatch(page, /subline: subline \|\| 'CUSTOM BOOTLEG'/);
const headers = readFileSync('public/_headers', 'utf8');
assert.match(headers, /\/quick-design\n  Content-Security-Policy:/);
const globalRule = headers.split('/quick-design')[0];
assert.doesNotMatch(globalRule, /https:\/\/cdn\.jsdelivr\.net|huggingface\.co/, 'Site-wide CSP must remain strict');
console.log('PASS – Quick Design staging, print aspect, font options, automatic cutout setup and no live data mutation');

