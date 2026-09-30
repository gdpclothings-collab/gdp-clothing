import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

// Production wiring canary.
// Safety boundary: product/cart interactions are browser-local only. Any write-like
// request to checkout/orders/inventory/payment endpoints is blocked before it leaves
// the browser. The script validates checkout Step 1 and never starts payment or submits an order.

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const VIEWPORT = { width: 1440, height: 1000 };
const MAX_PRODUCTS_TO_TRY = 12;

const report = {
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  status: "running",
  checks: [],
  warnings: [],
  blockedMutations: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function record(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    report.checks.push({ name, status: "passed", durationMs: Date.now() - startedAt, details: details || null });
    console.log(`PASS ${name}`);
    return details;
  } catch (error) {
    report.checks.push({
      name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: error?.message || String(error),
    });
    console.error(`FAIL ${name}: ${error?.message || error}`);
    throw error;
  }
}

async function navigate(page, route) {
  const target = new URL(route, BASE_URL).toString();
  const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert(response, `No document response received for ${target}`);
  assert(response.status() < 400, `${target} returned HTTP ${response.status()}`);
  await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(700);
  return response;
}

async function discoverProductCards(page, route) {
  await navigate(page, route);
  const cards = await page.locator('a[href^="/product/"], a[href^="/products/"]').evaluateAll((links) => links.map((link) => {
    const article = link.closest("article");
    return {
      href: link.getAttribute("href") || "",
      name: (article?.querySelector("h3")?.textContent || "").replace(/\s+/g, " ").trim(),
    };
  }));
  const byHref = new Map();
  for (const card of cards) {
    if (card.href && !byHref.has(card.href)) byHref.set(card.href, card);
  }
  return [...byHref.values()];
}

async function selectPurchasableVariant(page) {
  const customize = page.getByRole("button", { name: /Customize this product/i }).first();
  if (await customize.isVisible().catch(() => false)) return { status: "custom-product" };

  const colourLabel = page.getByText("Colour", { exact: true }).first();
  const sizeLabel = page.getByText("Size", { exact: true }).first();
  if (!(await colourLabel.isVisible().catch(() => false)) || !(await sizeLabel.isVisible().catch(() => false))) {
    return { status: "missing-variant-controls" };
  }

  const colourButtons = colourLabel.locator("xpath=../..").locator("button");
  const sizeButtons = sizeLabel.locator("xpath=../..").locator("button");
  const colourCount = Math.min(await colourButtons.count(), 8);

  for (let colourIndex = 0; colourIndex < colourCount; colourIndex += 1) {
    const colourButton = colourButtons.nth(colourIndex);
    if (!(await colourButton.isEnabled().catch(() => false))) continue;
    await colourButton.click();

    const sizeCount = Math.min(await sizeButtons.count(), 12);
    for (let sizeIndex = 0; sizeIndex < sizeCount; sizeIndex += 1) {
      const sizeButton = sizeButtons.nth(sizeIndex);
      if (!(await sizeButton.isEnabled().catch(() => false))) continue;
      await sizeButton.click();

      const addButton = page.getByRole("button", { name: /^Add to bag$/i }).first();
      if ((await addButton.count()) > 0 && await addButton.isEnabled().catch(() => false)) {
        const colour = normalizeText(await colourButton.innerText());
        const size = normalizeText(await sizeButton.innerText());
        return { status: "purchasable", colour, size, addButton };
      }
    }
  }

  return { status: "no-purchasable-variant" };
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });

  await context.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();
    const writeMethod = !["GET", "HEAD", "OPTIONS"].includes(method);
    const protectedTarget =
      /\/functions\/v1\/checkout(?:\?|$|\/)/i.test(url) ||
      /\/rest\/v1\/(orders|order_items|inventory|inventory_reservations|payments)(?:\?|$|\/)/i.test(url);

    if (writeMethod && protectedTarget) {
      report.blockedMutations.push({ method, url });
      return route.abort("blockedbyclient");
    }

    return route.continue();
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const pageErrors = [];
  const serverFailures = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    try {
      const url = new URL(response.url());
      if (url.origin === new URL(BASE_URL).origin && response.status() >= 500) {
        serverFailures.push(`${response.status()} ${url.pathname}`);
      }
    } catch {
      // Ignore unparsable URLs.
    }
  });

  try {
    const storefrontLinks = await record("storefront exposes live product links", async () => {
      let sourceRoute = "/";
      let cards = await discoverProductCards(page, sourceRoute);
      if (cards.length === 0) {
        sourceRoute = "/shop";
        cards = await discoverProductCards(page, sourceRoute);
      }
      assert(cards.length > 0, "Neither Home nor Shop exposes published product links to verify.");
      return {
        sourceRoute,
        productLinks: cards.map((card) => card.href).slice(0, 12),
        productNames: unique(cards.map((card) => card.name.toLowerCase())).slice(0, 12),
      };
    });

    const shopLinks = await record("discovered products overlap the published shop catalog", async () => {
      const cards = await discoverProductCards(page, "/shop");
      assert(cards.length > 0, "Shop has no published product links.");
      const shopNames = new Set(cards.map((card) => card.name.toLowerCase()).filter(Boolean));
      const overlap = storefrontLinks.productNames.filter((name) => shopNames.has(name));
      assert(overlap.length > 0, "Discovered storefront products are not connected to the published Shop catalog.");
      return {
        shopProductCount: cards.length,
        overlap: overlap.slice(0, 12),
        links: cards.map((card) => card.href),
      };
    });

    await record("discovered product resolves to matching product detail", async () => {
      await navigate(page, storefrontLinks.sourceRoute || "/shop");
      const href = storefrontLinks.productLinks[0];
      const cardLink = page.locator(`a[href="${href}"]`).first();
      assert(await cardLink.count(), `Product link ${href} disappeared from ${storefrontLinks.sourceRoute || "/shop"}.`);
      const article = cardLink.locator("xpath=ancestor::article[1]");
      const storefrontName = normalizeText(await article.locator("h3").first().innerText().catch(() => ""));
      await cardLink.click();
      await page.waitForURL((url) => url.pathname === href, { timeout: 15000 });
      const detailName = normalizeText(await page.locator("h1").first().innerText());
      assert(detailName.length > 0, "Product detail title is empty.");
      if (storefrontName) {
        assert(storefrontName.toLowerCase() === detailName.toLowerCase(), `Storefront product name \"${storefrontName}\" does not match detail title \"${detailName}\".`);
      }
      return { href, sourceRoute: storefrontLinks.sourceRoute, storefrontName: storefrontName || null, detailName };
    });

    await record("sellable product wires through variant selection to cart", async () => {
      const candidates = unique([...storefrontLinks.productLinks, ...shopLinks.links]).slice(0, MAX_PRODUCTS_TO_TRY);
      let selected = null;

      for (const href of candidates) {
        await navigate(page, href);
        const title = normalizeText(await page.locator("h1").first().innerText().catch(() => ""));
        if (!title || /product not found/i.test(title)) continue;

        const variant = await selectPurchasableVariant(page);
        if (variant.status !== "purchasable") continue;

        selected = { href, title, colour: variant.colour, size: variant.size };
        await variant.addButton.click();
        await page.waitForURL((url) => url.pathname === "/cart", { timeout: 15000 });
        await page.getByRole("heading", { name: /^YOUR CART$/i }).waitFor();
        assert((await page.getByRole("heading", { name: title, exact: true }).count()) > 0, `Cart did not preserve product name ${title}.`);
        assert((await page.getByRole("button", { name: /Secure checkout/i }).count()) > 0, "Cart checkout CTA is missing.");
        break;
      }

      if (!selected) {
        report.warnings.push("No currently sellable ready-to-wear product was available for a real Product → Cart click-through. This is allowed when all candidates are custom-only or out of stock.");
        return { status: "skipped-no-sellable-readywear" };
      }

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "wiring-cart.png"), fullPage: true });
      return selected;
    });

    await record("cart reaches checkout Step 1 without starting a transaction", async () => {
      if (new URL(page.url()).pathname !== "/cart") {
        await page.addInitScript(() => {
          window.localStorage.setItem("gdp_cart_v2__guest", JSON.stringify([
            {
              productId: "wiring-fallback-product",
              variantId: "wiring-fallback-variant",
              key: "wiring-fallback-item",
              name: "GDP Wiring Canary",
              price: 1,
              quantity: 1,
              size: "M",
              color: "Black",
              image: "/images/gdp-tshirt.svg",
            },
          ]));
        });
        await navigate(page, "/cart");
      }

      const checkoutButton = page.getByRole("button", { name: /Secure checkout/i }).first();
      assert((await checkoutButton.count()) > 0, "Secure checkout button is missing from cart.");
      await checkoutButton.click();
      await page.waitForURL((url) => url.pathname === "/checkout", { timeout: 15000 });
      await page.getByRole("heading", { name: /^CHECKOUT$/i }).waitFor();
      assert(await page.locator("#checkout-email").isVisible(), "Checkout email field is missing.");
      assert((await page.getByText(/Step 1 of 2 · Information & delivery/i).count()) > 0, "Checkout did not open on Information & delivery Step 1.");
      assert((await page.getByRole("button", { name: /Continue to payment/i }).count()) > 0, "Continue to payment button is missing from checkout Step 1.");
      assert((await page.getByText(/Secure payment fields are provided by Stripe/i).count()) > 0, "Stripe secure-payment notice is missing from checkout Step 1.");
      assert(new URL(page.url()).pathname === "/checkout", "Checkout canary unexpectedly advanced beyond Step 1.");
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "wiring-checkout.png"), fullPage: true });
      return { submittedOrder: false, startedPayment: false, step: 1 };
    });

    assert(pageErrors.length === 0, `Uncaught browser errors: ${pageErrors.join(" | ")}`);
    assert(serverFailures.length === 0, `Production returned server errors: ${serverFailures.join(" | ")}`);

    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error?.message || String(error);
    report.pageErrors = pageErrors;
    report.serverFailures = serverFailures;
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "wiring-FAILED.png"), fullPage: true });
    } catch {
      // Best-effort evidence.
    }
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }

  await fs.writeFile(path.join(ARTIFACT_DIR, "wiring-report.json"), JSON.stringify(report, null, 2));

  const lines = [
    "# GDP Clothing Production Wiring Report",
    "",
    `Target: ${BASE_URL}`,
    `Status: ${report.status.toUpperCase()}`,
    "",
    ...report.checks.map((item) => `- ${item.status === "passed" ? "PASS" : "FAIL"} - ${item.name}${item.error ? `: ${item.error}` : ""}`),
    "",
    `Warnings: ${report.warnings.length}`,
    ...report.warnings.map((warning) => `- ${warning}`),
    "",
    `Blocked write attempts: ${report.blockedMutations.length}`,
    "Safety boundary: this canary never starts payment, confirms payment, or submits an order; write-like checkout/order/inventory/payment requests are blocked.",
  ];

  await fs.writeFile(path.join(ARTIFACT_DIR, "wiring-summary.md"), lines.join("\n"));
  console.log(`\n${lines.join("\n")}`);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(path.join(ARTIFACT_DIR, "wiring-fatal-error.txt"), error?.stack || error?.message || String(error));
  } catch {
    // Ignore artifact write failure after a fatal setup error.
  }
  process.exitCode = 1;
});
