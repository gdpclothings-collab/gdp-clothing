import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const VIEWPORT = { width: 1440, height: 1000 };

const report = { baseUrl: BASE_URL, generatedAt: new Date().toISOString(), status: "running", checks: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function record(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    report.checks.push({ name, status: "passed", durationMs: Date.now() - startedAt, details: details || null });
    console.log(`PASS ${name}`);
    return details;
  } catch (error) {
    report.checks.push({ name, status: "failed", durationMs: Date.now() - startedAt, error: error?.message || String(error) });
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
}

async function attachClickProbe(button) {
  await button.evaluate((element) => {
    element.dataset.gdpSmokeClickReached = "0";
    element.addEventListener("click", () => { element.dataset.gdpSmokeClickReached = "1"; }, { once: true });
  });
}

async function assertClickReached(button, label) {
  const reached = await button.getAttribute("data-gdp-smoke-click-reached");
  assert(reached === "1", `Click did not reach ${label}. A capture-phase click interceptor may be blocking Step 1.`);
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
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await record("Custom Studio Step 1 garment cards accept selection clicks", async () => {
      await navigate(page, "/custom-studio");

      const stepHeading = page.getByRole("heading", { name: /choose your garment/i }).first();
      await stepHeading.waitFor({ state: "visible", timeout: 20000 });

      const gallery = page.locator('[data-gdp-garment-gallery="true"]');
      await gallery.waitFor({ state: "visible", timeout: 20000 });
      const cards = gallery.locator(":scope > div > button");
      const count = await cards.count();
      assert(count > 0, "No selectable garment cards were found in Custom Studio Step 1.");

      const first = cards.first();
      const firstText = normalizeText(await first.innerText());
      await attachClickProbe(first);
      await first.click();
      await assertClickReached(first, `garment card "${firstText}"`);

      // Current Step 1 intentionally collapses the gallery after selection and shows
      // a focused configurator. Assert that real behavior instead of an old CSS class.
      const configurator = page.locator('[data-gdp-selected-garment-configurator="true"]');
      await configurator.waitFor({ state: "visible", timeout: 10000 });
      assert(await page.locator('[data-gdp-selected-garment-options="true"]').isVisible(), "Selected garment options did not appear after selection.");
      assert(await page.getByText("Color", { exact: true }).first().isVisible(), "Color controls did not appear after selecting a garment.");
      assert(await page.getByText("Size", { exact: true }).first().isVisible(), "Size controls did not appear after selecting a garment.");
      assert(await page.locator('[data-gdp-garment-continue="true"]').isVisible(), "Garment Continue control did not appear after selection.");

      let switchedTo = null;
      if (count > 1) {
        const changeButton = page.locator('[data-gdp-change-garment="true"]');
        await changeButton.waitFor({ state: "visible", timeout: 10000 });
        await changeButton.click();

        await gallery.waitFor({ state: "visible", timeout: 10000 });
        const refreshedCards = gallery.locator(":scope > div > button");
        assert(await refreshedCards.count() > 1, "Garment gallery did not restore after choosing Change garment.");

        const second = refreshedCards.nth(1);
        const secondText = normalizeText(await second.innerText());
        await attachClickProbe(second);
        await second.click();
        await assertClickReached(second, `second garment card "${secondText}"`);
        await configurator.waitFor({ state: "visible", timeout: 10000 });
        switchedTo = secondText;
      }

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-garment-selection.png"), fullPage: true });

      return {
        garmentCount: count,
        selected: firstText,
        switchedTo,
        clickReachedCard: true,
        colorControlsVisible: true,
        sizeControlsVisible: true,
        focusedConfiguratorVisible: true,
      };
    });

    assert(pageErrors.length === 0, `Uncaught browser errors: ${pageErrors.join(" | ")}`);
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error?.message || String(error);
    report.pageErrors = pageErrors;
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-garment-selection-FAILED.png"), fullPage: true });
    } catch { /* best-effort evidence */ }
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }

  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-garment-report.json"), JSON.stringify(report, null, 2));

  const lines = [
    "# GDP Clothing Custom Studio Garment Regression",
    "",
    `Target: ${BASE_URL}/custom-studio`,
    `Status: ${report.status.toUpperCase()}`,
    "",
    ...report.checks.map((item) => `- ${item.status === "passed" ? "PASS" : "FAIL"} - ${item.name}${item.error ? `: ${item.error}` : ""}`),
  ];
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-garment-summary.md"), lines.join("\n"));
  console.log(`\n${lines.join("\n")}`);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-garment-fatal-error.txt"), error?.stack || error?.message || String(error));
  } catch { /* ignore artifact write failure after fatal setup error */ }
  process.exitCode = 1;
});