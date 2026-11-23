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
import { detectQuickDesignBackground } from '../src/lib/quickDesignTransparency.js';
import { getQuickDesignPhaseCLayout, getQuickDesignPhaseCRenderOrder, QUICK_DESIGN_PHASE_C_REFERENCE } from '../src/lib/quickDesignPhaseCLayout.js';

assert.equal(QUICK_DESIGN_MAX_PHOTOS, 5);
assert.equal(QUICK_DESIGN_MAX_FILE_BYTES, 10 * 1024 * 1024);
assert.equal(quickDesignLayoutCount(), 5);
assert.equal(await detectQuickDesignBackground({ type: 'image/jpeg', size: 100 }), 'needs-removal');
assert.equal(await detectQuickDesignBackground({ type: 'image/heic', size: 100 }), 'unreadable');
const transparencyCheck = readFileSync('src/lib/quickDesignTransparency.js', 'utf8');
assert.match(transparencyCheck, /cornersAreTransparent/);
assert.match(transparencyCheck, /already-transparent/);
assert.doesNotMatch(transparencyCheck, /fetch\(|supabase\.functions|api\.remove\.bg|X-API-Key/i,
  'Alpha preflight must be local and free');
assert.equal(QUICK_DESIGN_PHASE_C_REFERENCE.nameAtTop, true);
assert.equal(QUICK_DESIGN_PHASE_C_REFERENCE.subjectCentered, true);
assert.equal(QUICK_DESIGN_PHASE_C_REFERENCE.backgroundAnchoredBottom, true);
assert.equal(QUICK_DESIGN_PHASE_C_REFERENCE.transparentArtworkEdge, true);
for (let count = 1; count <= 5; count += 1) {
  const layout = getQuickDesignPhaseCLayout(count);
  assert.equal(layout.length, count, 'Every uploaded photo must be used once');
  for (const slot of layout) {
    assert.ok(slot.x >= 0 && slot.y >= 0 && slot.w > 0 && slot.h > 0);
    assert.ok(slot.x + slot.w <= 1.001 && slot.y + slot.h <= 1.001,
      'Phase C pet composition must fit the original 12 x 16 print area');
  }
  assert.deepEqual(getQuickDesignPhaseCRenderOrder(count).map((item) => item.photoIndex).sort(),
    Array.from({length: count}, (_, i) => i), 'Every uploaded pet must appear once');
}
assert.equal(getQuickDesignPhaseCLayout(1)[0].role, 'hero');
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
assert.match(canvas, /premiumStyle = 'gold-chrome'/);
const mockupCode = readFileSync('src/lib/quickDesignGarmentMockup.js', 'utf8');
assert.match(mockupCode, /selectedGarment === 'hoodie'/);
assert.match(mockupCode, /selectedSide = side === 'back'/);
assert.match(mockupCode, /not an assertion about Gildan product/);
assert.match(page, /Your garment preview/);
assert.match(page, /data-gdp-garment-first="true"/, 'Garment selection must be first');
assert.ok(page.indexOf('data-gdp-garment-first="true"') < page.indexOf('number="2">Upload photos'), 'Garment choice precedes photo upload');
assert.match(page, /data-gdp-preview-gated="true"/, 'Mockup must require explicit garment and side');
assert.match(page, /data-gdp-garment-image="true"/);
assert.match(page, /setGarmentSide\(''\)/, 'Switching garment resets side');
assert.match(page, /renderQuickDesignGarmentMockup\(/, 'Selected garment must render');
assert.doesNotMatch(page, /data-gdp-mockup-gallery|QUICK_DESIGN_GARMENTS\.flatMap/,
  'Do not display a six-image gallery instead of the selected preview');
assert.match(page, /placementChosen/, 'Require garment/side before submission');
assert.doesNotMatch(page, /Compare your two samples|Choose Sample [AB]|Sample [AB]/, 'Phase C must not expose Sample A/B');
assert.match(page, /Premium text style/);
assert.match(page, /Name font size/);
assert.match(page, /'Requested print side: '/);
assert.match(page, /fontSizePercent,/);
assert.match(page, /premiumStyle,/);
assert.doesNotMatch(mockupCode, /fetch\(|remove\.bg|stripe|openai/i, 'Garment preview must run without network or paid generation');
assert.match(canvas, /curve === 'up' \|\| curve === 'down'/);
assert.match(page, /data-gdp-remove-photos="true"/, 'One clear removal button must follow upload');
assert.match(page, /data-gdp-removal-help="true"/, 'Troubleshooting must be collapsible');
assert.match(page, /<summary className="cursor-pointer py-1 font-semibold text-white\/80">Background removal help<\/summary>/);
assert.doesNotMatch(page, /Automatic background removal with remove\.bg \(optional\)/, 'Do not show duplicate lengthy consent checkbox');
assert.doesNotMatch(page, /Phase B preview: background removal starts OFF/, 'Remove long development notice');
assert.match(page, /Uses remove\.bg for opaque photos only/, 'Keep short external-provider consent next to button');
assert.match(page, /url: item\.cutoutUrl \|\| item\.url/, 'Keep successfully processed cutouts when processing is paused or fails');
assert.match(page, /requestQuickDesignRemoveBgCutout\(target\.file\)/);
assert.match(page, /detectQuickDesignBackground\(target\.file\)/);
assert.match(page, /transparency === 'already-transparent'/);
assert.match(page, /data-gdp-photo-status="transparent"/);
assert.doesNotMatch(page, /removeQuickDesignBackground\(/, 'Experimental device model must not process uploads anymore');
const help = readFileSync('src/components/storefront/QuickDesignHelp.jsx', 'utf8');
const fontStyles = readFileSync('src/pages/quickDesignFonts.css', 'utf8');
assert.match(page, /data-gdp-help-trigger="header"/);
assert.match(page, /data-gdp-help-trigger="request"/);
assert.match(page, /<QuickDesignHelp onClose=/);
assert.match(help, /role="dialog" aria-modal="true"/);
assert.match(help, /https:\/\/gdpclothing\.ca\/pages\/contact/);
assert.match(help, /Copy design details/);
assert.match(help, /If you enable remove\.bg, Quick Design first checks/);
assert.match(help, /Step 1: choose a T-shirt/);
assert.doesNotMatch(help, /Phase B Samples A|Sample A or B/);
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
assert.match(canvas, /paintPhaseCPortraits/);
assert.match(canvas, /paintStormBottom/);
assert.match(canvas, /destination-in/);
assert.match(canvas, /canvas\.getContext\('2d', \{ alpha: true \}\)/);
assert.doesNotMatch(canvas, /Promise\.all\(\['A', 'B'\]/, 'Only one artwork composition allowed');
const client = readFileSync('src/lib/quickDesignRemoveBgClient.js', 'utf8');
assert.match(client, /supabase\.functions\.invoke\('gdp-quick-design-remove-bg'/);
assert.doesNotMatch(client, /X-API-Key|GDP_REMOVEBG_API_KEY|https:\/\/api\.remove\.bg/);
const edge = readFileSync('supabase/functions/gdp-quick-design-remove-bg/index.ts', 'utf8');
assert.match(edge, /form\.set\('size', 'preview'\)/);
assert.match(edge, /MAX_MONTHLY_PREVIEW_CALLS = 50/);
assert.doesNotMatch(edge, /Deno\.env\.get\('GDP_REMOVEBG_ENABLED'\)/, 'Activation is controlled by deploy, not an unconfigured second switch');
assert.ok(edge.includes("const FREE_CALLS_SAFETY_BUFFER = 5"), 'Must keep a safety margin for shared free API allowance');
assert.ok(edge.includes("const REMOVE_BG_ACCOUNT = 'https://api.remove.bg/v1.0/account'"), 'Read-only shared free balance check is required');
assert.ok(edge.indexOf('const balanceResponse = await fetch(REMOVE_BG_ACCOUNT') < edge.indexOf('const upstream = await fetch(REMOVE_BG_API'), 'Free-balance check MUST happen before processing');
assert.ok(edge.includes('freeCalls <= FREE_CALLS_SAFETY_BUFFER'), 'Fail closed when free calls too low');
assert.ok(edge.includes("Deno.env.get('REMOVE_BG_API_KEY')"), 'Quick Design must reuse the existing Custom Studio remove.bg secret');
assert.ok(!edge.includes("Deno.env.get('GDP_REMOVEBG_API_KEY')"), 'Do not require a second remove.bg secret');
const customRemoveBg = readFileSync('supabase/functions/remove-photo-background/index.ts', 'utf8');
assert.ok(customRemoveBg.includes('Deno.env.get("REMOVE_BG_API_KEY")'), 'Custom Studio uses the same server-side secret');
assert.ok(customRemoveBg.includes('providerForm.append("size", "auto")'), 'The existing Custom Studio output mode still needs a shared billing-cap review');
assert.ok(edge.includes("const branch = /^https:"), 'Cloudflare preview origin allowlist must stay scoped');
assert.ok(edge.includes("const salt = Deno.env.get('GDP_REMOVEBG_HASH_SALT') || getServerKey()"), 'Reuse existing server secret instead of requiring another key');
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
console.log('PASS – Phase C single STORM-style transparent artwork, six mockups, one print side, and guarded remove.bg opt-in');

