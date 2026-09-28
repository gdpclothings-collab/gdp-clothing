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

async function visibleCount(locator) {
  const count = await locator.count();
  let visible = 0;
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) visible += 1;
  }
  return visible;
}

async function findGarmentCards(page) {
  // Prefer current explicit data hooks when the deployed bundle exposes them.
  const explicitGallery = page.locator("[data-garment-grid]");
  if (await explicitGallery.count()) {
    const explicitCards = explicitGallery.locator(":scope > button");
    if (await visibleCount(explicitCards)) return { cards: explicitCards, strategy: "data-garment-grid" };
  }

  // Production may briefly serve a bundle whose Step 1 markup predates the data hook.
  // Anchor to the visible Step 1 heading, then use semantic garment-card structure:
  // selectable buttons containing garment artwork. This tests user-visible behavior
  // without coupling the smoke check to CSS classes or an internal wrapper name.
  await page.getByRole("heading", { name: /choose your garment/i }).waitFor({ state: "visible", timeout: 30000 });

  const workspace = page.locator("#custom-studio-workspace");
  const root = (await workspace.count()) ? workspace : page.locator("main");
  const semanticCards = root.locator("button").filter({ has: root.locator("img") });

  await semanticCards.first().waitFor({ state: "visible", timeout: 10000 });
  return { cards: semanticCards, strategy: "semantic-image-buttons" };
}

async function waitForSelectionState(page, selectedLabel) {
  const explicitState = page.locator("[data-step1-color], [data-step1-size], [data-step1-quantity], [data-step1-complete]");
  if (await explicitState.count()) {
    await explicitState.first().waitFor({ state: "visible", timeout: 10000 });
    return "data-step1-controls";
  }

  // Fallback for the currently deployed live markup: after a garment is selected,
  // the gallery collapses/focuses and the next garment-detail controls become visible.
  // Accept common Canadian/US labels so copy changes do not create a false outage.
  const detailText = page.getByText(/colour|color|size|quantity|printing details/i);
  await detailText.first().waitFor({ state: "visible", timeout: 10000 });

  const bodyText = normalizeText(await page.locator("body").innerText());
  assert(
    /colour|color|size|quantity/i.test(bodyText),
    `Garment card "${selectedLabel}" received a click but no garment-detail controls appeared.`
  );
  return "semantic-detail-controls";
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

      const { cards, strategy } = await findGarmentCards(page);
      const count = await visibleCount(cards);
      assert(count > 0, "No selectable garment cards were found in Custom Studio Step 1.");

      const first = cards.first();
      const firstText = normalizeText(await first.innerText());
      await attachClickProbe(first);
      await first.click();
      await assertClickReached(first, `garment card "${firstText}"`);

      const selectionState = await waitForSelectionState(page, firstText);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-garment-selection.png"), fullPage: true });

      return {
        garmentCount: count,
        selected: firstText,
        selectorStrategy: strategy,
        selectionState,
        clickReachedCard: true,
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