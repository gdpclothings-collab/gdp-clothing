import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const VIEWPORT = { width: 1440, height: 1000 };
const CART_KEY = "gdp_cart_v2__guest";
const KNOWN_GARMENT_ID = "85e638f0-7fd0-4b0f-b661-c6e7b4965bf3";

const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), status: "running", checks: [] };
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function record(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    report.checks.push({ name, status: "passed", durationMs: Date.now() - startedAt, details: details || null });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, status: "failed", durationMs: Date.now() - startedAt, error: error?.message || String(error) });
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
}

function studioV2DraftState() {
  const protectedSide = () => ({
    templateId: "",
    photo: null,
    transform: { scale: 100, rotation: 0, x: 0, y: 0 },
    photos: [],
    activePhotoId: "",
    stickers: [],
    activeStickerId: "",
    text: { headline: "", subline: "", message: "" },
    textStyle: {
      fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
      fontScale: 100,
      color: "#ffffff",
      curve: "straight",
      curveAmount: 45,
      effect: "shadow",
      effectStrength: 45,
      rotation: 0,
      x: 0,
      y: 0,
    },
    confirmed: false,
  });
  const uploadSide = () => ({ artwork: null, transform: { scale: 100, rotation: 0, x: 0, y: 0 }, confirmed: false });
  const seasonalSide = () => ({ layers: [], activeLayerId: "", confirmed: false });

  return {
    step: "customize",
    productId: KNOWN_GARMENT_ID,
    color: "Black",
    size: "S",
    quantity: 1,
    designPath: "upload",
    side: "front",
    seasonal: { sides: { front: seasonalSide(), back: seasonalSide() } },
    bootleg: { sides: { front: protectedSide(), back: protectedSide() } },
    memorial: { sides: { front: protectedSide(), back: protectedSide() } },
    upload: { sides: { front: uploadSide(), back: uploadSide() } },
    approval: { needByDate: "", rightsConfirmed: false, finalDesignApproved: false },
  };
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    await record("Custom Studio V2 owns the active presentation boundary", async () => {
      const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-CA", timezoneId: "America/Regina", colorScheme: "light" });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await navigate(page, "/custom-studio");

      const guard = page.locator('[data-gdp-studio-v2-guard="true"]');
      await guard.waitFor({ state: "visible", timeout: 20000 });
      await page.getByRole("heading", { name: /choose your garment/i }).first().waitFor({ state: "visible", timeout: 20000 });
      assert(await page.locator("[data-studio-shell]").count() === 0, "Legacy Custom Studio shell is mounted on the V2 production route.");

      const layout = await guard.evaluate((element) => ({
        overflowX: getComputedStyle(element).overflowX,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      assert(["clip", "hidden"].includes(layout.overflowX), `V2 presentation guard is not clipping horizontal overflow (${layout.overflowX}).`);
      assert(layout.scrollWidth <= layout.clientWidth + 3, `Custom Studio V2 overflows horizontally (${layout.scrollWidth}px in ${layout.clientWidth}px).`);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-v2-boundary.png"), fullPage: true });
      await context.close();
      return layout;
    });

    await record("Step 1 keeps selected garment imagery and current controls", async () => {
      const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-CA", timezoneId: "America/Regina", colorScheme: "light" });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await navigate(page, "/custom-studio");

      const gallery = page.locator('[data-gdp-garment-gallery="true"]');
      await gallery.waitFor({ state: "visible", timeout: 20000 });
      const cards = gallery.locator(":scope > div > button");
      assert(await cards.count() > 0, "No selectable garment cards were found in Custom Studio V2.");
      const selectedName = String(await cards.first().innerText()).replace(/\s+/g, " ").trim();
      await cards.first().click();

      const configurator = page.locator('[data-gdp-selected-garment-configurator="true"]');
      await configurator.waitFor({ state: "visible", timeout: 10000 });
      const selectedSummary = page.locator('[data-gdp-selected-garment-summary="true"]');
      await selectedSummary.waitFor({ state: "visible", timeout: 10000 });
      assert(await page.locator('[data-gdp-selected-garment-options="true"]').isVisible(), "Selected garment options are not visible.");
      assert(await page.getByText("Color", { exact: true }).first().isVisible(), "Color controls are missing after garment selection.");
      assert(await page.getByText("Size", { exact: true }).first().isVisible(), "Size controls are missing after garment selection.");
      assert(await page.locator('[data-gdp-change-garment="true"]').isVisible(), "Change garment control is missing.");
      assert(await page.locator('[data-gdp-garment-continue="true"]').isVisible(), "Garment Continue control is missing.");

      const enabledSwatches = page.locator('[data-gdp-garment-swatch="true"]:not(:disabled)');
      if (await enabledSwatches.count()) await enabledSwatches.first().click();

      const selectedImage = selectedSummary.locator("img").first();
      await selectedImage.waitFor({ state: "visible", timeout: 10000 });
      const src = String(await selectedImage.getAttribute("src") || "").trim();
      assert(src.length > 0, "Selected garment summary has no image source.");

      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      assert(layout.scrollWidth <= layout.clientWidth + 3, `Selected garment view overflows horizontally (${layout.scrollWidth}px in ${layout.clientWidth}px).`);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-v2-step1.png"), fullPage: true });
      await context.close();
      return { selectedName, selectedImage: src, controlsVerified: true };
    });

    await record("V2 cart edit preserves draft and replacement intent through router state", async () => {
      const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-CA", timezoneId: "America/Regina", colorScheme: "light" });
      const cartItemKey = "custom_v2_smoke_design_S_Black_";
      const draft = { version: 1, state: studioV2DraftState() };

      await context.addInitScript(({ cartKey, cartItem, storageKey }) => {
        localStorage.setItem(storageKey, JSON.stringify([{ ...cartItem, key: cartKey }]));
      }, {
        storageKey: CART_KEY,
        cartKey: cartItemKey,
        cartItem: {
          productId: KNOWN_GARMENT_ID,
          name: "Custom Studio V2 smoke garment",
          image: "/images/gdp-tshirt.svg",
          isCustom: true,
          isDtf: false,
          designPath: "upload",
          color: "Black",
          size: "S",
          quantity: 1,
          price: 30,
          studioV2Draft: draft,
        },
      });

      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await navigate(page, "/cart");
      const edit = page.getByRole("button", { name: /^Edit design$/i }).first();
      await edit.waitFor({ state: "visible", timeout: 15000 });
      await edit.click();
      await page.waitForURL((url) => url.pathname === "/custom-studio-v2", { timeout: 15000 });
      await page.locator('[data-gdp-studio-v2-guard="true"]').waitFor({ state: "visible", timeout: 20000 });

      const routerState = await page.evaluate(() => window.history.state?.usr || null);
      assert(routerState?.editCartKey === cartItemKey, "Cart edit did not preserve the source item replacement key in V2 router state.");
      assert(routerState?.studioV2Draft?.version === 1, "Cart edit did not pass the current V2 draft contract.");
      assert(routerState?.studioV2Draft?.state?.designPath === "upload", "Cart edit changed the saved V2 design path.");
      assert(routerState?.studioV2Draft?.state?.color === "Black", "Cart edit changed the saved V2 garment color.");
      assert(routerState?.studioV2Draft?.state?.size === "S", "Cart edit changed the saved V2 garment size.");

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-v2-cart-edit.png"), fullPage: true });
      await context.close();
      return { route: "/custom-studio-v2", editCartKey: routerState.editCartKey, draftVersion: routerState.studioV2Draft.version };
    });

    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error?.message || String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-hardening-report.json"), JSON.stringify(report, null, 2));
  const summary = [
    "# GDP Clothing Custom Studio V2 Hardening Regression",
    "",
    `Target: ${BASE_URL}/custom-studio`,
    `Status: ${report.status.toUpperCase()}`,
    "",
    ...report.checks.map((item) => `- ${item.status === "passed" ? "PASS" : "FAIL"} - ${item.name}${item.error ? `: ${item.error}` : ""}`),
  ].join("\n");
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-hardening-summary.md"), summary);
  console.log(`\n${summary}`);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-hardening-fatal-error.txt"), error?.stack || error?.message || String(error));
  } catch { /* best-effort fatal evidence */ }
  process.exitCode = 1;
});
