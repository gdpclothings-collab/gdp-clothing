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
const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

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

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    await record("draft recovery owns the overlay stack", async () => {
      const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-CA", timezoneId: "America/Regina" });
      await context.addInitScript(({ draftKey, productId }) => {
        localStorage.setItem(draftKey, JSON.stringify({
          version: 2,
          updatedAt: new Date().toISOString(),
          productId,
          step: 1,
          designPath: "",
          color: "",
          size: "",
          qty: 1,
        }));
      }, { draftKey: DRAFT_KEY, productId: YOUTH_PRODUCT_ID });
      const page = await context.newPage();
      await navigate(page, "/custom-studio");
      const modal = page.getByRole("dialog", { name: /Resume your unfinished design/i });
      await modal.waitFor({ state: "visible" });
      const guideButton = page.getByRole("button", { name: /How Custom Orders Work/i }).first();
      assert(await guideButton.count(), "How Custom Orders Work control is missing while draft recovery is active.");
      const pointerEvents = await guideButton.evaluate((element) => getComputedStyle(element).pointerEvents);
      assert(pointerEvents === "none", `Guide remains interactive behind draft recovery (pointer-events=${pointerEvents}).`);
      const modalZ = Number(await modal.evaluate((element) => getComputedStyle(element).zIndex));
      assert(modalZ >= 1400, `Draft recovery modal z-index is too low (${modalZ}).`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-draft-modal.png"), fullPage: true });
      await context.close();
      return { modalZ, guidePointerEvents: pointerEvents };
    });

    await record("Step 1 keeps exact selected-color imagery and real controls", async () => {
      const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-CA", timezoneId: "America/Regina" });
      const page = await context.newPage();
      await navigate(page, "/custom-studio");
      const draftModal = page.getByRole("dialog", { name: /Resume your unfinished design/i });
      if (await draftModal.isVisible().catch(() => false)) {
        await draftModal.getByRole("button", { name: /Start fresh/i }).click();
        await page.waitForTimeout(500);
      }

      const youth = page.getByRole("button", { name: /Youth Short Sleeve Tee/i }).first();
      await youth.waitFor({ state: "visible" });
      await youth.click();
      await page.waitForTimeout(250);
      const black = page.getByRole("button", { name: /^Black$/i }).first();
      await black.click();
      await page.waitForTimeout(500);

      const selected = page.locator('[data-garment-grid][data-gdp-collapsed="true"] > button.border-accent').first();
      await selected.waitFor({ state: "visible" });
      const selectedImage = selected.locator(":scope > div:first-child img");
      const src = String(await selectedImage.getAttribute("src") || "").toLowerCase();
      assert(src.includes("black"), `Youth Black selection is not showing the black garment asset: ${src}`);

      const changeButton = selected.getByRole("button", { name: /^Change garment$/i });
      assert(await changeButton.isVisible(), "Real Change garment button is not visible on the selected garment card.");

      const dock = page.locator(".gdp-step1-bottom-dock").first();
      const dockPosition = await dock.evaluate((element) => getComputedStyle(element).position);
      assert(dockPosition === "sticky", `Step 1 action dock is not sticky (${dockPosition}).`);

      const disabledSizes = page.locator('[data-step1-size] button:disabled');
      const disabledCount = await disabledSizes.count();
      if (disabledCount > 0) {
        const title = await disabledSizes.first().getAttribute("title");
        assert(/Unavailable in Black/i.test(title || ""), "Disabled size does not explain selected-color availability.");
      }

      const guideButton = page.getByRole("button", { name: /How Custom Orders Work/i }).first();
      const row = page.locator("[data-studio-row]").first();
      const before = await row.boundingBox();
      await guideButton.click();
      await page.waitForTimeout(250);
      const after = await row.boundingBox();
      assert(before && after && after.x > before.x, "Opening the guide did not yield workspace space.");
      assert(await page.getByText("Order received → Payment confirmed", { exact: false }).isVisible(), "After-order flow was not moved into the guide drawer.");

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-hardening-step1.png"), fullPage: true });
      await context.close();
      return { selectedImage: src, disabledSizes: disabledCount, dockPosition };
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
