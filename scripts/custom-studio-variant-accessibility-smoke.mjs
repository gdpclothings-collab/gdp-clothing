import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const TARGET = `${BASE_URL}/custom-studio`;
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function waitForNumericValue(input, expected, label) {
  const deadline = Date.now() + 5000;
  let value = NaN;
  while (Date.now() < deadline) {
    value = Number(await input.inputValue());
    if (value === expected) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} did not reach ${expected}; last value was ${Number.isFinite(value) ? value : "invalid"}.`);
}

async function inspectViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    const response = await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert(response, `No document response received for ${TARGET} on ${viewport.name}.`);
    assert(response.status() < 400, `${TARGET} returned HTTP ${response.status()} on ${viewport.name}.`);

    await page.getByRole("heading", { name: /choose your garment/i }).first().waitFor({ state: "visible" });
    const gallery = page.locator('[data-gdp-garment-gallery="true"]');
    await gallery.waitFor({ state: "visible" });

    const firstCard = gallery.locator(":scope > div > button").first();
    await firstCard.waitFor({ state: "visible" });
    const garmentName = clean(await firstCard.locator("p").first().innerText()) || "first published garment";
    await firstCard.click();

    const configurator = page.locator('[data-gdp-selected-garment-configurator="true"]');
    await configurator.waitFor({ state: "visible" });

    const colorGroup = configurator.locator('[data-gdp-garment-color-group="true"]');
    await colorGroup.waitFor({ state: "visible" });
    assert(await colorGroup.getAttribute("role") === "group", `${garmentName} color controls are not a semantic group on ${viewport.name}.`);
    assert(await colorGroup.getAttribute("aria-label") === "Garment color", `${garmentName} color group has no stable accessible name on ${viewport.name}.`);

    const enabledSwatches = colorGroup.locator('[data-gdp-garment-swatch="true"]:not([disabled])');
    const enabledSwatchCount = await enabledSwatches.count();
    assert(enabledSwatchCount > 0, `${garmentName} exposes no enabled color choice on ${viewport.name}.`);
    let selectedSwatchCount = 0;
    for (let index = 0; index < enabledSwatchCount; index += 1) {
      const swatch = enabledSwatches.nth(index);
      const pressed = await swatch.getAttribute("aria-pressed");
      const title = clean(await swatch.getAttribute("title"));
      assert(pressed === "true" || pressed === "false", `${garmentName} color ${index + 1} has no valid aria-pressed state on ${viewport.name}.`);
      assert(title, `${garmentName} color ${index + 1} has no accessible color name source on ${viewport.name}.`);
      if (pressed === "true") selectedSwatchCount += 1;
    }
    assert(selectedSwatchCount === 1, `${garmentName} should expose exactly one selected color on ${viewport.name}; found ${selectedSwatchCount}.`);

    const quantityGroup = configurator.locator('[data-gdp-garment-quantity-group="true"]');
    await quantityGroup.waitFor({ state: "visible" });
    assert(await quantityGroup.getAttribute("role") === "group", `${garmentName} quantity controls are not a semantic group on ${viewport.name}.`);
    assert(await quantityGroup.getAttribute("aria-label") === "Garment quantity", `${garmentName} quantity group has no stable accessible name on ${viewport.name}.`);

    const quantityInput = quantityGroup.locator('input[data-gdp-garment-quantity="true"]');
    await quantityInput.waitFor({ state: "visible" });
    assert(await quantityInput.getAttribute("type") === "number", `${garmentName} quantity input is not numeric on ${viewport.name}.`);
    assert(await quantityInput.getAttribute("aria-label") === "Garment quantity", `${garmentName} quantity input has no stable accessible name on ${viewport.name}.`);

    const decrementButton = quantityGroup.getByRole("button", { name: "Decrease garment quantity", exact: true });
    const incrementButton = quantityGroup.getByRole("button", { name: "Increase garment quantity", exact: true });
    await decrementButton.waitFor({ state: "visible" });
    await incrementButton.waitFor({ state: "visible" });

    const initialValue = Number(await quantityInput.inputValue());
    const minValue = Number(await quantityInput.getAttribute("min"));
    const maxValue = Number(await quantityInput.getAttribute("max"));
    assert(Number.isFinite(initialValue), `${garmentName} quantity value is invalid on ${viewport.name}.`);

    let interaction = "";
    if (!Number.isFinite(maxValue) || initialValue < maxValue) {
      await incrementButton.click();
      await waitForNumericValue(quantityInput, initialValue + 1, `${viewport.name} quantity increment`);
      await decrementButton.click();
      await waitForNumericValue(quantityInput, initialValue, `${viewport.name} quantity restore`);
      interaction = "increment-restore";
    } else if (!Number.isFinite(minValue) || initialValue > minValue) {
      await decrementButton.click();
      await waitForNumericValue(quantityInput, initialValue - 1, `${viewport.name} quantity decrement`);
      await incrementButton.click();
      await waitForNumericValue(quantityInput, initialValue, `${viewport.name} quantity restore`);
      interaction = "decrement-restore";
    } else {
      throw new Error(`${garmentName} quantity control has no safe testable range on ${viewport.name}.`);
    }

    assert(pageErrors.length === 0, `${viewport.name} uncaught browser errors: ${pageErrors.join(" | ")}`);

    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `custom-studio-variant-accessibility-${viewport.name}.png`),
      fullPage: true,
    });

    return {
      viewport,
      garmentName,
      colorGroup: true,
      enabledSwatchCount,
      exactlyOneSelectedColor: true,
      quantityGroup: true,
      quantityInputLabelled: true,
      quantityButtonsLabelled: true,
      quantityInteraction: interaction,
      quantityRestoredTo: initialValue,
      pageErrors,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = {
    baseUrl: BASE_URL,
    target: TARGET,
    generatedAt: new Date().toISOString(),
    status: "running",
    viewports: [],
  };

  try {
    for (const viewport of VIEWPORTS) {
      report.viewports.push(await inspectViewport(browser, viewport));
    }
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error?.message || String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await fs.writeFile(
      path.join(ARTIFACT_DIR, "custom-studio-variant-accessibility-report.json"),
      JSON.stringify(report, null, 2),
      "utf8"
    );
  }

  if (report.status === "passed") {
    console.log("PASS Custom Studio live variant accessibility smoke");
    for (const entry of report.viewports) {
      console.log(`- ${entry.viewport.name}: ${entry.garmentName}, ${entry.enabledSwatchCount} colors, quantity ${entry.quantityInteraction}`);
    }
  } else {
    throw new Error(report.error || "Custom Studio live variant accessibility smoke failed.");
  }
}

await main();
