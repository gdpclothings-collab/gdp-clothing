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

    // Garment → Color → Front/Back: all three MUST be explicit; upload gated.
    assert.equal(await page.locator('[data-gdp-garment-first="true"]').count(), 1);
    assert.equal(await page.locator('[data-gdp-preview-gated="true"]').count(), 1);
    assert.equal(await page.locator('[data-gdp-garment-image="true"]').count(), 0);
    const uploader = page.locator('input[aria-label="Upload customer photos"]');
    assert.equal(await uploader.isDisabled(), true, 'All choices are required before uploading');
    assert.equal(await page.locator('[data-gdp-color-selector="true"]').count(), 0,
      'Choose garment before showing colors');
    assert.equal(await page.getByRole('button', { name: 'Print on Front' }).count(), 0,
      'Choose garment and color before showing print side');

    await page.getByRole('button', { name: 'Choose T-shirt' }).click();
    assert.equal(await page.locator('[data-gdp-color-selector="true"]').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Print on Front' }).count(), 0);
    assert.equal(await uploader.isDisabled(), true);
    await page.getByRole('button', { name: 'Choose Black garment color' }).click();
    assert.equal(await page.getByRole('button', { name: 'Print on Front' }).count(), 1);
    assert.equal(await uploader.isDisabled(), true, 'Color alone does not unlock upload');
    await page.getByRole('button', { name: 'Print on Front' }).click();
    await page.locator('[data-gdp-garment-choice="true"]').waitFor();
    assert.match(await page.locator('[data-gdp-garment-choice="true"]').innerText(), /Black.*T-shirt.*Front/);
    assert.equal(await uploader.isEnabled(), true, 'Garment + color + side unlock uploads');

    // Background-removal instructions remain in collapsed optional help.
    assert.equal(await page.locator('[data-gdp-removal-help="true"]').evaluate((el) => el.open), false);
    assert.equal(await page.getByRole('checkbox', { name: /Automatic background removal/i }).count(), 0);
    await page.getByRole('textbox', { name: 'Main name or heading' }).fill('HENRY');
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
    // Only the selected combination gets a rendered mockup. Changing garment
    // resets color+side, and changing color resets the side. Verify that WHITE
    // changes actual garment pixels, not merely the label or metadata.
    const garmentImage = page.locator('[data-gdp-garment-image="true"]');
    await garmentImage.waitFor({ timeout: 45000 });
    const blackShirtFront = await garmentImage.getAttribute('src');
    assert.ok(blackShirtFront?.startsWith('data:image/jpeg;base64,'));
    assert.equal(await page.locator('[data-gdp-mockup-gallery]').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Print on Front' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Print on Back' }).getAttribute('aria-pressed'), 'false');

    const brightnessAtHem = async () => garmentImage.evaluate(async (el) => {
      await el.decode();
      const canvas = document.createElement('canvas');
      canvas.width = el.naturalWidth;
      canvas.height = el.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(el, 0, 0);
      return [...ctx.getImageData(300, 600, 1, 1).data].slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    });
    const blackBrightness = await brightnessAtHem();

    await page.getByRole('button', { name: 'Choose White garment color' }).click();
    assert.equal(await uploader.isDisabled(), true, 'Changing garment color resets selected print side');
    assert.equal(await page.locator('[data-gdp-preview-gated="true"]').count(), 1);
    assert.equal(await garmentImage.count(), 0, 'A stale black preview must be hidden');
    assert.equal(await page.getByRole('button', { name: 'Print on Front' }).getAttribute('aria-pressed'), 'false');
    await page.getByRole('button', { name: 'Print on Front' }).click();
    assert.equal(await uploader.isEnabled(), true);
    await garmentImage.waitFor({ timeout: 30000 });
    const whiteShirtFront = await garmentImage.getAttribute('src');
    assert.ok(whiteShirtFront?.startsWith('data:image/jpeg;base64,'));
    assert.notEqual(blackShirtFront, whiteShirtFront, 'Changing color must rerender mockup');
    const whiteBrightness = await brightnessAtHem();
    assert.ok(whiteBrightness > blackBrightness + 80,
      'White garment must look materially lighter than black: black=' + blackBrightness + ' white=' + whiteBrightness);
    assert.match(await page.locator('[data-gdp-preview-label="true"]').innerText(), /White.*T-shirt.*Front/);
    await page.getByRole('button', { name: 'Print on Back' }).click();
    await page.waitForFunction((src) => {
      const im = document.querySelector('[data-gdp-garment-image="true"]');
      return im && im.getAttribute('src') !== src && im.getAttribute('src')?.startsWith('data:image/jpeg;base64,');
    }, whiteShirtFront, { timeout: 20000 });
    const whiteShirtBack = await garmentImage.getAttribute('src');
    assert.notEqual(whiteShirtFront, whiteShirtBack, 'Front and back must stay visually distinct');
    assert.match(await page.locator('[data-gdp-preview-label="true"]').innerText(), /White.*T-shirt.*Back/);

    await page.getByRole('button', { name: 'Choose Sweatshirt' }).click();
    assert.equal(await page.getByRole('button', { name: 'Print on Front' }).count(), 0,
      'Changing garment clears color selection and hides side choices');
    assert.equal(await uploader.isDisabled(), true);
    assert.equal(await garmentImage.count(), 0);
    await page.getByRole('button', { name: 'Choose Black garment color' }).click();
    await page.getByRole('button', { name: 'Print on Front' }).click();
    await garmentImage.waitFor({ timeout: 30000 });
    const blackSweatshirtFront = await garmentImage.getAttribute('src');
    assert.ok(blackSweatshirtFront?.startsWith('data:image/jpeg;base64,'));
    assert.notEqual(blackShirtFront, blackSweatshirtFront, 'Sweatshirt must differ from T-shirt');
    await page.getByRole('button', { name: 'Choose White garment color' }).click();
    await page.getByRole('button', { name: 'Print on Back' }).click();
    await garmentImage.waitFor({ timeout: 30000 });
    const whiteSweatshirtBack = await garmentImage.getAttribute('src');
    assert.ok(whiteSweatshirtBack?.startsWith('data:image/jpeg;base64,'));
    assert.notEqual(blackSweatshirtFront, whiteSweatshirtBack);

    await page.getByRole('button', { name: 'Choose Hoodie' }).click();
    assert.equal(await uploader.isDisabled(), true);
    await page.getByRole('button', { name: 'Choose Black garment color' }).click();
    await page.getByRole('button', { name: 'Print on Back' }).click();
    await garmentImage.waitFor({ timeout: 30000 });
    const blackHoodieBack = await garmentImage.getAttribute('src');
    assert.ok(blackHoodieBack?.startsWith('data:image/jpeg;base64,'));
    await page.getByRole('button', { name: 'Choose White garment color' }).click();
    await page.getByRole('button', { name: 'Print on Front' }).click();
    await garmentImage.waitFor({ timeout: 30000 });
    const whiteHoodieFront = await garmentImage.getAttribute('src');
    assert.ok(whiteHoodieFront?.startsWith('data:image/jpeg;base64,'));
    assert.notEqual(blackHoodieBack, whiteHoodieFront);
    assert.match(await page.locator('[data-gdp-preview-label="true"]').innerText(), /White.*Hoodie.*Front/);
    assert.equal(await page.getByRole('button', { name: 'Print on Front' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Print on Back' }).getAttribute('aria-pressed'), 'false');
    const subtitle = page.getByRole('textbox', { name: /Subtitle/i });
    assert.equal(await subtitle.inputValue(), '');
    await page.locator('[data-gdp-help-trigger="request"]').click();
    await page.getByRole('dialog', { name: 'Need help with your design?' }).waitFor();
    await page.getByRole('button', { name: 'Close design help' }).click();
    assert.equal(await page.getByRole('button', { name: 'Choose Hoodie' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Choose White garment color' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Print on Front' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('combobox', { name: 'Premium text style' }).inputValue(), 'silver-chrome');
    assert.equal(await page.getByRole('button', { name: 'Save mockup' }).count(), 1,
      'Selected garment and color must have exactly one downloadable mockup');

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
    console.log('PASS garment → black/white color → front/back single mockup and guarded remove.bg on ' + viewport.width + 'px viewport');
    await page.close();
  }
} finally {
  await browser.close();
}
