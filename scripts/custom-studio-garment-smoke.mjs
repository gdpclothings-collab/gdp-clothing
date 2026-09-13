import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const VIEWPORT = { width: 1440, height: 1000 };

const report = {
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  status: "running",
  checks: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasExactClass(value, className) {
  return String(value || "").split(/\s+/).includes(className);
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
  await page.waitForTimeout(900);
}

async function attachClickProbe(card) {
  await card.evaluate((element) => {
    element.dataset.gdpSmokeClickReached = "0";
    element.addEventListener(
      "click",
      () => {
        element.dataset.gdpSmokeClickReached = "1";
      },
      { once: true }
    );
  });
}

async function assertClickReached(card, garmentName) {
  const reached = await card.getAttribute("data-gdp-smoke-click-reached");
  assert(
    reached === "1",
    `Click did not reach garment card \"${garmentName}\". A capture-phase click interceptor may be blocking Step 1.`
  );
}

async function cardState(card) {
  const name = normalizeText(await card.locator(".font-bold.leading-tight").first().innerText());
  const className = await card.getAttribute("class");
  return {
    name,
    selected: hasExactClass(className, "border-accent"),
  };
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
  page.setDefaultTimeout(15000);

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await record("Custom Studio Step 1 garment cards accept selection clicks", async () => {
      await navigate(page, "/custom-studio");

      const heading = page.getByText("CLOTHING, COLOR & SIZE", { exact: true }).first();
      await heading.waitFor({ state: "visible" });

      const cards = page.locator("#custom-studio-workspace button:has(.font-bold.leading-tight)");
      const count = await cards.count();
      assert(count > 0, "No selectable garment cards were found in Custom Studio Step 1.");

      const before = [];
      for (let index = 0; index < count; index += 1) {
        before.push(await cardState(cards.nth(index)));
      }

      const inactiveIndex = before.findIndex((item) => !item.selected);
      const targetIndex = inactiveIndex >= 0 ? inactiveIndex : 0;
      const target = cards.nth(targetIndex);
      const targetBefore = before[targetIndex];

      await attachClickProbe(target);
      await target.click();
      await page.waitForTimeout(300);
      await assertClickReached(target, targetBefore.name);

      const targetAfter = await cardState(target);
      if (!targetBefore.selected) {
        assert(targetAfter.selected, `Garment \"${targetBefore.name}\" received the click but did not become selected.`);
      }

      const colorLabel = page.getByText("Color", { exact: true }).first();
      const sizeLabel = page.getByText("Size", { exact: true }).first();
      assert(await colorLabel.isVisible().catch(() => false), "Color controls did not appear after selecting a garment.");
      assert(await sizeLabel.isVisible().catch(() => false), "Size controls did not appear after selecting a garment.");

      let switchedTo = null;
      if (count > 1) {
        const secondIndex = targetIndex === 0 ? 1 : 0;
        const second = cards.nth(secondIndex);
        const secondBefore = await cardState(second);

        await attachClickProbe(second);
        await second.click();
        await page.waitForTimeout(300);
        await assertClickReached(second, secondBefore.name);

        const secondAfter = await cardState(second);
        const firstAfterSwitch = await cardState(target);
        assert(secondAfter.selected, `Second garment \"${secondBefore.name}\" did not become selected.`);
        assert(!firstAfterSwitch.selected, `Previous garment \"${targetBefore.name}\" stayed selected after switching garments.`);
        switchedTo = secondBefore.name;
      }

      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "custom-studio-garment-selection.png"),
        fullPage: true,
      });

      return {
        garmentCount: count,
        selected: targetBefore.name,
        switchedTo,
        clickReachedCard: true,
        colorControlsVisible: true,
        sizeControlsVisible: true,
      };
    });

    assert(pageErrors.length === 0, `Uncaught browser errors: ${pageErrors.join(" | ")}`);
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error?.message || String(error);
    report.pageErrors = pageErrors;
    try {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "custom-studio-garment-selection-FAILED.png"),
        fullPage: true,
      });
    } catch {
      // Best-effort evidence only.
    }
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }

  await fs.writeFile(
    path.join(ARTIFACT_DIR, "custom-studio-garment-report.json"),
    JSON.stringify(report, null, 2)
  );

  const lines = [
    "# GDP Clothing Custom Studio Garment Regression",
    "",
    `Target: ${BASE_URL}/custom-studio`,
    `Status: ${report.status.toUpperCase()}`,
    "",
    ...report.checks.map((item) => `- ${item.status === "passed" ? "PASS" : "FAIL"} - ${item.name}${item.error ? `: ${item.error}` : ""}`),
  ];

  await fs.writeFile(
    path.join(ARTIFACT_DIR, "custom-studio-garment-summary.md"),
    lines.join("\n")
  );
  console.log(`\n${lines.join("\n")}`);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(
      path.join(ARTIFACT_DIR, "custom-studio-garment-fatal-error.txt"),
      error?.stack || error?.message || String(error)
    );
  } catch {
    // Ignore artifact write failure after a fatal setup error.
  }
  process.exitCode = 1;
});
