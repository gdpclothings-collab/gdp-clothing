import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = (process.env.PRODUCTION_BASE_URL || 'https://gdpclothing.ca').replace(/\/+$/, '');
const DIR = process.env.SMOKE_ARTIFACT_DIR || 'production-smoke-results';
const PRODUCT = '85e638f0-7fd0-4b0f-b661-c6e7b4965bf3';
const CASES = [
  { name: 'bootleg', id: 'flame-ice' },
  { name: 'memorial', id: 'memorial-eternal-light' },
];
const VIEWS = [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }];
const report = { suite: 'protected-final-review-smoke', status: 'running', cases: [] };
const assert = (ok, message) => { if (!ok) throw new Error(message); };

function createDraft(testCase) {
  const image = BASE + '/images/gdp-logo.webp';
  const asset = { path: image, url: image, name: 'read-only-test.webp', type: 'image/webp' };
  const transform = { scale: 100, rotation: 0, x: 0, y: 0 };
  const emptyProtected = () => ({
    templateId: '', photo: null, transform, photos: [], activePhotoId: '', stickers: [],
    activeStickerId: '', textLayers: [], text: { headline: '', subline: '', message: '' },
    textStyle: { fontFamily: 'Impact', fontScale: 100, color: '#ffffff',
      curve: 'straight', curveAmount: 45, effect: 'shadow', effectStrength: 45, rotation: 0, x: 0, y: 0 },
    confirmed: false,
  });
  const selected = {
    ...emptyProtected(), templateId: testCase.id, photo: asset,
    photos: [{ id: 'readonly-photo', type: 'photo', asset, transform, order: 0, visible: true }],
    activePhotoId: 'readonly-photo', confirmed: true,
  };
  const emptySeasonal = () => ({ layers: [], activeLayerId: '', confirmed: false });
  const emptyUpload = () => ({ artwork: null, transform, confirmed: false });
  return {
    step: 'customize', productId: PRODUCT, color: 'Black', size: 'S', quantity: 1, designPath: testCase.name, side: 'front',
    seasonal: { sides: { front: emptySeasonal(), back: emptySeasonal() } },
    bootleg: { sides: { front: testCase.name === 'bootleg' ? selected : emptyProtected(), back: emptyProtected() } },
    memorial: { sides: { front: testCase.name === 'memorial' ? selected : emptyProtected(), back: emptyProtected() } },
    upload: { sides: { front: emptyUpload(), back: emptyUpload() } },
    approval: { needByDate: '', rightsConfirmed: true, finalDesignApproved: false },
  };
}

async function imageLoaded(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 20000 });
  const state = await locator.evaluate(async (img) => {
    if (!img.complete) await new Promise((resolve, reject) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', reject, { once: true });
    });
    return { src: img.currentSrc || img.src, naturalWidth: img.naturalWidth };
  });
  assert(state.naturalWidth > 0, label + ': image did not load');
  return state.src;
}

async function inspect(browser, testCase, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: 'en-CA', timezoneId: 'America/Regina', colorScheme: 'light',
  });
  const draft = { version: 1, state: createDraft(testCase) };
  await context.addInitScript(({ draftData, id }) => {
    localStorage.setItem('gdp_cart_v2__guest', JSON.stringify([{
      key: id, productId: '85e638f0-7fd0-4b0f-b661-c6e7b4965bf3', name: 'Protected preview smoke garment',
      image: '/images/gdp-tshirt.svg', isCustom: true, isDtf: false,
      designPath: draftData.state.designPath, color: 'Black', size: 'S', quantity: 1,
      price: 30, studioV2Draft: draftData,
    }]));
  }, { draftData: draft, id: 'protected-final-review-' + testCase.name + '-' + viewport.name });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const id = 'data-gdp-' + testCase.name;
  try {
    await page.goto(BASE + '/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByRole('button', { name: /^Edit design$/i }).first().click();
    await page.waitForURL((url) => url.pathname === '/custom-studio-v2', { timeout: 15000 });
    const live = page.locator('[data-gdp-studio-v2-guard="true"]');
    const template = live.locator('[' + id + '-template-layer="true"]').first();
    const photo = live.locator('[' + id + '-free-photo-layer="true"]').first();
    await template.waitFor({ state: 'attached', timeout: 15000 });
    await photo.waitFor({ state: 'attached', timeout: 15000 });
    const initialTemplateImage = await imageLoaded(template.locator('img[alt="GDP template artwork"]'), 'Live template');
    const initialPhotoImage = await imageLoaded(photo.locator('img[alt="Customer photo layer"]'), 'Live customer photo');
    // Template assets can be overridden in Studio settings; compare approved images against the live selection instead.
    const templateStyle = await template.getAttribute('style');
    const photoStyle = await photo.getAttribute('style');

    const approvalCard = page.locator('[data-gdp-step3-unified-approval="true"]');
    const approvalCheckbox = page.locator('[data-gdp-step3-approval-checkbox="true"]');
    await approvalCard.waitFor({ state: 'visible', timeout: 15000 });
    assert(await approvalCheckbox.isEnabled(), 'Protected design must permit combined approval');
    assert(!(await approvalCheckbox.isChecked()), 'Restored protected design must require approval');
    assert(await page.locator('[data-gdp-step3-approval="true"] input[type="checkbox"]').count() === 1, 'Only one checkbox is allowed in Step 3 approval');
    await approvalCard.click();
    assert(await approvalCheckbox.isChecked(), 'Protected design and rights approval not recorded');

    const next = page.getByRole('button', { name: /Final review/i }).last();
    assert(!(await next.isDisabled()), 'Final Review did not enable for ' + testCase.name);
    await next.click();
    await page.getByRole('heading', { name: /^Final review$/i }).waitFor({ state: 'visible', timeout: 15000 });
    const preview = page.locator('[data-gdp-final-review-preview="true"]');
    await preview.waitFor({ state: 'visible', timeout: 15000 });
    // Final Review must show the approved garment/artwork only. The editing
    // print-size badge and dashed-boundary explanation belong to Step 3.
    assert(await preview.locator('[data-gdp-print-size]').count() === 0,
      'custom-studio-protected-final-review-smoke.mjs: print-size badge attribute leaked into Final Review');
    assert(await preview.locator('p').filter({ hasText: /drag with one finger|drag to move|dashed fabric box|dashed boundary|normalized geometry/i }).count() === 0,
      'custom-studio-protected-final-review-smoke.mjs: editor-only fabric guidance leaked into Final Review');
    const generatedPrintLabel = await preview.locator('[data-gdp-print-guide="true"]').first().evaluate((node) => {
      const frame = node.parentElement;
      return frame ? getComputedStyle(frame, '::before').content : '';
    });
    assert(!/print size/i.test(generatedPrintLabel),
      'custom-studio-protected-final-review-smoke.mjs: generated CSS print-size badge is still visible in Final Review');

    const printGuideChrome = await preview.locator('[data-gdp-print-guide="true"]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        shadow: getComputedStyle(node).boxShadow,
        outline: getComputedStyle(node).outlineStyle,
        border: getComputedStyle(node).borderColor,
        borderWidth: getComputedStyle(node).borderWidth,
      }))
    );
    assert(printGuideChrome.length > 0, 'Final Review must keep its nonvisual print-area coordinate anchor');
    assert(printGuideChrome.every((guide) =>
      guide.shadow === 'none' && guide.outline === 'none' &&
      (guide.border === 'rgba(0, 0, 0, 0)' || guide.border === 'transparent')),
      'Step 4 approval preview still shows a faint print-box outline or drop-shadow');

    const approvedTemplate = preview.locator('[' + id + '-template-layer="true"]').first();
    const approvedPhoto = preview.locator('[' + id + '-free-photo-layer="true"]').first();
    await approvedTemplate.waitFor({ state: 'attached', timeout: 15000 });
    await approvedPhoto.waitFor({ state: 'attached', timeout: 15000 });

    assert(await imageLoaded(approvedTemplate.locator('img[alt="GDP template artwork"]'), 'Approved template') === initialTemplateImage, 'Template source changed');
    assert(await imageLoaded(approvedPhoto.locator('img[alt="Customer photo layer"]'), 'Approved photo') === initialPhotoImage, 'Photo source changed');
    assert(await approvedTemplate.getAttribute('style') === templateStyle, 'Template transform changed');
    assert(await approvedPhoto.getAttribute('style') === photoStyle, 'Photo transform changed');
    assert(await preview.locator('button,input,select,textarea').count() === 0, 'Editing controls remain in approved preview');
    assert(await preview.locator('[data-gdp-bootleg-text-bounds="true"]').count() === 0, 'Text selection bounds remain');
    const selectionCount = await preview.locator('[' + id + '-template-layer="true"],[' + id + '-free-photo-layer="true"]').evaluateAll(
      (nodes) => nodes.filter((node) => /(?:^|\s)(?:ring|active:ring|cursor-grab|cursor-move)/.test(String(node.className || ''))).length
    );
    assert(selectionCount === 0, 'Selection highlights remain in Final Review');
    assert(await page.locator('[data-gdp-review-garment-preview="true"]').isHidden(), 'Duplicate plain garment preview visible');
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    assert(width.scroll <= width.client + 3, 'Mobile horizontal overflow');
    assert(errors.length === 0, 'Browser errors: ' + errors.join(' | '));
    await page.screenshot({ path: path.join(DIR, 'protected-final-review-' + testCase.name + '-' + viewport.name + '.png'), fullPage: true });
    return { designPath: testCase.name, viewport: viewport.name, status: 'passed' };
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const design of CASES) for (const viewport of VIEWS) report.cases.push(await inspect(browser, design, viewport));
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error?.message || String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  await fs.writeFile(path.join(DIR, 'protected-final-review-report.json'), JSON.stringify(report, null, 2));
  console.log('# Protected Design Paths Final Review smoke: ' + report.status + (report.error ? '\n' + report.error : ''));
}
await main();
