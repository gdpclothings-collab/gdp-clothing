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

function sourceParts(src) {
  try {
    const url = new URL(src, BASE_URL);
    return { href: url.href, pathname: url.pathname, hash: url.hash };
  } catch {
    return { href: String(src || ""), pathname: String(src || ""), hash: "" };
  }
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
      alt: node.getAttribute("alt") || "",
    }));

    if (state.complete && state.naturalWidth > 0 && state.naturalHeight > 0) return state;
    if (state.complete && state.src && state.naturalWidth === 0) {
      throw new Error(`${label} failed to load: ${state.src}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`${label} did not finish loading within 15 seconds${state?.src ? `: ${state.src}` : "."}`);
}

async function waitForColorSelection(swatch, image, expectedLabel, label) {
  const deadline = Date.now() + 10000;
  const expected = clean(expectedLabel).toLowerCase();
  let state = null;

  while (Date.now() < deadline) {
    state = await Promise.all([
      swatch.getAttribute("aria-pressed"),
      image.getAttribute("alt"),
    ]).then(([pressed, alt]) => ({ pressed, alt: clean(alt) }));

    if (state.pressed === "true" && (!expected || state.alt.toLowerCase().includes(expected))) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`${label} did not become selected within 10 seconds${state?.alt ? ` (preview alt: ${state.alt})` : "."}`);
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
    await waitForImage(selectedPreview, `${viewport.name} selected preview for ${name}`);

    const enabledColors = configurator.locator('[data-gdp-garment-swatch="true"]:not([disabled])');
    const enabledColorCount = await enabledColors.count();
    assert(enabledColorCount > 0, `${name} has no enabled color on ${viewport.name}.`);

    const colorResults = [];
    for (let colorIndex = 0; colorIndex < enabledColorCount; colorIndex += 1) {
      const swatches = configurator.locator('[data-gdp-garment-swatch="true"]:not([disabled])');
      assert(await swatches.count() === enabledColorCount, `${name} enabled color count changed while testing ${viewport.name}.`);

      const swatch = swatches.nth(colorIndex);
      const color = clean(await swatch.getAttribute("title")) || clean(await swatch.getAttribute("aria-label")) || `Color ${colorIndex + 1}`;
      await swatch.scrollIntoViewIfNeeded();
      await swatch.click();
      await waitForColorSelection(swatch, selectedPreview, color, `${viewport.name} ${name} color ${color}`);
      const colorPreviewState = await waitForImage(selectedPreview, `${viewport.name} selected preview for ${name} in ${color}`);
      assert(colorPreviewState.src, `${name} ${color} preview source is empty on ${viewport.name}.`);
      assert(colorPreviewState.naturalWidth > 0 && colorPreviewState.naturalHeight > 0, `${name} ${color} preview has invalid image dimensions on ${viewport.name}.`);
      await assertNoHorizontalOverflow(page, `${viewport.name} ${name} in ${color}`);

      colorResults.push({
        color,
        ariaPressed: true,
        previewLoaded: true,
        previewSrc: colorPreviewState.src,
        previewNaturalWidth: colorPreviewState.naturalWidth,
        previewNaturalHeight: colorPreviewState.naturalHeight,
      });
    }

    if (/crewneck/i.test(name) && colorResults.length > 1) {
      const crewneckSources = colorResults.map((entry) => sourceParts(entry.previewSrc));
      const crewneckPaths = new Set(crewneckSources.map((entry) => entry.pathname));
      const crewneckFullSources = new Set(crewneckSources.map((entry) => entry.href));
      assert(crewneckPaths.size === 1, `${name} color previews no longer share the approved same-canvas asset path on ${viewport.name}.`);
      assert(crewneckFullSources.size === colorResults.length, `${name} color previews are not uniquely mapped for every enabled color on ${viewport.name}.`);
    }

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
      allEnabledColorsVerified: true,
      enabledColorCount,
      colors: colorResults,
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
    colorCheckCount: garments.reduce((total, garment) => total + garment.enabledColorCount, 0),
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
    "# GDP Clothing Custom Studio All-Garment + All-Color Matrix",
    "",
    `Target: ${TARGET}`,
    `Status: ${report.status.toUpperCase()}`,
    "",
    ...report.viewports.map((entry) => `- ${entry.viewport.name}: ${entry.garmentCount} garments and ${entry.colorCheckCount} enabled color previews verified`),
    ...(report.error ? ["", `Failure: ${report.error}`] : []),
  ];
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-all-garments-summary.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
