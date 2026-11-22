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
import { QUICK_DESIGN_GARMENTS, QUICK_DESIGN_SIDES } from '../src/lib/quickDesignGarmentMockup.js';

assert.equal(QUICK_DESIGN_MAX_PHOTOS, 5);
assert.equal(QUICK_DESIGN_MAX_FILE_BYTES, 10 * 1024 * 1024);
assert.equal(quickDesignLayoutCount('A'), 5);
assert.equal(quickDesignLayoutCount('B'), 5);
assert.deepEqual(QUICK_DESIGN_GARMENTS.map((item) => item.id), ['tshirt', 'sweatshirt', 'hoodie']);
assert.deepEqual(QUICK_DESIGN_SIDES.map((item) => item.id), ['front', 'back']);
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
assert.match(canvas, /paintPremiumTextGlyph/);
assert.match(canvas, /fontSizePercent = 100/);
assert.match(canvas, /premiumStyle = 'solid'/);
const mockupCode = readFileSync('src/lib/quickDesignGarmentMockup.js', 'utf8');
assert.match(mockupCode, /selectedGarment === 'hoodie'/);
assert.match(mockupCode, /selectedSide = side === 'back'/);
assert.match(mockupCode, /not an assertion about Gildan product/);
assert.match(page, /Preview your garment/);
assert.match(page, /Premium text style/);
assert.match(page, /Name font size/);
assert.match(page, /'Requested print side: '/);
assert.match(page, /fontSizePercent,/);
assert.match(page, /premiumStyle,/);
assert.doesNotMatch(mockupCode, /fetch\(|remove\.bg|stripe|openai/i, 'Garment preview must run without network or paid generation');
assert.match(canvas, /curve === 'up' \|\| curve === 'down'/);
assert.match(page, /Automatic background removal \(experimental\)/);
const help = readFileSync('src/components/storefront/QuickDesignHelp.jsx', 'utf8');
const fontStyles = readFileSync('src/pages/quickDesignFonts.css', 'utf8');
assert.match(page, /data-gdp-help-trigger="header"/);
assert.match(page, /data-gdp-help-trigger="request"/);
assert.match(page, /<QuickDesignHelp onClose=/);
assert.match(help, /role="dialog" aria-modal="true"/);
assert.match(help, /https:\/\/gdpclothing\.ca\/pages\/contact/);
assert.match(help, /Copy design details/);
assert.match(help, /No photos are sent to a background-removal service/);
assert.match(fontStyles, /fonts\.googleapis\.com/);
assert.match(fontStyles, /Anton.*Bangers.*Bebas\+Neue.*Graduate.*Rye/);
assert.doesNotMatch(page + help + canvas, /api\.openai\.com|createPaymentIntent|stripe\.confirm|remove\.bg/i, 'Quick Design Help and browser previews must require no paid AI calls or charging');

assert.match(page, /Request submission disabled in preview/);
assert.doesNotMatch(page, /subline: subline \|\| 'CUSTOM BOOTLEG'/);
const headers = readFileSync('public/_headers', 'utf8');
assert.match(headers, /\/quick-design\n  Content-Security-Policy:/);
const globalRule = headers.split('/quick-design')[0];
assert.doesNotMatch(globalRule, /https:\/\/cdn\.jsdelivr\.net|huggingface\.co/, 'Site-wide CSP must remain strict');
console.log('PASS – Quick Design staging, print aspect, font options, automatic cutout setup and no live data mutation');

