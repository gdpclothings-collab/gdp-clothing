import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const VIEWPORT = { width: 1440, height: 1000 };
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
    console.error(`FAIL ${name}: ${error?.message || error}`);
    throw error;
  }
}

async function navigate(page, route) {
  const target = new URL(route, BASE_URL).toString();
  const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert(response && response.status() < 400, `${target} did not load successfully.`);
  await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(900);
}

async function dismissDraftRecovery(page) {
  const modal = page.getByRole("dialog", { name: /Resume your unfinished design/i });
  if (await modal.isVisible().catch(() => false)) {
    await modal.getByRole("button", { name: /Start fresh/i }).click();
    await page.waitForTimeout(400);
  }
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-CA", timezoneId: "America/Regina", colorScheme: "light" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await record("Custom Studio Step 1 garment cards accept selection clicks", async () => {
      await navigate(page, "/custom-studio");
      await dismissDraftRecovery(page);
      const youth = page.getByRole("button", { name: /Youth Short Sleeve Tee/i }).first();
      await youth.waitFor({ state: "visible" });
      await youth.click();
      await page.waitForTimeout(300);
      const selected = page.locator('[data-garment-grid][data-gdp-collapsed="true"] > button.border-accent').first();
      await selected.waitFor({ state: "visible" });
      assert(await selected.isVisible(), "Selected garment card did not enter the collapsed selected state.");
      const changeButton = selected.getByRole("button", { name: /^Change garment$/i });
      assert(await changeButton.isVisible(), "Change garment control is missing after garment selection.");
      const black = page.getByRole("button", { name: /^Black$/i }).first();
      await black.waitFor({ state: "visible" });
      await black.click();
      await page.waitForTimeout(300);
      const sizeControls = page.locator('[data-step1-size] button');
      assert((await sizeControls.count()) > 0, "Size controls did not appear after selecting a garment and colour.");
      await changeButton.click();
      await page.waitForTimeout(250);
      const adult = page.getByRole("button", { name: /Adult Short Sleeve Tee/i }).first();
      if (await adult.isVisible().catch(() => false)) {
        await adult.click();
        await page.waitForTimeout(250);
        await page.locator('[data-garment-grid][data-gdp-collapsed="true"] > button.border-accent').first().waitFor({ state: "visible" });
      }
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-garment-selection.png"), fullPage: true });
      return { selectedGarment: "Youth Short Sleeve Tee", colourSelected: "Black", sizeControlsVisible: true, accessibleSelectors: true };
    });
    assert(pageErrors.length === 0, `Uncaught browser errors: ${pageErrors.join(" | ")}`);
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error?.message || String(error);
    report.pageErrors = pageErrors;
    try { await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-garment-selection-FAILED.png"), fullPage: true }); } catch {}
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-garment-report.json"), JSON.stringify(report, null, 2));
  const lines = ["# GDP Clothing Custom Studio Garment Regression", "", `Target: ${BASE_URL}/custom-studio`, `Status: ${report.status.toUpperCase()}`, "", ...report.checks.map((item) => `- ${item.status === "passed" ? "PASS" : "FAIL"} - ${item.name}${item.error ? `: ${item.error}` : ""}`)];
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-garment-summary.md"), lines.join("\n"));
  console.log(`\n${lines.join("\n")}`);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-garment-fatal-error.txt"), error?.stack || error?.message || String(error));
  } catch {}
  process.exitCode = 1;
});
