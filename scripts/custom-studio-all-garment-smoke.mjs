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

const report = {
  baseUrl: BASE_URL,
  target: TARGET,
  generatedAt: new Date().toISOString(),
  status: "running",
  viewports: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function waitForImage(image, label) {
  await image.waitFor({ state: "visible", timeout: 15000 });

  const deadline = Date.now() + 15000;
  let state = null;
  while (Date.now() < deadline) {
    state = await image.evaluate((node) => ({
      complete: node.complete,
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight,
      src: node.currentSrc || node.src || "",
    }));

    if (state.complete && state.naturalWidth > 0 && state.naturalHeight > 0) return state;
    if (state.complete && state.src && state.naturalWidth === 0) {
      throw new Error(`${label} failed to load: ${state.src}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`${label} did not finish loading within 15 seconds${state?.src ? `: ${state.src}` : "."}`);
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(metrics.scrollWidth <= metrics.clientWidth + 2, `${label} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.clientWidth}px.`);
}

async function openStudio(page) {
  const response = await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert(response, `No document response received for ${TARGET}`);
  assert(response.status() < 400, `${TARGET} returned HTTP ${response.status()}`);
  await page.getByRole("heading", { name: /choose your garment/i }).first().waitFor({ state: "visible", timeout: 20000 });
  await page.locator('[data-gdp-garment-gallery="true"]').waitFor({ state: "visible", timeout: 20000 });
}

async function inspectViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await openStudio(page);

  const pageErrors = [];
  const onPageError = (error) => pageErrors.push(error.message);
  page.on("pageerror", onPageError);

  const gallery = page.locator('[data-gdp-garment-gallery="true"]');
  const initialCards = gallery.locator(":scope > div > button");
  const garmentCount = await initialCards.count();
  assert(garmentCount > 0, `No published Custom Studio garments were found on ${viewport.name}.`);

  const garmentNames = [];
  for (let index = 0; index < garmentCount; index += 1) {
    const card = initialCards.nth(index);
    const name = clean(await card.locator("p").first().innerText());
    garmentNames.push(name || `Garment ${index + 1}`);
    await waitForImage(card.locator("img"), `${viewport.name} garment card ${name || index + 1}`);
  }
  await assertNoHorizontalOverflow(page, `${viewport.name} garment gallery`);

  const garments = [];
  for (let index = 0; index < garmentCount; index += 1) {
    const currentGallery = page.locator('[data-gdp-garment-gallery="true"]');
    await currentGallery.waitFor({ state: "visible", timeout: 10000 });
    const cards = currentGallery.locator(":scope > div > button");
    assert(await cards.count() === garmentCount, `Garment count changed while testing ${viewport.name}.`);

    const card = cards.nth(index);
    const name = garmentNames[index];
    await card.click();

    const configurator = page.locator('[data-gdp-selected-garment-configurator="true"]');
    await configurator.waitFor({ state: "visible", timeout: 10000 });

    const selectedPreview = configurator.locator('[data-gdp-selected-garment-preview="true"] img');
    const previewState = await waitForImage(selectedPreview, `${viewport.name} selected preview for ${name}`);

    const enabledColors = configurator.locator('[data-gdp-garment-swatch="true"]:not([disabled])');
    const enabledColorCount = await enabledColors.count();
    assert(enabledColorCount > 0, `${name} has no enabled color on ${viewport.name}.`);

    const sizeCount = await configurator.locator('button[title]').evaluateAll((nodes) => nodes.filter((node) => !node.hasAttribute('data-gdp-garment-swatch') && !node.disabled).length);
    assert(sizeCount > 0, `${name} has no enabled size on ${viewport.name}.`);

    assert(await page.getByText("Color", { exact: true }).first().isVisible(), `${name} color controls are missing on ${viewport.name}.`);
    assert(await page.getByText("Size", { exact: true }).first().isVisible(), `${name} size controls are missing on ${viewport.name}.`);
    assert(await page.getByText("Quantity", { exact: true }).first().isVisible(), `${name} quantity controls are missing on ${viewport.name}.`);
    assert(await page.locator('[data-gdp-change-garment="true"]').isVisible(), `${name} Change garment control is missing on ${viewport.name}.`);
    await assertNoHorizontalOverflow(page, `${viewport.name} selected configurator for ${name}`);

    garments.push({
      name,
      cardImageLoaded: true,
      selectedPreviewLoaded: true,
      selectedPreviewSrc: previewState.src,
      enabledColorCount,
      enabledSizeCount: sizeCount,
      noHorizontalOverflow: true,
    });

    if (index < garmentCount - 1) {
      await page.locator('[data-gdp-change-garment="true"]').click();
    }
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `custom-studio-all-garments-${viewport.name}.png`),
    fullPage: true,
  });

  assert(pageErrors.length === 0, `${viewport.name} uncaught browser errors: ${pageErrors.join(" | ")}`);
  page.off("pageerror", onPageError);

  return {
    viewport,
    garmentCount,
    garments,
    pageErrors,
  };
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    for (const viewport of VIEWPORTS) {
      report.viewports.push(await inspectViewport(page, viewport));
    }
    const counts = report.viewports.map((entry) => entry.garmentCount);
    assert(counts.every((count) => count === counts[0]), `Published garment count differs by viewport: ${counts.join(", ")}`);
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error?.message || String(error);
    try {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "custom-studio-all-garments-FAILED.png"), fullPage: true });
    } catch { /* best-effort evidence */ }
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }

  await fs.writeFile(
    path.join(ARTIFACT_DIR, "custom-studio-all-garments-report.json"),
    JSON.stringify(report, null, 2),
  );

  const lines = [
    "# GDP Clothing Custom Studio All-Garment Matrix",
    "",
    `Target: ${TARGET}`,
    `Status: ${report.status.toUpperCase()}`,
    "",
    ...report.viewports.map((entry) => `- ${entry.viewport.name}: ${entry.garmentCount} garments verified`),
    ...(report.error ? ["", `Failure: ${report.error}`] : []),
  ];
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-all-garments-summary.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
