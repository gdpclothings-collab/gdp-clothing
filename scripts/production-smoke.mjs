import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

// Safe production canary: no live payment, order creation, or customer artwork upload.

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

const results = [];
let productHref = "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function navigate(page, route) {
  const target = new URL(route, BASE_URL).toString();
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.goto(target, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      assert(response, "No document response received for " + target);
      assert(response.status() < 400, target + " returned HTTP " + response.status());
      await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(900);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(3000 * attempt);
    }
  }

  throw lastError;
}

async function runCheck(browser, name, viewport, check) {
  const context = await browser.newContext({
    viewport,
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const pageErrors = [];
  const serverFailures = [];
  const requestFailures = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    try {
      const url = new URL(response.url());
      if (url.origin === new URL(BASE_URL).origin && response.status() >= 500) {
        serverFailures.push(response.status() + " " + url.pathname);
      }
    } catch {
      // Ignore unparsable URLs.
    }
  });
  page.on("requestfailed", (request) => {
    try {
      const url = new URL(request.url());
      const failure = request.failure()?.errorText || "request failed";
      if (
        url.origin === new URL(BASE_URL).origin &&
        !failure.includes("ERR_ABORTED") &&
        !failure.includes("NS_BINDING_ABORTED")
      ) {
        requestFailures.push(failure + ": " + url.pathname);
      }
    } catch {
      // Ignore unparsable URLs.
    }
  });

  const startedAt = Date.now();

  try {
    await check(page);

    if (pageErrors.length) {
      throw new Error("Uncaught browser error: " + pageErrors.join(" | "));
    }
    if (serverFailures.length) {
      throw new Error("Production returned server errors: " + serverFailures.join(" | "));
    }

    const body = (await page.locator("body").innerText()).trim();
    assert(body.length > 20, "Page rendered too little content to be healthy.");

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, safeName(name) + ".png"),
      fullPage: true,
    });

    results.push({
      name,
      status: "passed",
      durationMs: Date.now() - startedAt,
      requestWarnings: [...new Set(requestFailures)].slice(0, 10),
    });
    console.log("PASS " + name);
  } catch (error) {
    try {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, safeName(name) + "-FAILED.png"),
        fullPage: true,
      });
    } catch {
      // Best-effort evidence capture.
    }

    results.push({
      name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: error?.message || String(error),
      pageErrors,
      serverFailures,
      requestFailures: [...new Set(requestFailures)].slice(0, 20),
      url: page.url(),
    });
    console.error("FAIL " + name + ": " + (error?.message || error));
  } finally {
    await context.close();
  }
}

async function assertNoHorizontalOverflow(page, viewport) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  if (metrics.scrollWidth > Math.max(metrics.clientWidth, viewport.width) + 3) {
    const offenders = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      return Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const className = typeof element.className === "string" ? element.className : "";
          const label = (element.getAttribute("aria-label") || element.textContent || "")
            .replace(/\\s+/g, " ")
            .trim()
            .slice(0, 50);
          return {
            tag: element.tagName.toLowerCase(),
            className: className.slice(0, 80),
            label,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((item) => item.width > 0 && (item.left < -3 || item.right > viewportWidth + 3))
        .sort((a, b) => Math.max(b.right - viewportWidth, -b.left) - Math.max(a.right - viewportWidth, -a.left))
        .slice(0, 5);
    });

    const details = offenders.length
      ? " Offenders: " + offenders.map((item) =>
          item.tag + "." + item.className + " [" + item.left + ".." + item.right + "] " + item.label
        ).join(" | ")
      : "";

    throw new Error(
      "Horizontal overflow detected: " + metrics.scrollWidth + "px content in " + metrics.clientWidth + "px viewport." + details
    );
  }
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    await runCheck(browser, "home desktop + security headers", DESKTOP, async (page) => {
      const response = await navigate(page, "/");
      const headers = response.headers();
      const requiredHeaders = [
        "strict-transport-security",
        "x-content-type-options",
        "x-frame-options",
        "referrer-policy",
        "permissions-policy",
        "content-security-policy",
      ];
      const missing = requiredHeaders.filter((header) => !headers[header]);
      assert(missing.length === 0, "Missing production security headers: " + missing.join(", "));

      const body = await page.locator("body").innerText();
      assert(/GDP|GOOD PEOPLE|DOPE CLOTHES/i.test(body), "GDP Clothing identity was not visible on the home page.");
    });

    await runCheck(browser, "home mobile layout", MOBILE, async (page) => {
      await navigate(page, "/");
      await assertNoHorizontalOverflow(page, MOBILE);
    });

    await runCheck(browser, "shop catalog + product discovery", DESKTOP, async (page) => {
      await navigate(page, "/shop");
      await page.getByRole("heading", { name: /SHOP ALL|BEST SELLERS|LATEST DROP|COLLECTIONS/i }).first().waitFor();
      const links = page.locator('a[href^="/product/"]');
      assert((await links.count()) > 0, "No published storefront products were discovered.");
      productHref = await links.first().getAttribute("href");
      assert(productHref, "First published product did not have a usable link.");
    });

    await runCheck(browser, "product detail + variant controls", DESKTOP, async (page) => {
      if (!productHref) {
        await navigate(page, "/shop");
        const links = page.locator('a[href^="/product/"]');
        assert((await links.count()) > 0, "No published product available for product-detail test.");
        productHref = await links.first().getAttribute("href");
      }

      await navigate(page, productHref);
      const title = page.locator("h1").first();
      await title.waitFor();
      assert((await title.innerText()).trim().length > 0, "Product title is empty.");

      const customCta = page.getByRole("button", { name: /Customize this product/i });
      const readyCta = page.getByRole("button", {
        name: /Choose colour \+ size|Add to bag|Sold out|Unavailable combination/i,
      });
      assert(
        (await customCta.count()) > 0 || (await readyCta.count()) > 0,
        "Product purchase/customization CTA was not available."
      );

      if ((await readyCta.count()) > 0) {
        const colourLabel = page.getByText("Colour", { exact: true }).first();
        if (await colourLabel.isVisible().catch(() => false)) {
          const colourButtons = colourLabel.locator("xpath=../..").locator("button");
          if ((await colourButtons.count()) > 0) await colourButtons.first().click();
        }

        const sizeLabel = page.getByText("Size", { exact: true }).first();
        if (await sizeLabel.isVisible().catch(() => false)) {
          const sizeButtons = sizeLabel.locator("xpath=../..").locator("button");
          if ((await sizeButtons.count()) > 0) await sizeButtons.first().click();
        }

        const afterSelection = page.getByRole("button", {
          name: /Add to bag|Sold out|Unavailable combination|Choose colour \+ size/i,
        });
        assert((await afterSelection.count()) > 0, "Variant selection removed the purchase CTA.");
      }
    });

    await runCheck(browser, "cart empty-state safety", DESKTOP, async (page) => {
      await navigate(page, "/cart");
      await page.getByRole("heading", { name: /YOUR CART IS EMPTY/i }).waitFor();
      await page.getByRole("link", { name: /Design Your Own/i }).waitFor();
    });

    await runCheck(browser, "checkout dry-run surface", DESKTOP, async (page) => {
      await page.addInitScript(() => {
        window.localStorage.setItem("gdp_cart_v2__guest", JSON.stringify([
          {
            productId: "production-smoke-product",
            variantId: "production-smoke-variant",
            key: "production-smoke-item",
            name: "Production smoke dry-run",
            price: 1,
            quantity: 1,
            size: "M",
            color: "Black",
            image: "/images/gdp-tshirt.svg",
          },
        ]));
      });

      // Exercise the production checkout UI without creating a checkout session,
      // inventory reservation, Stripe session, or order in production.
      await page.route("**/functions/v1/checkout", (route) => route.abort("blockedbyclient"));

      await navigate(page, "/checkout");
      await page.getByRole("heading", { name: "CHECKOUT" }).waitFor();
      await page.getByText("Guest checkout is ready", { exact: false }).waitFor();
      assert(await page.locator("#checkout-email").isVisible(), "Checkout email field is missing.");
      assert((await page.getByRole("button", { name: /Place order/i }).count()) > 0, "Checkout place-order CTA is missing.");
      assert((await page.getByText("Stripe Secure Payment", { exact: false }).count()) > 0, "Embedded Stripe payment section is missing.");
    });

    await runCheck(browser, "custom studio desktop entry", DESKTOP, async (page) => {
      await navigate(page, "/custom-studio");
      const body = await page.locator("body").innerText();
      assert(
        /CLOTHING, COLOR & SIZE|CHOOSE YOUR DESIGN PATH|CUSTOM STUDIO/i.test(body),
        "Custom Studio workflow did not render."
      );
      assert(
        !/No Custom Studio garments are currently published/i.test(body),
        "Custom Studio has no published garment catalog."
      );

      const memorialAssets = [
        "/images/gdp-styles/memorial-eternal-light.svg",
        "/images/gdp-styles/memorial-heavenly-clouds.svg",
        "/images/gdp-styles/memorial-rose-tribute.svg",
        "/images/gdp-styles/memorial-guardian-wings.svg",
        "/images/gdp-styles/memorial-sunset-remembrance.svg",
      ];
      for (const assetPath of memorialAssets) {
        const response = await page.request.get(new URL(assetPath, BASE_URL).toString());
        assert(response.ok(), `Memorial production asset failed to load: ${assetPath} (${response.status()})`);
        const svg = await response.text();
        assert(
          svg.includes('viewBox="0 0 4500 5400"'),
          `Memorial production asset has unexpected master dimensions: ${assetPath}`
        );
      }
    });

    await runCheck(browser, "custom studio mobile layout", MOBILE, async (page) => {
      await navigate(page, "/custom-studio");
      const body = await page.locator("body").innerText();
      assert(/CUSTOM STUDIO|CLOTHING, COLOR & SIZE|CHOOSE YOUR DESIGN PATH/i.test(body), "Custom Studio did not render on mobile.");
      await assertNoHorizontalOverflow(page, MOBILE);
    });

    await runCheck(browser, "dtf landing", DESKTOP, async (page) => {
      await navigate(page, "/dtf");
      await page.getByRole("heading", { name: /Build your DTF gang sheet/i }).waitFor();
      await page.getByRole("link", { name: /Build my gang sheet/i }).first().waitFor();
      await page.getByRole("link", { name: /Upload print-ready sheet/i }).first().waitFor();
    });

    await runCheck(browser, "dtf builder modes", DESKTOP, async (page) => {
      await navigate(page, "/dtf-gang-sheet?mode=build");
      await page.getByRole("heading", { name: /CUSTOM DTF GANG SHEET/i }).waitFor();
      const buildMode = page.getByRole("button", { name: /Build My Gang Sheet/i }).first();
      const uploadMode = page.getByRole("button", { name: /Upload Print-Ready Gang Sheet/i }).first();
      await buildMode.waitFor();
      await uploadMode.waitFor();
      assert((await page.locator('input[type="file"]').count()) > 0, "DTF artwork file input is missing.");
      await uploadMode.click();
      await page.getByText("Upload gang sheet", { exact: false }).first().waitFor();
    });

    await runCheck(browser, "login + registration surfaces", DESKTOP, async (page) => {
      await navigate(page, "/login");
      assert((await page.locator('input[type="email"]').count()) > 0, "Login email field is missing.");
      assert((await page.locator('input[type="password"]').count()) > 0, "Login password field is missing.");

      await navigate(page, "/register");
      assert((await page.locator('input[type="email"]').count()) > 0, "Registration email field is missing.");
      assert((await page.locator('input[type="password"]').count()) > 0, "Registration password field is missing.");
    });

    await runCheck(browser, "guest protected-route enforcement", DESKTOP, async (page) => {
      await navigate(page, "/account");
      await page.waitForURL(/\/login(?:\?|$)/, { timeout: 15000 });
      assert(new URL(page.url()).pathname === "/login", "Guest account route did not redirect to login.");

      await navigate(page, "/admin");
      await page.waitForURL(/\/login(?:\?|$)/, { timeout: 15000 });
      assert(new URL(page.url()).pathname === "/login", "Guest admin route did not redirect to login.");
    });
  } finally {
    await browser.close();
  }

  const passed = results.filter((item) => item.status === "passed").length;
  const failed = results.filter((item) => item.status === "failed").length;
  const report = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    passed,
    failed,
    total: results.length,
    results,
  };

  await fs.writeFile(path.join(ARTIFACT_DIR, "report.json"), JSON.stringify(report, null, 2));

  const lines = [
    "# GDP Clothing Production Smoke Report",
    "",
    "Target: " + BASE_URL,
    "Passed: " + passed + "/" + results.length,
    "Failed: " + failed + "/" + results.length,
    "",
  ];
  for (const item of results) {
    lines.push("- " + (item.status === "passed" ? "PASS" : "FAIL") + " - " + item.name + (item.error ? ": " + item.error : ""));
  }
  lines.push("");
  lines.push("Safety boundary: this canary does not submit a live Stripe payment, create a paid order, or upload customer artwork.");

  const summary = lines.join("\n");
  await fs.writeFile(path.join(ARTIFACT_DIR, "summary.md"), summary);
  console.log("\n" + summary);

  if (failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  try {
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(path.join(ARTIFACT_DIR, "fatal-error.txt"), error?.stack || error?.message || String(error));
  } catch {
    // Ignore artifact write failure after a fatal setup error.
  }
  process.exitCode = 1;
});
