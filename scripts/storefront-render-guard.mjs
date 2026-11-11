import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

// Check a local production build before merge, or the explicitly pinned live site after deployment.
// This catches blank pages without changing production data.
const BASE_URL = new URL(process.env.RENDER_GUARD_BASE_URL || "http://127.0.0.1:4173");
const localPreview = ["localhost", "127.0.0.1"].includes(BASE_URL.hostname);
const liveCanary = process.env.RENDER_GUARD_ALLOW_PRODUCTION === "1" && BASE_URL.origin === "https://gdpclothing.ca";
if (!localPreview && !liveCanary) {
  throw new Error("Render guard only permits localhost, or explicitly enabled GDP Clothing production.");
}
const OUT = process.env.RENDER_GUARD_ARTIFACT_DIR || "render-guard-results";
const CASES = [
  { name: "home-desktop", route: "/", viewport: { width: 1440, height: 900 }, required: /GDP|GOOD PEOPLE|DOPE CLOTHES/i },
  { name: "home-mobile", route: "/", viewport: { width: 390, height: 844 }, required: /GDP|GOOD PEOPLE|DOPE CLOTHES/i },
  { name: "shop-desktop", route: "/shop", viewport: { width: 1440, height: 900 }, required: /SHOP|PRODUCTS|COLLECTION/i },
  { name: "dtf-builder-desktop", route: "/dtf-gang-sheet?mode=build", viewport: { width: 1440, height: 900 }, required: /CUSTOM DTF GANG SHEET/i },
  // Theme-focused mobile/tablet checks stay inside the existing read-only
  // localhost render guard. They never submit checkout or mutate live data.
  { name: "aurora-home-tablet", route: "/", viewport: { width: 768, height: 1024 }, required: /MORE THAN CLOTHING/i, auroraSelector: ".gdp-aurora-home-hero", capture: true },
  { name: "aurora-shop-mobile", route: "/shop", viewport: { width: 390, height: 844 }, required: /SHOP ALL/i, auroraSelector: ".gdp-aurora-shop-hero", capture: true },
  { name: "aurora-shop-tablet", route: "/shop", viewport: { width: 768, height: 1024 }, required: /SHOP ALL/i, auroraSelector: ".gdp-aurora-shop-hero" },
  { name: "aurora-collections-mobile", route: "/shop?view=collections", viewport: { width: 390, height: 844 }, required: /COLLECTIONS/i, auroraSelector: ".gdp-aurora-shop-hero" },
  { name: "aurora-studio-mobile", route: "/custom-studio", viewport: { width: 390, height: 844 }, required: /CHOOSE YOUR GARMENT/i, auroraSelector: ".gdp-aurora-studio-header", capture: true },
  { name: "aurora-studio-tablet", route: "/custom-studio", viewport: { width: 768, height: 1024 }, required: /CHOOSE YOUR GARMENT/i, auroraSelector: ".gdp-aurora-studio-header", capture: true },
  { name: "aurora-dtf-mobile", route: "/dtf", viewport: { width: 390, height: 844 }, required: /BUILD YOUR DTF GANG SHEET/i, auroraSelector: ".gdp-aurora-dtf-hero", capture: true },
  { name: "aurora-dtf-tablet", route: "/dtf", viewport: { width: 768, height: 1024 }, required: /BUILD YOUR DTF GANG SHEET/i, auroraSelector: ".gdp-aurora-dtf-hero" },
  { name: "aurora-faq-mobile", route: "/faq", viewport: { width: 390, height: 844 }, required: /FAQ & SUPPORT/i, auroraSelector: ".gdp-aurora-faq-hero", capture: true },
  { name: "aurora-about-mobile", route: "/pages/about", viewport: { width: 390, height: 844 }, required: /MORE THAN CLOTHING/i, auroraSelector: ".gdp-aurora-about" },
  { name: "aurora-contact-mobile", route: "/pages/contact", viewport: { width: 390, height: 844 }, required: /CONTACT GDP CLOTHING/i, auroraSelector: ".gdp-aurora-contact-hero", capture: true },
  { name: "aurora-shipping-mobile", route: "/pages/shipping-delivery", viewport: { width: 390, height: 844 }, required: /SHIPPING/i, auroraSelector: ".gdp-aurora-shipping-image" },
  { name: "aurora-cart-mobile", route: "/cart", viewport: { width: 390, height: 844 }, required: /YOUR CART IS EMPTY/i },
];
const RUN_CASES = process.env.RENDER_GUARD_CANARY_ONLY === "1" ? CASES.slice(0, 2) : CASES;
const results = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function probe(browser, item) {
  const context = await browser.newContext({
    viewport: item.viewport,
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  const page = await context.newPage();
  const pageErrors = [];
  const assetFailures = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.origin === BASE_URL.origin && /\.(?:js|css)(?:\?|$)/.test(url.pathname + url.search)) {
      assetFailures.push(request.url() + ": " + (request.failure()?.errorText || "network error"));
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === BASE_URL.origin && /\.(?:js|css)$/.test(url.pathname) && response.status() >= 400) {
      assetFailures.push(response.url() + ": HTTP " + response.status());
    }
  });
  const startedAt = Date.now();
  try {
    const target = new URL(item.route, BASE_URL);
    const response = await page.goto(target.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
    assert(response && response.status() < 400, "Document failed to load: " + (response?.status() ?? "no response"));
    assert(new URL(page.url()).origin === BASE_URL.origin, "Render check unexpectedly redirected to another origin.");

    // A successful HTTP 200 or a visible <body> is not enough: React must mount.
    await page.waitForFunction(() => {
      const body = document.body;
      const root = document.getElementById("root");
      if (!body || !root || !root.firstElementChild) return false;
      const visible = (element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0 &&
          bounds.width > 0 && bounds.height > 0;
      };
      return visible(body) && visible(root) && (root.innerText || "").trim().length > 40;
    }, null, { timeout: 25000 });

    assert(await page.locator("body").isVisible(), "Document body is hidden.");
    assert(await page.locator("#root").isVisible(), "React root is hidden.");
    const rootText = (await page.locator("#root").innerText()).trim();
    assert(rootText.length > 40, "React root rendered only a blank or loading shell.");
    await page.waitForFunction(({ source, flags }) => {
      const text = document.getElementById("root")?.innerText || "";
      return new RegExp(source, flags).test(text);
    }, { source: item.required.source, flags: item.required.flags }, { timeout: 20000 });
    assert(item.required.test(await page.locator("#root").innerText()), "Expected route content missing: " + item.route);
    if (item.auroraSelector) {
      await page.locator(item.auroraSelector).first().waitFor({ state: "visible", timeout: 20000 });
      const hasThemeImage = await page.evaluate((selector) => {
        return [...document.querySelectorAll(selector)].some((element) => {
          const source = element.getAttribute("src") || "";
          const background = getComputedStyle(element).backgroundImage;
          const childSources = [...element.querySelectorAll("img")].map((img) => img.getAttribute("src") || "");
          return [source, background, ...childSources].some((value) => value.includes("/images/aurora/"));
        });
      }, item.auroraSelector);
      assert(hasThemeImage, `Missing Aurora campaign asset on ${item.route}`);
      const size = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
      assert(size.document <= size.viewport + 3, `Horizontal overflow at ${item.viewport.width}px: ${size.document}px document`);
    }
    await page.waitForTimeout(400);
    assert(pageErrors.length === 0, "Uncaught JS error: " + pageErrors.join(" | "));
    assert(assetFailures.length === 0, "First-party JS/CSS asset failed: " + assetFailures.join(" | "));
    if (item.capture) {
      await page.screenshot({ path: path.join(OUT, item.name + ".png"), fullPage: false });
    }
    results.push({ name: item.name, result: "passed", durationMs: Date.now() - startedAt });
    console.log("PASS " + item.name);
  } catch (error) {
    const details = await page.evaluate(() => {
      const body = document.body;
      const root = document.getElementById("root");
      return {
        bodyDisplay: body ? getComputedStyle(body).display : "absent",
        bodyVisibility: body ? getComputedStyle(body).visibility : "absent",
        rootChildren: root?.children.length ?? -1,
        rootTextLength: (root?.innerText || "").trim().length,
        rootTextSnippet: (root?.innerText || "").trim().slice(0, 350),
      };
    }).catch(() => ({}));
    await page.screenshot({ path: path.join(OUT, item.name + "-FAIL.png"), fullPage: true }).catch(() => {});
    results.push({
      name: item.name,
      result: "failed",
      error: error?.message || String(error),
      details,
      pageErrors,
      assetFailures,
      durationMs: Date.now() - startedAt,
    });
    console.error("FAIL " + item.name + ": " + (error?.message || error) + " " + JSON.stringify(details));
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const item of RUN_CASES) await probe(browser, item);
  } finally {
    await browser.close();
  }
  const failed = results.filter((item) => item.result === "failed").length;
  await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify({
    checkedAt: new Date().toISOString(),
    target: BASE_URL.toString(),
    passed: results.length - failed,
    failed,
    results,
  }, null, 2));
  if (failed) {
    console.error("Pre-merge storefront render guard failed: " + failed + "/" + results.length + " browser probes.");
    process.exitCode = 1;
  } else {
    console.log("Pre-merge storefront render guard passed all " + results.length + " browser probes.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
