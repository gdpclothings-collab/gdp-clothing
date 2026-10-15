import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = (process.env.PRODUCTION_BASE_URL || 'https://gdpclothing.ca').replace(/\/+$/, '');
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || 'production-smoke-results';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const report = { target: BASE, status: 'running', viewports: [] };
const assert = (ok, description) => { if (!ok) throw new Error(description); };
const gallery = (page) => page.locator('[data-gdp-garment-gallery="true"]');
const focused = (page) => page.locator('[data-gdp-selected-garment-configurator="true"]');

async function verify(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: 'en-CA',
    timezoneId: 'America/Regina',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const result = { viewport: viewport.name, transitions: [] };

  const checkUrl = (step, view) => {
    const url = new URL(page.url());
    assert(url.pathname === '/custom-studio', 'Navigation left the Studio: ' + url.toString());
    assert(url.searchParams.get('studioStep') === step, 'Incorrect Studio stage: ' + url.toString());
    if (step === 'garment' && view) assert(url.searchParams.get('garmentView') === view, 'Incorrect garment mode: ' + url.toString());
  };

  const browserBack = async (label) => {
    await page.goBack({ timeout: 20000 });
    assert(new URL(page.url()).pathname === '/custom-studio', label + ': browser Back left Studio');
  };
  const browserForward = async (label) => {
    await page.goForward({ timeout: 20000 });
    assert(new URL(page.url()).pathname === '/custom-studio', label + ': browser Forward left Studio');
  };

  try {
    const response = await page.goto(BASE + '/custom-studio', { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert(response && response.status() < 400, 'Custom Studio did not load');
    await gallery(page).waitFor({ state: 'visible', timeout: 20000 });
    const cards = gallery(page).locator(':scope > div > button');
    assert(await cards.count() > 0, 'No available garment cards');

    // Reproduces the user's recording: choosing a garment and immediately
    // pressing the browser Back button, before selecting a size.
    await cards.first().click();
    await focused(page).waitFor({ state: 'visible' });
    checkUrl('garment', 'focused');
    result.transitions.push('gallery → focused');

    await browserBack('selected garment');
    await gallery(page).waitFor({ state: 'visible' });
    result.transitions.push('browser Back → gallery');

    await browserForward('gallery to selected garment');
    await focused(page).waitFor({ state: 'visible' });
    checkUrl('garment', 'focused');
    result.transitions.push('browser Forward → selected garment');

    await page.locator('[data-gdp-change-garment="true"]').click();
    await gallery(page).waitFor({ state: 'visible' });
    checkUrl('garment', 'browse');
    await browserBack('change garment');
    await focused(page).waitFor({ state: 'visible' });
    await browserForward('change garment forward');
    await gallery(page).waitFor({ state: 'visible' });
    result.transitions.push('Change garment → Back/Forward');

    await gallery(page).locator(':scope > div > button').first().click();
    await focused(page).waitFor({ state: 'visible' });
    const size = page.locator('[data-gdp-size-panel="true"] button:enabled').first();
    await size.waitFor({ state: 'visible' });
    await size.click();

    const continueButton = page.locator('[data-gdp-garment-continue="true"]');
    await continueButton.waitFor({ state: 'visible' });
    assert(await continueButton.isEnabled(), 'Cannot continue from selected size');
    await continueButton.click();
    await page.getByRole('heading', { name: /choose a design path/i }).waitFor({ state: 'visible' });
    checkUrl('design');
    result.transitions.push('focused → Choose Design');

    await browserBack('design to garment');
    await focused(page).waitFor({ state: 'visible' });
    checkUrl('garment', 'focused');
    assert(await page.locator('[data-gdp-selected-garment-summary="true"]').isVisible(), 'Selected garment lost after returning');
    await browserForward('garment to design');
    await page.getByRole('heading', { name: /choose a design path/i }).waitFor({ state: 'visible' });

    const uploadCard = page.locator('[data-gdp-v2-design-path="upload"]').first();
    await uploadCard.waitFor({ state: 'visible' });
    await uploadCard.click();
    await page.getByRole('heading', { name: /^Upload My Own Artwork$/i }).first().waitFor({ state: 'visible' });
    checkUrl('customize');
    await browserBack('customize to design');
    await page.getByRole('heading', { name: /choose a design path/i }).waitFor({ state: 'visible' });
    await browserForward('design to customize');
    await page.getByRole('heading', { name: /^Upload My Own Artwork$/i }).first().waitFor({ state: 'visible' });
    result.transitions.push('Choose Design ↔ Customize');

    assert(pageErrors.length === 0, 'Page errors: ' + pageErrors.join(' | '));
    result.status = 'passed';
  } catch (e) {
    result.status = 'failed';
    result.error = String(e?.message || e);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'studio-history-' + viewport.name + '-FAILED.png'), fullPage: true }).catch(() => {});
    throw e;
  } finally {
    await context.close();
    report.viewports.push(result);
  }
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of VIEWPORTS) await verify(browser, viewport);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = String(error?.message || error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  await fs.writeFile(path.join(ARTIFACT_DIR, 'studio-browser-history-report.json'), JSON.stringify(report, null, 2));
  console.log('Custom Studio browser history: ' + report.status.toUpperCase());
  report.viewports.forEach((r) => console.log(r.viewport + ' — ' + r.status + ' — ' + r.transitions.join(', ')));
  if (report.error) console.error(report.error);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
