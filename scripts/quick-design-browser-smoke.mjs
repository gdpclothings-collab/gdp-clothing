import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    const uploads = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (request.method() !== 'GET' && request.url().includes('/storage/v1/object')) uploads.push(request.url());
    });
    const response = await page.goto(BASE + '/quick-design', { waitUntil: 'domcontentloaded', timeout: 30000 });
    assert.ok(response && response.status() < 400, 'Quick Design route must load');
    await page.locator('[data-gdp-quick-design="true"]').waitFor({ timeout: 30000 });
    assert.match(await page.locator('h1').innerText(), /2 free bootleg samples/i);
    await page.locator('input[aria-label="Upload customer photos"]').setInputFiles({
      name: 'test-photo.png', mimeType: 'image/png', buffer: pixel,
    });
    const artworkA = page.getByAltText('Watermarked sample A artwork');
    const artworkB = page.getByAltText('Watermarked sample B artwork');
    await artworkA.waitFor({ timeout: 30000 });
    await artworkB.waitFor({ timeout: 30000 });
    const srcA = await artworkA.getAttribute('src');
    const srcB = await artworkB.getAttribute('src');
    assert.ok(srcA?.startsWith('data:image/jpeg;base64,'), 'Sample A must be locally rendered');
    assert.ok(srcB?.startsWith('data:image/jpeg;base64,'), 'Sample B must be locally rendered');
    assert.notEqual(srcA, srcB, 'Sample A and B must use genuinely different compositions');
    await page.getByRole('button', { name: 'Choose Sample B', exact: true }).click();
    await page.getByAltText('Sample B on an illustrative black T-shirt').waitFor({ timeout: 10000 });
    assert.equal(await page.getByRole('button', { name: 'Choose Sample B', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(uploads, [], 'Previewing must not upload customer photos to storage');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 4, 'Quick Design viewport should not overflow horizontally: ' + overflow);
    assert.deepEqual(errors, [], 'No uncaught client errors');
    console.log('PASS Quick Design rendered two watermarked previews on ' + viewport.width + 'px viewport');
    await page.close();
  }
} finally {
  await browser.close();
}
