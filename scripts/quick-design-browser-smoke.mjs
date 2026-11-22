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

    await page.locator('input[aria-label="Upload customer photos"]').setInputFiles(
      Array.from({ length: 5 }, (_, i) => ({
        name: 'test-photo-' + (i + 1) + '.png', mimeType: 'image/png', buffer: pixel,
      }))
    );
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

    // Reproduce the Android recording's failed CDN import, with a long URL
    // originating from the browser module loader. The app must remain in
    // bounds and fall back to original photos without uploading to remove.bg.
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
    await page.getByRole('checkbox', { name: /Automatic background removal/i }).check();
    await page.getByRole('alert').filter({ hasText: /Automatic cutout is unavailable/ }).waitFor({ timeout: 20000 });
    assert.equal(await page.getByRole('checkbox', { name: /Automatic background removal/i }).isChecked(), false, 'On-device model error must turn off failing automatic cutout');
    assert.equal(await page.getByRole('link', { name: /Open remove.bg \(external\)/ }).getAttribute('href'), 'https://www.remove.bg/');
    overflowAfterPhotos = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflowAfterPhotos <= 4, 'Cutout error must not expose white right-side panel: ' + overflowAfterPhotos);
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
