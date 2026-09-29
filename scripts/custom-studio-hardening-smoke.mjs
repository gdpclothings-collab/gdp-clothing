import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const VIEWPORT = { width: 1440, height: 1000 };
const YOUTH_PRODUCT_ID = "85e638f0-7fd0-4b0f-b661-c6e7b4965bf3";
const DRAFT_KEY = "gdp.custom-studio.draft.v2";
const EDIT_KEY = "gdp.custom-studio.edit-cart.v1";

const report = { baseUrl: BASE_URL, status: "running", checks: [] };
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
  const response = await page.goto(new URL(route, BASE_URL).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
  assert(response && response.status() < 400, `${route} did not load successfully.`);
  await page.locator("body").waitFor({ state: "visible" });
  await page.waitForTimeout(1000);
}

async function startFreshIfNeeded(page) {
  const modal = page.getByRole("dialog", { name: /Resume your unfinished design/i });
  if (await modal.isVisible().catch(() => false)) {
    await modal.getByRole("button", { name: /Start fresh/i }).click();
    await page.waitForTimeout(500);
  }
}

async function selectYouthGarment(page) {
  const youth = page.getByRole("button", { name: /Youth Short Sleeve Tee/i }).first();
  await youth.waitFor({ state: "visible", timeout: 20000 });
  await youth.click();
  const configurator = page.locator('[data-gdp-selected-garment-configurator="true"]');
  await configurator.waitFor({ state: "visible", timeout: 10000 });
  return configurator;
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    await record("draft recovery owns the overlay stack", async () => {
      const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-CA", timezoneId: "America/Regina" });
      const page = await context.newPage();
      await navigate(page, "/custom-studio");
      await startFreshIfNeeded(page);

      // Seed a valid current-version draft after landing on the real production
      // origin. This test validates recovery-modal ownership of the overlay stack;
      // it must not depend on autosave timing in a headless runner.
      await page.evaluate((draftKey) => {
        localStorage.setItem(draftKey, JSON.stringify({
          version: 2,
          updatedAt: new Date().toISOString(),
          productId: "",
          step: 1,
          designPath: "",
          color: "",
          size: "",
          qty: 1,
        }));
      }, DRAFT_KEY);

      const storedDraft = await page.evaluate((draftKey) => JSON.parse(localStorage.getItem(draftKey) || "null"), DRAFT_KEY);
      assert(storedDraft?.version === 2, "Hardening smoke could not seed the current Custom Studio draft schema.");

      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      const modal = page.getByRole("dialog", { name: /Resume your unfinished design/i });
      await modal.waitFor({ state: "visible", timeout: 20000 });
      const guideButton = page.getByRole("button", { name: /How Custom Orders Work/i }).first();
      assert(await guideButton.count(), "How Custom Orders Work control is missing while draft recovery is active.");
      const pointerEvents = await guideButton.evaluate((element) => getComputedStyle(element).pointerEvents);
      assert(pointerEvents === "none", `Guide remains interactive behind draft recovery (pointer-events=${pointerEvents}).`);
      const modalZ = Number(await modal.evaluate((element) => getComputedStyle(element).zIndex));
      assert(modalZ >= 1400, `Draft recovery modal z-index is too low (${modalZ}).`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-draft-modal.png"), fullPage: true });
      await context.close();
      return { modalZ, guidePointerEvents: pointerEvents, draftVersion: storedDraft.version };
    });

    await record("Step 1 keeps selected-color imagery and current controls", async () => {
      const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-CA", timezoneId: "America/Regina" });
      const page = await context.newPage();
      await navigate(page, "/custom-studio");
      await startFreshIfNeeded(page);

      const configurator = await selectYouthGarment(page);
      const black = page.getByRole("button", { name: /^Black$/i }).first();
      await black.waitFor({ state: "visible", timeout: 10000 });
      await black.click();
      await page.waitForTimeout(500);

      assert(await page.locator('[data-gdp-selected-garment-options="true"]').isVisible(), "Selected garment options are not visible.");
      assert(await page.getByText("Color", { exact: true }).first().isVisible(), "Color controls are missing after garment selection.");
      assert(await page.getByText("Size", { exact: true }).first().isVisible(), "Size controls are missing after garment selection.");
      const changeButton = page.locator('[data-gdp-change-garment="true"]');
      await changeButton.waitFor({ state: "visible", timeout: 10000 });

      const selectedImage = configurator.locator("img").first();
      let src = "";
      if (await selectedImage.count()) src = String(await selectedImage.getAttribute("src") || "").toLowerCase();
      if (src) assert(src.includes("black") || src.includes("85e638f0") || src.startsWith("https://"), `Selected garment image is not a usable asset: ${src}`);

      const dock = page.locator(".gdp-step1-bottom-dock").first();
      if (await dock.count()) {
        const dockPosition = await dock.evaluate((element) => getComputedStyle(element).position);
        assert(["sticky", "fixed"].includes(dockPosition), `Step 1 action dock is not anchored (${dockPosition}).`);
      }

      const disabledSizes = page.locator('[data-step1-size] button:disabled');
      const disabledCount = await disabledSizes.count();
      if (disabledCount > 0) {
        const title = await disabledSizes.first().getAttribute("title");
        assert(/Unavailable/i.test(title || ""), "Disabled size does not explain availability.");
      }

      const guideButton = page.getByRole("button", { name: /How Custom Orders Work/i }).first();
      await guideButton.click();
      await page.waitForTimeout(250);
      assert(await page.getByText("Order received → Payment confirmed", { exact: false }).isVisible(), "After-order flow is not visible in the guide.");

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-hardening-step1.png"), fullPage: true });
      await context.close();
      return { selectedImage: src || "generated/fallback", disabledSizes: disabledCount, currentConfigurator: true };
    });

    await record("custom cart edit restores a draft and records replacement intent", async () => {
      const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-CA", timezoneId: "America/Regina" });
      const draft = {
        version: 2,
        updatedAt: new Date().toISOString(),
        productId: YOUTH_PRODUCT_ID,
        step: 3,
        designPath: "upload",
        color: "Black",
        size: "S",
        qty: 1,
        placement: "front",
        photos: [],
      };
      const key = "custom_smoke_design_S_Black_";
      await context.addInitScript(({ cart, cartKey }) => {
        localStorage.setItem("gdp_cart_v2__guest", JSON.stringify([{ ...cart, key: cartKey }]));
      }, {
        cartKey: key,
        cart: {
          productId: YOUTH_PRODUCT_ID,
          customDesignId: "smoke-design",
          name: "Youth Short Sleeve Tee",
          image: "/images/gdp-tshirt.svg",
          isCustom: true,
          isDtf: false,
          designPath: "upload",
          color: "Black",
          size: "S",
          quantity: 1,
          price: 30,
          studioDraft: draft,
        },
      });
      const page = await context.newPage();
      await navigate(page, "/cart");
      const edit = page.getByRole("button", { name: /^Edit design$/i }).first();
      await edit.waitFor({ state: "visible" });
      await edit.click();
      await page.waitForURL((url) => url.pathname === "/custom-studio", { timeout: 15000 });
      const stored = await page.evaluate(({ draftKey, editKey }) => ({
        draft: JSON.parse(localStorage.getItem(draftKey) || "null"),
        edit: JSON.parse(sessionStorage.getItem(editKey) || "null"),
      }), { draftKey: DRAFT_KEY, editKey: EDIT_KEY });
      assert(stored.draft?.designPath === "upload" && stored.draft?.color === "Black", "Cart edit did not restore the saved non-Seasonal Studio draft.");
      assert(stored.edit?.key === key, "Cart edit did not record the source item replacement key.");
      await context.close();
      return { restoredDesignPath: stored.draft.designPath, editKey: stored.edit.key };
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
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
