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
import { QUICK_DESIGN_PHASE_B_NAMES, getQuickDesignPhaseBLayout, getQuickDesignPhaseBRenderOrder } from '../src/lib/quickDesignPhaseBLayout.js';

assert.equal(QUICK_DESIGN_MAX_PHOTOS, 5);
assert.equal(QUICK_DESIGN_MAX_FILE_BYTES, 10 * 1024 * 1024);
assert.equal(quickDesignLayoutCount('A'), 5);
assert.equal(quickDesignLayoutCount('B'), 5);
assert.equal(QUICK_DESIGN_PHASE_B_NAMES.A, 'Layered Classic');
assert.equal(QUICK_DESIGN_PHASE_B_NAMES.B, 'Dramatic Stack');
for (let count = 1; count <= 5; count += 1) {
  const a = getQuickDesignPhaseBLayout('A', count);
  const b = getQuickDesignPhaseBLayout('B', count);
  assert.equal(a.length, count, 'Sample A must use exactly the uploaded photo count');
  assert.equal(b.length, count, 'Sample B must use exactly the uploaded photo count');
  for (const slots of [a, b]) {
    for (const slot of slots) {
      assert.ok(slot.x >= 0 && slot.y >= 0 && slot.w > 0 && slot.h > 0,
        'All collage positions must be on the print canvas');
      assert.ok(slot.x + slot.w <= 1.001 && slot.y + slot.h <= 1.001,
        'Subject placement must fit the original GDP background');
    }
  }
}
assert.notDeepEqual(getQuickDesignPhaseBLayout('A', 5), getQuickDesignPhaseBLayout('B', 5));
assert.deepEqual(getQuickDesignPhaseBRenderOrder('A', 5).map((item) => item.photoIndex).sort(), [0,1,2,3,4]);
assert.equal(getQuickDesignPhaseBLayout('A', 1)[0].role, 'hero');
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
assert.match(page, /Automatic background removal with remove\.bg \(optional\)/);
assert.match(page, /requestQuickDesignRemoveBgCutout\(target\.file\)/);
assert.doesNotMatch(page, /removeQuickDesignBackground\(/, 'Experimental device model must not process uploads anymore');
const help = readFileSync('src/components/storefront/QuickDesignHelp.jsx', 'utf8');
const fontStyles = readFileSync('src/pages/quickDesignFonts.css', 'utf8');
assert.match(page, /data-gdp-help-trigger="header"/);
assert.match(page, /data-gdp-help-trigger="request"/);
assert.match(page, /<QuickDesignHelp onClose=/);
assert.match(help, /role="dialog" aria-modal="true"/);
assert.match(help, /https:\/\/gdpclothing\.ca\/pages\/contact/);
assert.match(help, /Copy design details/);
assert.match(help, /If you enable the optional remove\.bg checkbox/);
assert.match(help, /Phase B Samples A/);
assert.match(fontStyles, /fonts\.googleapis\.com/);
assert.match(fontStyles, /Anton.*Bangers.*Bebas\+Neue.*Graduate.*Rye/);
assert.doesNotMatch(page + help + canvas, /api\.openai\.com|createPaymentIntent|stripe\.confirm|https:\/\/api\.remove\.bg/i, 'Browser must never embed a remove.bg endpoint/key or payment integration');
assert.match(page, /href="https:\/\/www\.remove\.bg\/" target="_blank" rel="noopener noreferrer"/);
assert.match(page, /setAutoCutout\(false\)/);
assert.match(page, /overflow-x-clip/);
assert.match(page, /data-gdp-photo-grid="true"/);
assert.match(page, /setCutoutUnavailable\(true\)/);
assert.match(page, /setAutoCutout\(false\)/);
assert.match(canvas, /trimmedAlphaBounds/);
assert.match(canvas, /paintPhaseBPortraits/);
assert.match(canvas, /ctx\.drawImage\(background, 0, 0, PREVIEW_W, PREVIEW_H\)/);
const client = readFileSync('src/lib/quickDesignRemoveBgClient.js', 'utf8');
assert.match(client, /supabase\.functions\.invoke\('gdp-quick-design-remove-bg'/);
assert.doesNotMatch(client, /X-API-Key|GDP_REMOVEBG_API_KEY|https:\/\/api\.remove\.bg/);
const edge = readFileSync('supabase/functions/gdp-quick-design-remove-bg/index.ts', 'utf8');
assert.match(edge, /form\.set\('size', 'preview'\)/);
assert.match(edge, /MAX_MONTHLY_PREVIEW_CALLS = 50/);
assert.match(edge, /GDP_REMOVEBG_ENABLED/);
assert.ok(edge.includes("Deno.env.get('REMOVE_BG_API_KEY')"), 'Quick Design must reuse the existing Custom Studio remove.bg secret');
assert.ok(!edge.includes("Deno.env.get('GDP_REMOVEBG_API_KEY')"), 'Do not require a second remove.bg secret');
const customRemoveBg = readFileSync('supabase/functions/remove-photo-background/index.ts', 'utf8');
assert.ok(customRemoveBg.includes('Deno.env.get("REMOVE_BG_API_KEY")'), 'Custom Studio uses the same server-side secret');
assert.ok(customRemoveBg.includes('providerForm.append("size", "auto")'), 'The existing Custom Studio output mode still needs a shared billing-cap review');
assert.match(edge, /GDP_REMOVEBG_ALLOW_PREVIEW/);
assert.match(edge, /reserve_quick_design_removebg_preview/);
assert.match(edge, /ALLOWED_MIMES/);
assert.match(edge, /function validSignature/);
assert.doesNotMatch(edge, /form\.set\('size', '(?:full|auto|50MP)'\)/);
const quota = readFileSync('supabase/migrations/20261122000000_quick_design_removebg_free_preview_quota.sql', 'utf8');
assert.match(quota, /on conflict\(month_utc\) do update/i);
assert.match(quota, /where private\.quick_design_removebg_monthly_quota\.attempts < v_monthly_limit/);
assert.match(quota, /revoke all on function public\.reserve_quick_design_removebg_preview/);
assert.match(quota, /grant execute on function public\.reserve_quick_design_removebg_preview[\s\S]*to service_role/);


assert.match(page, /Request submission disabled in preview/);
assert.doesNotMatch(page, /subline: subline \|\| 'CUSTOM BOOTLEG'/);
const headers = readFileSync('public/_headers', 'utf8');
assert.match(headers, /Content-Security-Policy:/);
assert.doesNotMatch(headers, /https:\/\/cdn\.jsdelivr\.net|huggingface\.co|wasm-unsafe-eval/, 'No device-model CDN or WASM CSP exceptions should remain');
assert.doesNotMatch(headers, /\/quick-design\n  Content-Security-Policy:/, 'Quick Design must inherit the standard strict CSP');
console.log('PASS – Phase B layout, opt-in remove.bg safety gates, 1–5 photos, zero extra charge, and no live data mutation');

