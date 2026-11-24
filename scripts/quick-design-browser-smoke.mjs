import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
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
    const fontPreview = page.locator('[data-gdp-font-preview="true"]');
    await fontPreview.waitFor({ timeout: 15000 });
    const upPreview = await fontPreview.getAttribute('src');
    assert.equal(await page.locator('[data-gdp-font-curve="up"]').count(), 1);
    await page.getByRole('combobox', { name: 'Name layout' }).selectOption('down');
    await page.waitForFunction((previous) => {
      const img = document.querySelector('[data-gdp-font-curve="down"] [data-gdp-font-preview="true"]');
      return img?.getAttribute('src')?.startsWith('data:image/png') &&
        img.getAttribute('src') !== previous;
    }, upPreview, { timeout: 15000 });
    const downPreview = await fontPreview.getAttribute('src');
    await page.getByRole('combobox', { name: 'Name layout' }).selectOption('straight');
    await page.waitForFunction((previous) => {
      const img = document.querySelector('[data-gdp-font-curve="straight"] [data-gdp-font-preview="true"]');
      return img?.getAttribute('src')?.startsWith('data:image/png') &&
        img.getAttribute('src') !== previous;
    }, downPreview, { timeout: 15000 });
    await page.getByRole('combobox', { name: 'Name layout' }).selectOption('up');
    await fontPreview.waitFor({ timeout: 15000 });
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
    assert.equal(await page.locator('[data-gdp-main-photo="true"]').count(), 1, 'Exactly one main photo must be selected');
    assert.equal(await page.getByRole('button', { name: 'Make photo 5 main subject' }).count(), 1);
    let overflowAfterPhotos = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflowAfterPhotos <= 4, 'Five photos must not expose white right-side panel: ' + overflowAfterPhotos);
    // Only the selected combination gets a rendered mockup. Changing garment
    // resets color+side, and changing color resets the side. Verify that WHITE
    // changes actual garment pixels, not merely the label or metadata.
    const garmentImage = page.locator('[data-gdp-garment-image="true"]');
    await garmentImage.waitFor({ timeout: 45000 });
    const blackShirtFront = await garmentImage.getAttribute('src');
    assert.ok(blackShirtFront?.startsWith('data:image/jpeg;base64,'));
    // Phase G: prove the preview ACTUALLY uses the approved blank source,
    // rather than passing only because the fallback canvas renderer works.
    const atlasPixelParity = await garmentImage.evaluate(async (el) => {
      await el.decode();
      const atlas = new Image();
      atlas.src = '/images/quick-design/gdp-blank-garment-atlas.webp';
      await atlas.decode();
      const expected = document.createElement('canvas');
      expected.width = 600; expected.height = 720;
      const e = expected.getContext('2d', { willReadFrequently: true });
      e.drawImage(atlas, 0, 0, 256, 360, 65, 10, 470, 660);
      const canvas = document.createElement('canvas');
      canvas.width = el.naturalWidth; canvas.height = el.naturalHeight;
      const c = canvas.getContext('2d', { willReadFrequently: true });
      c.drawImage(el, 0, 0);
      // Near the upper-left unprinted background, outside garment and artwork.
      const ex = [...e.getImageData(77, 65, 1, 1).data].slice(0, 3);
      const got = [...c.getImageData(154, 130, 1, 1).data].slice(0, 3);
      return { width: atlas.naturalWidth, height: atlas.naturalHeight,
        maxDifference: Math.max(...ex.map((value, i) => Math.abs(value - got[i]))) };
    });
    assert.equal(atlasPixelParity.width, 1536);
    assert.equal(atlasPixelParity.height, 720);
    assert.ok(atlasPixelParity.maxDifference <= 22,
      'Image-backed mockup must paint the approved blank atlas rather than the old dark fallback: ' + JSON.stringify(atlasPixelParity));
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
    const sweatshirtFabricBrightness = () => garmentImage.evaluate(async (el) => {
      await el.decode();
      const sample = document.createElement('canvas');
      sample.width = el.naturalWidth;
      sample.height = el.naturalHeight;
      const ctx = sample.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(el, 0, 0);
      const pixel = ctx.getImageData(Math.round(el.naturalWidth * .5), Math.round(el.naturalHeight * .72), 1, 1).data;
      return (pixel[0] + pixel[1] + pixel[2]) / 3;
    });
    const darkCrewneckBrightness = await sweatshirtFabricBrightness();
    await page.getByRole('button', { name: 'Choose White garment color' }).click();
    await page.getByRole('button', { name: 'Print on Back' }).click();
    await garmentImage.waitFor({ timeout: 30000 });
    const whiteSweatshirtBack = await garmentImage.getAttribute('src');
    assert.ok(whiteSweatshirtBack?.startsWith('data:image/jpeg;base64,'));
    assert.notEqual(blackSweatshirtFront, whiteSweatshirtBack);
    const whiteCrewneckBrightness = await sweatshirtFabricBrightness();
    assert.ok(whiteCrewneckBrightness > darkCrewneckBrightness + 80,
      'Existing Custom Studio Black/White crewneck SVG must change actual fabric pixels: ' +
      darkCrewneckBrightness + ' → ' + whiteCrewneckBrightness);
    assert.ok(whiteCrewneckBrightness > 135, 'White crewneck fabric should render visibly white');

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

    // Phase I: a customer choosing XS must see a smaller print on the same
    // blank garment; selecting M should restore the prominent reference size.
    const garmentSize = page.getByRole('combobox', { name: /Garment size/i });
    const mediumMockup = await garmentImage.getAttribute('src');
    await garmentSize.selectOption('XS');
    await page.waitForFunction((previous) => {
      const im = document.querySelector('[data-gdp-garment-image="true"]');
      return im?.getAttribute('src')?.startsWith('data:image/jpeg;base64,') &&
        im.getAttribute('src') !== previous;
    }, mediumMockup, { timeout: 30000 });
    const xsMockup = await garmentImage.getAttribute('src');
    assert.notEqual(xsMockup, mediumMockup, 'XS print footprint must be smaller than medium');
    await garmentSize.selectOption('M');
    await page.waitForFunction((previous) => {
      const im = document.querySelector('[data-gdp-garment-image="true"]');
      return im?.getAttribute('src')?.startsWith('data:image/jpeg;base64,') &&
        im.getAttribute('src') !== previous;
    }, xsMockup, { timeout: 30000 });

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
    // A different first/main photo must become the hero without reuploading
    // or spending remove.bg credits.
    const priorFifthPhoto = await page.getByAltText('Uploaded photo 5').getAttribute('src');
    await page.getByRole('button', { name: 'Make photo 5 main subject' }).click();
    assert.equal(await page.locator('[data-gdp-main-photo="true"]').count(), 1);
    assert.equal(await page.getByAltText('Uploaded photo 1').getAttribute('src'), priorFifthPhoto);

    if (viewport.width === 1280) {
      // Exhaustively verify 3 × 2 × 2 selector paths without another
      // network request or an implied two-sided print.
      let combinations = 0;
      for (const type of ['T-shirt', 'Sweatshirt', 'Hoodie']) {
        await page.getByRole('button', { name: 'Choose ' + type }).click();
        for (const garmentColor of ['Black', 'White']) {
          await page.getByRole('button', { name: 'Choose ' + garmentColor + ' garment color' }).click();
          for (const side of ['Front', 'Back']) {
            const previousImage = await page.locator('[data-gdp-garment-image="true"]').evaluateAll((nodes) => nodes[0]?.getAttribute('src') || null);
            await page.getByRole('button', { name: 'Print on ' + side }).click();
            // The old mockup is deliberately cleared during async rendering.
            // Wait for the newly decoded, selected-side image instead of
            // checking a momentary loading state between React commits.
            await page.waitForFunction(({ type, garmentColor, side, previousImage }) => {
              const image = document.querySelector('[data-gdp-garment-image="true"]');
              const label = document.querySelector('[data-gdp-preview-label="true"]');
              return image?.complete && image.naturalWidth > 0 &&
                image.getAttribute('src')?.startsWith('data:image/jpeg;base64,') &&
                image.getAttribute('src') !== previousImage &&
                label?.textContent?.includes(type) &&
                label.textContent.includes(garmentColor) &&
                label.textContent.includes(side);
            }, { type, garmentColor, side, previousImage }, { timeout: 30000 });
            assert.equal(await page.locator('[data-gdp-garment-image="true"]').count(), 1);
            combinations += 1;
          }
          // Color change resets the selected side without hiding uploads.
        }
      }
      assert.equal(combinations, 12);
    }

    // Confirm the full composition survives 1–5 face-containing photos.
    for (let count = 5; count >= 1; count -= 1) {
      assert.equal(await page.locator('[data-gdp-photo-grid="true"] > div').count(), count);
      if (count > 1) {
        await page.getByRole('button', { name: 'Remove photo ' + count }).click();
      }
    }
    await page.locator('[data-gdp-garment-image="true"]').waitFor({ timeout: 30000 });
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
