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
    assert.match(await page.locator('h1').innerText(), /2 free bootleg samples/i);
    // Help is contextual and free; no persistent chat widget or paid API.
    await page.locator('[data-gdp-help-trigger="header"]').click();
    const help = page.getByRole('dialog', { name: 'Need help with your design?' });
    await help.waitFor({ timeout: 10000 });
    assert.ok(await help.getByText('How do I make my two free samples?').count() > 0);
    assert.equal(await help.getByRole('link', { name: /Contact GDP/i }).getAttribute('href'), 'https://gdpclothing.ca/pages/contact');
    await page.keyboard.press('Escape');
    assert.equal(await help.count(), 0, 'Escape must close help without changing design');

    // CI tests the zero-fee canvas pathway, not a large external ONNX download.
    await page.getByRole('checkbox', { name: /Automatic background removal/i }).uncheck();
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
    const artworkA = page.getByAltText('Watermarked sample A artwork');
    const artworkB = page.getByAltText('Watermarked sample B artwork');
    await artworkA.waitFor({ timeout: 30000 });
    await artworkB.waitFor({ timeout: 30000 });
    const srcA = await artworkA.getAttribute('src');
    const srcB = await artworkB.getAttribute('src');
    assert.ok(srcA?.startsWith('data:image/jpeg;base64,'), 'Sample A must be locally rendered');
    assert.ok(srcB?.startsWith('data:image/jpeg;base64,'), 'Sample B must be locally rendered');
    assert.notEqual(srcA, srcB, 'Sample A and B must use genuinely different compositions');
    const artworkSize = await page.evaluate(async () => {
      const img = document.querySelector('img[alt="Watermarked sample A artwork"]');
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    });
    assert.deepEqual(artworkSize, [750, 1000], 'Preview output must be a 12x16 ratio');
    const subtitle = page.getByRole('textbox', { name: /Subtitle/i });
    assert.equal(await subtitle.inputValue(), '', 'No hidden CUSTOM BOOTLEG subtitle should appear');

    await page.getByRole('button', { name: 'Choose Sample B', exact: true }).click();
    // Every one of the three garment types and both sides is rendered, not
    // just a relabelled version of the same black T-shirt.
    const garmentImage = page.locator('[data-gdp-garment-image="true"]');
    const waitForNewGarment = async (previousSrc) => {
      await page.waitForFunction(
        (prior) => {
          const image = document.querySelector('[data-gdp-garment-image="true"]');
          return Boolean(image && image.getAttribute('src')?.startsWith('data:image/jpeg;base64,') && image.getAttribute('src') !== prior);
        },
        previousSrc,
        { timeout: 15000 }
      );
    };
    await page.getByAltText('Sample B on illustrative black T-shirt front view').waitFor({ timeout: 10000 });
    const tshirtFront = await garmentImage.getAttribute('src');
    await page.getByRole('button', { name: 'Show Back view' }).click();
    await waitForNewGarment(tshirtFront);
    await page.getByAltText('Sample B on illustrative black T-shirt back view').waitFor({ timeout: 10000 });
    const tshirtBack = await garmentImage.getAttribute('src');
    assert.notEqual(tshirtFront, tshirtBack, 'T-shirt sides must differ');
    await page.getByRole('button', { name: 'Preview Sweatshirt' }).click();
    await waitForNewGarment(tshirtBack);
    await page.getByAltText('Sample B on illustrative black Sweatshirt back view').waitFor({ timeout: 10000 });
    const crewneckBack = await garmentImage.getAttribute('src');
    await page.getByRole('button', { name: 'Show Front view' }).click();
    await waitForNewGarment(crewneckBack);
    await page.getByAltText('Sample B on illustrative black Sweatshirt front view').waitFor({ timeout: 10000 });
    const crewneckFront = await garmentImage.getAttribute('src');
    assert.notEqual(crewneckFront, crewneckBack, 'Sweatshirt sides must differ');
    await page.getByRole('button', { name: 'Show Back view' }).click();
    await waitForNewGarment(crewneckFront);
    await page.getByAltText('Sample B on illustrative black Sweatshirt back view').waitFor({ timeout: 10000 });
    assert.ok(crewneckBack?.startsWith('data:image/jpeg;base64,'), 'Sweatshirt back preview renders locally');
    await page.getByRole('button', { name: 'Preview Hoodie' }).click();
    await waitForNewGarment(crewneckBack);
    await page.getByAltText('Sample B on illustrative black Hoodie back view').waitFor({ timeout: 10000 });
    const hoodieBack = await garmentImage.getAttribute('src');
    assert.notEqual(crewneckBack, hoodieBack, 'Sweatshirt and hoodie must show different garment silhouettes');
    await page.getByRole('button', { name: 'Show Front view' }).click();
    await waitForNewGarment(hoodieBack);
    await page.getByAltText('Sample B on illustrative black Hoodie front view').waitFor({ timeout: 10000 });
    const hoodieFront = await garmentImage.getAttribute('src');
    assert.notEqual(hoodieFront, hoodieBack, 'Front and back hoodie views must be different');
    assert.equal(await page.getByRole('button', { name: 'Choose Sample B', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.locator('[data-gdp-help-trigger="request"]').click();
    await page.getByRole('dialog', { name: 'Need help with your design?' }).waitFor();
    await page.getByRole('button', { name: 'Close design help' }).click();
    assert.equal(await page.getByRole('button', { name: 'Preview Hoodie' }).getAttribute('aria-pressed'), 'true', 'Help must preserve garment');
    assert.equal(await page.getByRole('button', { name: 'Show Front view' }).getAttribute('aria-pressed'), 'true', 'Help must preserve print side');
    assert.equal(await page.getByRole('combobox', { name: 'Premium text style' }).inputValue(), 'silver-chrome', 'Help must preserve premium text style');
    assert.equal(await page.getByRole('button', { name: 'Choose Sample B', exact: true }).getAttribute('aria-pressed'), 'true', 'Opening Help must preserve the chosen sample');

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
    const offNotice = page.getByText('Background removal is OFF. Your photos are still original.');
    assert.ok(await offNotice.isVisible(), 'Uploading photos alone must clearly explain that removal is OFF');
    await page.locator('[data-gdp-check-removal="true"]').click();
    await page.locator('[data-gdp-removal-connection="READY"]').waitFor({ timeout: 10000 });
    assert.equal(cutoutPosts, 0, 'Connection status must not upload or process photos');
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
    assert.equal(await page.getByRole('checkbox', { name: /Automatic background removal/i }).isChecked(), false, 'Quota failure must disable automatic processing');
    assert.equal(await page.getByAltText('Uploaded photo 1').getAttribute('src'), originalTransparentPhoto, 'Already-transparent photo must remain unchanged');
    assert.notEqual(await page.getByAltText('Uploaded photo 2').getAttribute('src'), originalOpaquePhoto, 'First opaque photo must receive the mock cutout');
    assert.equal(await page.getByRole('link', { name: /Open remove.bg \(external\)/ }).getAttribute('href'), 'https://www.remove.bg/');
    overflowAfterPhotos = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflowAfterPhotos <= 4, 'Quota fallback must not expose white right-side panel: ' + overflowAfterPhotos);
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
