import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Only run against the built app on localhost. Fixtures live in isolated browser
// storage, use inline SVGs, and never invoke an upload, checkout, or payment.
const BASE = new URL(process.env.CART_BROWSER_QA_BASE_URL || 'http://127.0.0.1:4173');
if (!['localhost', '127.0.0.1'].includes(BASE.hostname)) {
  throw new Error('Cart browser regression guard only permits a localhost preview.');
}

const names = ['Seasonal', 'Photo Bootleg', 'Memorial Tribute', 'Upload Artwork'];
const svg = (label, color) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="${color}"/><text x="15" y="40" font-size="22" fill="white">${label}</text></svg>`
)}`;
function fixtureItem(name, slug) {
  const customDesignId = `browser-qa-${slug}`;
  const front = svg(`${name} front`, '#175b9e');
  const back = svg(`${name} back`, '#a52749');
  return {
    key: `custom_${customDesignId}_M_Black_`, customDesignId, productId: `qa-${slug}`,
    name: `QA ${name}`, isCustom: true, placement: 'front_back', quantity: 1,
    size: 'M', color: 'Black', price: 20, image: front,
    customerMockups: { front: { url: front }, back: { url: back } },
    productionFiles: {
      front: { path: `locked/${slug}/front-300dpi.png`, dpi: 300 },
      back: { path: `locked/${slug}/back-300dpi.png`, dpi: 300 },
    },
  };
}
const items = names.map((name, index) => fixtureItem(name, String(index)));
const saved = fixtureItem('Saved Tribute', 'saved');
const legacy = { ...fixtureItem('Legacy', 'legacy'), customerMockups: undefined };
const backOnly = { ...fixtureItem('Back Only', 'back'), placement: 'back', image: svg('Back only', '#35684b'), customerMockups: undefined };
const sourceItems = [...items, legacy, backOnly];
const storageKey = 'gdp_cart_v2__guest';

async function probe(browser, name, viewport) {
  const context = await browser.newContext({ viewport, locale: 'en-CA', timezoneId: 'America/Regina' });
  try {
    await context.addInitScript(({ cart, savedCart, storageKey: key }) => {
      if (sessionStorage.getItem('gdp-cart-qa-seeded') !== '1') {
        localStorage.setItem(key, JSON.stringify(cart));
        localStorage.setItem('gdp_saved_v2__guest', JSON.stringify(savedCart));
        sessionStorage.setItem('gdp-cart-qa-seeded', '1');
      }
    }, { cart: sourceItems, savedCart: [saved], storageKey });

    // Prevent any calls to live Supabase, analytics, or external services.
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.origin === BASE.origin ? route.continue() : route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    await page.goto(new URL('/cart', BASE).toString(), { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'YOUR CART' }).waitFor({ timeout: 25000 });

    for (const fixture of items) {
      const article = page.locator('article').filter({ has: page.getByRole('heading', { name: fixture.name }) });
      await article.waitFor();
      const preview = article.locator('[data-gdp-cart-preview-side]');
      assert.equal(await preview.getAttribute('data-gdp-cart-preview-side'), 'front');
      const backButton = article.getByRole('button', { name: 'View back design' });
      const frontButton = article.getByRole('button', { name: 'View front design' });
      assert.equal(await frontButton.getAttribute('aria-pressed'), 'true');
      const bounds = await backButton.boundingBox();
      assert(bounds && bounds.height >= 48, `${name}: back selector is smaller than a 48px touch target`);
      assert(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width, `${name}: selector overflows viewport`);
      await backButton.click();
      assert.equal(await preview.getAttribute('data-gdp-cart-preview-side'), 'back');
      assert.equal(await backButton.getAttribute('aria-pressed'), 'true');
      assert.equal(await preview.locator('img').getAttribute('src'), fixture.customerMockups.back.url);
      await frontButton.click();
      assert.equal(await preview.locator('img').getAttribute('src'), fixture.customerMockups.front.url);
    }

    const first = page.locator('article').filter({ has: page.getByRole('heading', { name: items[0].name }) });
    const zoom = first.getByRole('button', { name: 'Zoom garment preview in' });
    assert.equal(await zoom.isVisible(), viewport.width < 640, `${name}: zoom responsive breakpoint mismatch`);
    if (viewport.width < 640) {
      await zoom.click();
      assert.match(await first.locator('[data-gdp-cart-preview-side] img').getAttribute('style'), /scale\(1\.1\)/);
      await first.getByRole('button', { name: 'View back design' }).click();
      assert.match(await first.locator('[data-gdp-cart-preview-side] img').getAttribute('style'), /scale\(1\)/);
    }

    const legacyArticle = page.locator('article').filter({ has: page.getByRole('heading', { name: legacy.name }) });
    assert.equal(await legacyArticle.getByRole('button', { name: 'View back design' }).count(), 0);
    assert.match(await legacyArticle.innerText(), /Only one garment mockup is available/);
    const backArticle = page.locator('article').filter({ has: page.getByRole('heading', { name: backOnly.name }) });
    assert.equal(await backArticle.locator('[data-gdp-cart-preview-side]').getAttribute('data-gdp-cart-preview-side'), 'back');

    const sourceFiles = JSON.stringify(items.map((item) => item.productionFiles));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: items[0].name }).waitFor({ timeout: 25000 });
    const reloaded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), storageKey);
    assert.equal(reloaded.length, sourceItems.length);
    assert.equal(JSON.stringify(reloaded.slice(0, items.length).map((item) => item.productionFiles)), sourceFiles);
    assert.equal(await page.locator('article').filter({ has: page.getByRole('heading', { name: items[0].name }) }).getByRole('button', { name: 'View back design' }).count(), 1);

    await page.getByRole('button', { name: 'Move to cart' }).click();
    const savedArticle = page.locator('article').filter({ has: page.getByRole('heading', { name: saved.name }) });
    await savedArticle.waitFor();
    await savedArticle.getByRole('button', { name: 'View back design' }).click();
    assert.equal(await savedArticle.locator('[data-gdp-cart-preview-side]').getAttribute('data-gdp-cart-preview-side'), 'back');
    console.log(`PASS cart-front-back-${name}: 4 design routes, reload, saved item, legacy, back-only, responsive selector`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await probe(browser, 'mobile', { width: 390, height: 844 });
  await probe(browser, 'desktop', { width: 1366, height: 900 });
} finally {
  await browser.close();
}
