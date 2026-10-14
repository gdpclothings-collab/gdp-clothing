import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = (process.env.PRODUCTION_BASE_URL || 'https://gdpclothing.ca').replace(/\/+$/, '');
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || 'production-smoke-results';
const CART_KEY = 'gdp_cart_v2__guest';
const PRODUCT_ID = '85e638f0-7fd0-4b0f-b661-c6e7b4965bf3';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

const report = { suite: 'custom-studio-seasonal-final-review', baseUrl: BASE_URL, generatedAt: new Date().toISOString(), status: 'running', viewports: [] };
function assert(condition, message) { if (!condition) throw new Error(message); }

function draftState() {
  const blankSeasonal = () => ({ layers: [], activeLayerId: '', confirmed: false });
  const blankProtected = () => ({
    templateId: '', photo: null, transform: { scale: 100, rotation: 0, x: 0, y: 0 },
    photos: [], activePhotoId: '', stickers: [], activeStickerId: '',
    text: { headline: '', subline: '', message: '' },
    textStyle: { fontFamily: 'Impact', fontScale: 100, color: '#ffffff', curve: 'straight', curveAmount: 45, effect: 'shadow', effectStrength: 45, rotation: 0, x: 0, y: 0 },
    confirmed: false,
  });
  const blankUpload = () => ({ artwork: null, transform: { scale: 100, rotation: 0, x: 0, y: 0 }, confirmed: false });
  return {
    step: 'customize', productId: PRODUCT_ID, color: 'White', size: 'L', quantity: 1,
    designPath: 'seasonal', side: 'front',
    seasonal: { sides: { front: blankSeasonal(), back: blankSeasonal() } },
    bootleg: { sides: { front: blankProtected(), back: blankProtected() } },
    memorial: { sides: { front: blankProtected(), back: blankProtected() } },
    upload: { sides: { front: blankUpload(), back: blankUpload() } },
    approval: { needByDate: '', rightsConfirmed: true, finalDesignApproved: false },
  };
}

async function loadedImage(image, label) {
  await image.waitFor({ state: 'visible', timeout: 20000 });
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const info = await image.evaluate((node) => ({
      complete: node.complete,
      width: node.naturalWidth,
      src: node.currentSrc || node.src,
    }));
    if (info.complete && info.width > 0) return info;
    if (info.complete && info.src && !info.width) throw new Error(`${label} image failed to load: ${info.src}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${label} did not load in time`);
}

async function inspect(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: 'en-CA', timezoneId: 'America/Regina', colorScheme: 'light',
  });
  const key = `seasonal_final_review_${viewport.name}`;
  const draft = { version: 1, state: draftState() };
  await context.addInitScript(({ storageKey, cartKey, cartItem }) => {
    localStorage.setItem(storageKey, JSON.stringify([{ ...cartItem, key: cartKey }]));
  }, {
    storageKey: CART_KEY, cartKey: key,
    cartItem: { productId: PRODUCT_ID, name: 'Seasonal Final Review smoke garment', image: '/images/gdp-tshirt.svg',
      isCustom: true, isDtf: false, designPath: 'seasonal', color: 'White', size: 'L', quantity: 1,
      price: 30, studioV2Draft: draft },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    const response = await page.goto(`${BASE_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert(response && response.status() < 400, `${viewport.name}: cart route did not load`);
    await page.getByRole('button', { name: /^Edit design$/i }).first().click();
    await page.waitForURL((url) => url.pathname === '/custom-studio-v2', { timeout: 15000 });

    const workspace = page.locator('[data-gdp-seasonal-canvas-stable="true"]');
    await workspace.waitFor({ state: 'visible', timeout: 20000 });
    const seasonalLibrary = page.getByText('Seasonal Library', { exact: true }).locator('xpath=ancestor::section[1]');
    const options = seasonalLibrary.locator('button.group');
    await options.first().waitFor({ state: 'visible', timeout: 25000 });
    await options.first().click();

    const editorLayer = workspace.locator('button[data-seasonal-v2-layer]').first();
    await editorLayer.waitFor({ state: 'visible', timeout: 20000 });
    const liveArtwork = await loadedImage(editorLayer.locator('img').first(), `${viewport.name}: live Seasonal artwork`);
    const originalPosition = await editorLayer.getAttribute('style');

    const approvalCard = page.locator('[data-gdp-step3-unified-approval="true"]');
    const approvalCheckbox = page.locator('[data-gdp-step3-approval-checkbox="true"]');
    await approvalCard.waitFor({ state: 'visible', timeout: 15000 });
    assert(await approvalCheckbox.isEnabled(), 'Seasonal approval should enable after artwork is placed');
    assert(!(await approvalCheckbox.isChecked()), 'Unapproved Seasonal artwork must not begin checked');
    assert(await page.locator('[data-gdp-step3-approval="true"] input[type="checkbox"]').count() === 1, 'Seasonal approval must have one checkbox');
    await approvalCard.click();
    assert(await approvalCheckbox.isChecked(), 'Seasonal unified approval not recorded');

    const finalAction = page.getByRole('button', { name: /Final review/i }).last();
    await finalAction.waitFor({ state: 'visible', timeout: 15000 });
    await finalAction.click();
    await page.getByRole('heading', { name: /^Final review$/i }).waitFor({ state: 'visible', timeout: 15000 });

    const approved = page.locator('[data-gdp-final-review-preview="true"]');
    await approved.waitFor({ state: 'visible', timeout: 15000 });
    // Final Review must show the approved garment/artwork only. The editing
    // print-size badge and dashed-boundary explanation belong to Step 3.
    assert(await approved.locator('[data-gdp-print-size]').count() === 0,
      'custom-studio-seasonal-final-review-smoke.mjs: print-size badge attribute leaked into Final Review');
    assert(await approved.locator('p').filter({ hasText: /drag with one finger|drag to move|dashed fabric box|dashed boundary|normalized geometry/i }).count() === 0,
      'custom-studio-seasonal-final-review-smoke.mjs: editor-only fabric guidance leaked into Final Review');
    const generatedPrintLabel = await approved.locator('[data-gdp-print-guide="true"]').first().evaluate((node) => {
      const frame = node.parentElement;
      return frame ? getComputedStyle(frame, '::before').content : '';
    });
    assert(!/print size/i.test(generatedPrintLabel),
      'custom-studio-seasonal-final-review-smoke.mjs: generated CSS print-size badge is still visible in Final Review');

    const staticLayer = approved.locator('[data-gdp-seasonal-review-artwork="true"]').first();
    await staticLayer.waitFor({ state: 'visible', timeout: 15000 });
    const approvedArtwork = await loadedImage(staticLayer.locator('img').first(), `${viewport.name}: approved Seasonal artwork`);
    const approvedPosition = await staticLayer.getAttribute('style');
    assert(approvedArtwork.src === liveArtwork.src, `${viewport.name}: approved Seasonal preview changed or lost its artwork`);
    assert(approvedPosition === originalPosition, `${viewport.name}: Final Review changed Seasonal artwork transform`);
    assert(await approved.getByText(/Final garment preview · front/i).first().isVisible(), `${viewport.name}: front preview label missing`);
    assert(await approved.locator('button,input,select,textarea').count() === 0, `${viewport.name}: approved preview still exposes editor actions`);
    assert(await page.locator('[data-gdp-review-garment-preview="true"]').isHidden(), `${viewport.name}: duplicate plain garment was not suppressed`);
    const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    assert(metrics.scrollWidth <= metrics.clientWidth + 3, `${viewport.name}: horizontal overflow in Seasonal Final Review`);
    assert(!pageErrors.length, `${viewport.name}: JavaScript errors ${pageErrors.join(' | ')}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, `custom-studio-seasonal-final-review-${viewport.name}.png`), fullPage: true });
    return { viewport, status: 'passed', artworkPreserved: true, transformPreserved: true, duplicateGarmentHidden: true };
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of VIEWPORTS) report.viewports.push(await inspect(browser, viewport));
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error?.message || String(error);
    process.exitCode = 1;
  } finally { await browser.close(); }
  await fs.writeFile(path.join(ARTIFACT_DIR, 'custom-studio-seasonal-final-review-report.json'), JSON.stringify(report, null, 2));
  console.log(`# Seasonal Final Review smoke: ${report.status}\n${report.error || ''}`);
}
await main();
