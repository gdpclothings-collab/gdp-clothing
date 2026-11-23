import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
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
    assert.equal(await page.getByText("Ask GDP", { exact: true }).count(), 0, "Assistant overlay must not cover Quick Design controls");
    assert.match(await page.locator('h1').innerText(), /Your design.*On any garment/i);
    // Help is contextual and free; no persistent chat widget or paid API.
    await page.locator('[data-gdp-help-trigger="header"]').click();
    const help = page.getByRole('dialog', { name: 'Need help with your design?' });
    await help.waitFor({ timeout: 10000 });
    assert.ok(await help.getByText('How do I preview my design on a garment?').count() > 0);
    assert.equal(await help.getByRole('link', { name: /Contact GDP/i }).getAttribute('href'), 'https://gdpclothing.ca/pages/contact');
    await page.keyboard.press('Escape');
    assert.equal(await help.count(), 0, 'Escape must close help without changing design');

    // Upload must start with one clear action; instructions are hidden in optional help.
    assert.equal(await page.locator('[data-gdp-removal-help="true"]').evaluate((el) => el.open), false, 'Background-removal help must be collapsed by default');
    assert.equal(await page.getByRole('checkbox', { name: /Automatic background removal/i }).count(), 0, 'Crowded duplicate checkbox must be removed');
    await page.getByRole('textbox', { name: 'Main name or heading' }).fill('HENRY');
    await page.getByRole('combobox', { name: 'Bootleg name font' }).selectOption('serif');
    await page.getByRole('combobox', { name: 'Name layout' }).selectOption('up');
    await page.getByRole('button', { name: 'Increase name font size' }).click();
    await page.getByRole('button', { name: 'Increase name font size' }).click();
    assert.match(await page.locator('[data-gdp-font-size-value]').innerText(), /110%/);
    await page.getByRole('combobox', { name: 'Premium text style' }).selectOption('silver-chrome');

    // Real cutout PNG with alpha corners; must be kept byte-for-byte without
    // calling the shared remove.bg service or spending credits.
    const { transparentBase64, opaqueBase64 } = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#bf2898';
      ctx.fillRect(15, 14, 34, 35); // Transparent corners are untouched.
      const transparentBase64 = c.toDataURL('image/png').split(',')[1];
      ctx.fillStyle = '#cba47d';
      ctx.fillRect(0, 0, 64, 64); // Entire image is opaque, so needs removal.
      return { transparentBase64, opaqueBase64: c.toDataURL('image/png').split(',')[1] };
    });
    await page.locator('input[aria-label="Upload customer photos"]').setInputFiles([
      { name: 'already-transparent.png', mimeType: 'image/png', buffer: Buffer.from(transparentBase64, 'base64') },
      ...Array.from({ length: 4 }, (_, i) => ({
        name: 'opaque-test-photo-' + (i + 1) + '.png', mimeType: 'image/png', buffer: Buffer.from(opaqueBase64, 'base64'),
      })),
    ]);
    assert.equal(await page.locator('[data-gdp-photo-grid="true"] > div').count(), 5, 'Five uploaded photos must display on mobile without widening page');
    let overflowAfterPhotos = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflowAfterPhotos <= 4, 'Five photos must not expose white right-side panel: ' + overflowAfterPhotos);
    // One transparent STORM-reference composition, six distinct black garment
    // mockups. The selected print SIDE is one choice, not two included prints.
    const gallery = page.locator('[data-gdp-mockup-gallery="true"]');
    await gallery.waitFor({ timeout: 60000 });
    const options = gallery.locator('button');
    assert.equal(await options.count(), 6, 'Exactly six front/back garment options required');
    assert.equal(await page.locator('[data-gdp-sample-option]').count(), 0, 'A/B artwork choices must be removed');
    assert.equal(await page.getByRole('button', { name: 'Show Front view' }).getAttribute('aria-pressed'), 'true',
      'Front must be the default and only selected print side');
    assert.equal(await page.getByRole('button', { name: 'Preview T-shirt' }).getAttribute('aria-pressed'), 'true',
      'T-shirt must be the default garment');
    const garmentImage = page.locator('[data-gdp-garment-image="true"]');
    const imageSources = new Set();
    for (const garment of ['T-shirt', 'Sweatshirt', 'Hoodie']) {
      for (const side of ['Front', 'Back']) {
        const option = page.getByRole('button', { name: 'View ' + garment + ' ' + side, exact: true });
        assert.equal(await option.count(), 1, garment + ' ' + side + ' option must exist');
        const image = option.locator('img');
        const src = await image.getAttribute('src');
        assert.ok(src?.startsWith('data:image/jpeg;base64,'), 'All six mockups must be fully rendered: ' + garment + ' ' + side);
        imageSources.add(src);
        await option.click();
        assert.equal(await option.getAttribute('aria-pressed'), 'true', 'Select only ' + garment + ' ' + side);
        assert.equal(await garmentImage.getAttribute('src'), src, 'Main mockup must show selected garment and side');
        assert.equal(await page.getByRole('button', { name: 'Show ' + side + ' view' }).getAttribute('aria-pressed'), 'true');
        const otherSide = side === 'Front' ? 'Back' : 'Front';
        assert.equal(await page.getByRole('button', { name: 'Show ' + otherSide + ' view' }).getAttribute('aria-pressed'), 'false');
      }
    }
    assert.equal(imageSources.size, 6, 'All six choices must render distinct garment/side images');
    assert.ok(await page.getByText('Front and back are alternatives; both are not included.', { exact: false }).count() > 0);
    const subtitle = page.getByRole('textbox', { name: /Subtitle/i });
    assert.equal(await subtitle.inputValue(), '', 'No forced CUSTOM BOOTLEG subtitle');
    await page.locator('[data-gdp-help-trigger="request"]').click();
    await page.getByRole('dialog', { name: 'Need help with your design?' }).waitFor();
    await page.getByRole('button', { name: 'Close design help' }).click();
    assert.equal(await page.getByRole('button', { name: 'Preview Hoodie' }).getAttribute('aria-pressed'), 'true',
      'Help must preserve selected garment');
    assert.equal(await page.getByRole('button', { name: 'Show Back view' }).getAttribute('aria-pressed'), 'true',
      'Help must preserve selected side');
    assert.equal(await page.getByRole('combobox', { name: 'Premium text style' }).inputValue(), 'silver-chrome');
    assert.ok(await page.getByRole('button', { name: 'Save mockup' }).count() > 0,
      'Selected mockup must be downloadable without an order');

    // Phase B must NOT send photos to remove.bg without explicit consent.
    // Simulate one successful free cutout then a server-enforced quota stop.
    // Never call the real third-party API or spend credits during tests.
    let cutoutPosts = 0;
    await page.route('**/functions/v1/gdp-quick-design-remove-bg', async (route) => {
      const method = route.request().method();
      const headers = {
        'access-control-allow-origin': BASE,
        'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
        'access-control-allow-methods': 'POST, OPTIONS',
      };
      if (method === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', headers,
          body: JSON.stringify({ ready: true, code: 'READY', message: 'Free preview removal is available.' }) });
        return;
      }
      cutoutPosts += 1;
      if (cutoutPosts === 1) {
        await route.fulfill({ status: 200, contentType: 'application/octet-stream', headers, body: Buffer.from(transparentBase64, 'base64') });
      } else {
        await route.fulfill({
          status: 429, contentType: 'application/json', headers,
          body: JSON.stringify({ code: 'LIMIT_REACHED', message: 'The shared remove.bg free allowance is too low. Use the external option.', fallback: 'https://www.remove.bg/' }),
        });
      }
    });
    assert.equal(cutoutPosts, 0, 'No external cutout request before customer consent');
    const originalTransparentPhoto = await page.getByAltText('Uploaded photo 1').getAttribute('src');
    const originalOpaquePhoto = await page.getByAltText('Uploaded photo 2').getAttribute('src');
    assert.equal(await page.locator('[data-gdp-remove-photos="true"]').count(), 1, 'Only one clear removal button should appear after upload');
    assert.equal(await page.locator('[data-gdp-removal-help="true"]').evaluate((el) => el.open), false, 'Help must stay collapsed after upload');
    await page.locator('[data-gdp-removal-help="true"] summary').click();
    await page.locator('[data-gdp-check-removal="true"]').click();
    await page.locator('[data-gdp-removal-connection="READY"]').waitFor({ timeout: 10000 });
    assert.equal(cutoutPosts, 0, 'Connection status must not upload or process photos');
    await page.locator('[data-gdp-removal-help="true"] summary').click();
    await page.locator('[data-gdp-remove-photos="true"]').click();
    await page.locator('[data-gdp-photo-status="transparent"]').waitFor({ timeout: 15000 });
    // Other queued opaque photos may start immediately after alpha detection.
    // Exact no-spend behavior is proven by the unchanged first source URL,
    // skipped status and only two POSTs (success then quota-limit).
    try {
      await page.getByRole('alert').filter({ hasText: /free allowance is too low/ }).waitFor({ timeout: 20000 });
    } catch (error) {
      const alerts = await page.getByRole('alert').allTextContents();
      throw new Error('Expected quota fallback after mock binary cutout. POSTs=' + cutoutPosts +
        ', alerts=' + JSON.stringify(alerts) + ', page errors=' + JSON.stringify(errors) +
        ', timeout=' + (error?.message || 'unknown'));
    }
    assert.equal(cutoutPosts, 2, 'Quota response must stop additional automatic requests');
    assert.ok(await page.locator('[data-gdp-photo-status="failed"]').count() >= 1, 'Original must be kept after quota error');
    assert.equal(await page.locator('[data-gdp-auto-remove-status="on"]').count(), 0, 'Quota failure must disable automatic processing');
    assert.equal(await page.locator('[data-gdp-remove-photos="true"]').count(), 0, 'Quota failure must not show a retry button that could consume credits');
    assert.equal(await page.getByAltText('Uploaded photo 1').getAttribute('src'), originalTransparentPhoto, 'Already-transparent photo must remain unchanged');
    assert.notEqual(await page.getByAltText('Uploaded photo 2').getAttribute('src'), originalOpaquePhoto, 'First opaque photo must receive the mock cutout');
    assert.equal(await page.getByRole('link', { name: /Open remove.bg \(external\)/ }).getAttribute('href'), 'https://www.remove.bg/');
    overflowAfterPhotos = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflowAfterPhotos <= 4, 'Quota fallback must not expose white right-side panel: ' + overflowAfterPhotos);
    assert.deepEqual(uploads, [], 'Previewing must not upload customer photos to storage');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 4, 'Quick Design viewport should not overflow horizontally: ' + overflow);
    assert.deepEqual(errors, [], 'No uncaught client errors');
    console.log('PASS Phase C six STORM-style garment mockups, Front/Back selection and guarded remove.bg on ' + viewport.width + 'px viewport');
    await page.close();
  }
} finally {
  await browser.close();
}
