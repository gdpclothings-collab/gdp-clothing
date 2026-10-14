import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const CART_KEY = "gdp_cart_v2__guest";
const KNOWN_GARMENT_ID = "85e638f0-7fd0-4b0f-b661-c6e7b4965bf3";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const report = {
  suite: "custom-studio-final-review-live",
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  status: "running",
  viewports: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    if (state.complete && state.src && state.naturalWidth === 0) throw new Error(`${label} failed to load: ${state.src}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${label} did not finish loading within 15 seconds${state?.src ? `: ${state.src}` : "."}`);
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(metrics.scrollWidth <= metrics.clientWidth + 3, `${label} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.clientWidth}px.`);
  return metrics;
}

async function assertStepOpensAtTop(page, label) {
  await page.waitForFunction(() => {
    const panel = document.querySelector('[data-gdp-premium-main-panel="true"]');
    if (!panel) return false;
    const top = panel.getBoundingClientRect().top;
    return top >= -3 && top <= (window.innerWidth < 768 ? 200 : 185);
  }, null, { timeout: 7000 });
  const position = await page.locator('[data-gdp-premium-main-panel="true"]').evaluate((node) => ({
    top: node.getBoundingClientRect().top,
    scrollY: window.scrollY,
  }));
  assert(position.top >= -3, label + ': new step began above the visible viewport');
  return position;
}

function approvedUploadDraftState() {
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
  const seasonalSide = () => ({ layers: [], activeLayerId: "", confirmed: false });
  const artworkUrl = `${BASE_URL}/images/gdp-logo.webp`;
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
    upload: {
      sides: {
        front: {
          artwork: { url: artworkUrl, path: artworkUrl, name: "gdp-final-review-smoke.webp", type: "image/webp" },
          transform: { scale: 92, rotation: 0, x: 0, y: 0 },
          confirmed: true,
        },
        back: { artwork: null, transform: { scale: 100, rotation: 0, x: 0, y: 0 }, confirmed: false },
      },
    },
    approval: { needByDate: "", rightsConfirmed: true, finalDesignApproved: false },
  };
}

async function inspectViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  const cartItemKey = `custom_v2_final_review_smoke_${viewport.name}`;
  const draft = { version: 1, state: approvedUploadDraftState() };

  await context.addInitScript(({ storageKey, cartKey, cartItem }) => {
    localStorage.setItem(storageKey, JSON.stringify([{ ...cartItem, key: cartKey }]));
  }, {
    storageKey: CART_KEY,
    cartKey: cartItemKey,
    cartItem: {
      productId: KNOWN_GARMENT_ID,
      name: "Custom Studio Final Review smoke garment",
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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    const cartResponse = await page.goto(`${BASE_URL}/cart`, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert(cartResponse && cartResponse.status() < 400, `Cart failed to load on ${viewport.name}.`);
    const edit = page.getByRole("button", { name: /^Edit design$/i }).first();
    await edit.waitFor({ state: "visible", timeout: 15000 });
    await edit.click();
    await page.waitForURL((url) => url.pathname === "/custom-studio-v2", { timeout: 15000 });

    const guard = page.locator('[data-gdp-studio-v2-guard="true"]');
    await guard.waitFor({ state: "visible", timeout: 20000 });
    const artworkLayer = page.locator('[data-gdp-upload-artwork-layer="true"]').first();
    await artworkLayer.waitFor({ state: "visible", timeout: 15000 });
    await waitForImage(artworkLayer.locator('img[alt="Uploaded artwork preview"]'), `${viewport.name} live approved artwork`);

    const approveCard = page.locator('[data-gdp-step3-unified-approval="true"]');
    const approvalCheckbox = page.locator('[data-gdp-step3-approval-checkbox="true"]');
    await approveCard.waitFor({ state: 'visible', timeout: 10000 });
    assert(await approvalCheckbox.isEnabled(), `${viewport.name}` + ': design approval should be enabled for an uploaded artwork');
    assert(!(await approvalCheckbox.isChecked()), `${viewport.name}` + ': restored design must require renewed approval');
    assert(await page.locator('[data-gdp-step3-approval="true"] input[type="checkbox"]').count() === 1, 'Only one Step 3 approval checkbox is allowed');
    await approveCard.click();
    assert(await approvalCheckbox.isChecked(), 'Combined layout-and-rights checkbox did not register');

    const finalReviewAction = page.getByRole("button", { name: /Final review/i }).last();
    await finalReviewAction.waitFor({ state: "visible", timeout: 10000 });
    const enabledDeadline = Date.now() + 10000;
    while (await finalReviewAction.isDisabled()) {
      if (Date.now() >= enabledDeadline) throw new Error(`${viewport.name} Final review action did not enable after approval.`);
      await page.waitForTimeout(100);
    }
    // Reproduce starting at the very bottom of Step 3 before navigating.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await finalReviewAction.click();

    await page.getByRole("heading", { name: /^Final review$/i }).waitFor({ state: "visible", timeout: 10000 });
    await assertStepOpensAtTop(page, viewport.name + ' Step 3 to Final Review');
    const finalPreview = page.locator('[data-gdp-final-review-preview="true"]');
    await finalPreview.waitFor({ state: "visible", timeout: 10000 });
    // Final Review must show the approved garment/artwork only. The editing
    // print-size badge and dashed-boundary explanation belong to Step 3.
    assert(await finalPreview.locator('[data-gdp-print-size]').count() === 0,
      'custom-studio-final-review-smoke.mjs: print-size badge attribute leaked into Final Review');
    assert(await finalPreview.locator('p').filter({ hasText: /drag with one finger|drag to move|dashed fabric box|dashed boundary|normalized geometry/i }).count() === 0,
      'custom-studio-final-review-smoke.mjs: editor-only fabric guidance leaked into Final Review');
    const generatedPrintLabel = await finalPreview.locator('[data-gdp-print-guide="true"]').first().evaluate((node) => {
      const frame = node.parentElement;
      return frame ? getComputedStyle(frame, '::before').content : '';
    });
    assert(!/print size/i.test(generatedPrintLabel),
      'custom-studio-final-review-smoke.mjs: generated CSS print-size badge is still visible in Final Review');

    assert(await finalPreview.getByText(/Your garment with the approved artwork/i).first().isVisible(), `${viewport.name} approved Final Review heading is missing.`);
    assert(await finalPreview.getByText(/Ready for final check/i).first().isVisible(), `${viewport.name} Final Review ready-state copy is missing.`);
    assert(await finalPreview.getByText(/Final garment preview · front/i).first().isVisible(), `${viewport.name} front approved snapshot label is missing.`);

    const finalArtworkLayer = finalPreview.locator('[data-gdp-upload-artwork-layer="true"]').first();
    await finalArtworkLayer.waitFor({ state: "visible", timeout: 10000 });
    const finalArtworkImage = finalArtworkLayer.locator('img[alt="Uploaded artwork preview"]');
    const artworkImageState = await waitForImage(finalArtworkImage, `${viewport.name} Final Review approved artwork`);
    assert(artworkImageState.src.includes("gdp-logo.webp"), `${viewport.name} Final Review snapshot lost the approved artwork source.`);

    const interactionCount = await finalPreview.locator("button, input, select, textarea").count();
    assert(interactionCount === 0, `${viewport.name} Final Review approved snapshot contains ${interactionCount} interactive controls.`);

    const cleanedLayer = await finalArtworkLayer.evaluate((node) => ({
      className: node.className,
      cursor: getComputedStyle(node).cursor,
    }));
    assert(!String(cleanedLayer.className).includes("ring-2") && !String(cleanedLayer.className).includes("ring-cyan"), `${viewport.name} Final Review artwork still shows an editor selection ring.`);
    assert(cleanedLayer.cursor !== "grab" && cleanedLayer.cursor !== "grabbing", `${viewport.name} Final Review artwork still exposes an editor drag cursor.`);

    const finalGuide = finalPreview.locator('[data-gdp-print-guide="true"]').first();
    await finalGuide.waitFor({ state: "visible", timeout: 10000 });
    const guideStyle = await finalGuide.evaluate((node) => ({
      borderColor: node.style.borderColor,
      backgroundColor: node.style.backgroundColor,
    }));
    assert(guideStyle.borderColor === "transparent", `${viewport.name} Final Review print-guide border was not removed.`);
    assert(guideStyle.backgroundColor === "transparent", `${viewport.name} Final Review print-guide background was not removed.`);

    const selectedGarment = page.locator('[data-gdp-review-garment-preview="true"]');
    await selectedGarment.waitFor({ state: "attached", timeout: 10000 });
    assert(await selectedGarment.isHidden(), `${viewport.name} redundant plain garment preview is visible beside the approved garment+artwork preview.`);

    const previewBeforeSummary = await page.evaluate(() => {
      const preview = document.querySelector('[data-gdp-final-review-preview="true"]');
      const summary = document.querySelector('[data-gdp-review-garment-preview="true"]');
      return Boolean(preview && summary && (preview.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    assert(previewBeforeSummary, `${viewport.name} approved garment+artwork preview is not presented before the review summary.`);

    const layout = await assertNoHorizontalOverflow(page, `${viewport.name} Final Review`);
    assert(pageErrors.length === 0, `${viewport.name} uncaught browser errors: ${pageErrors.join(" | ")}`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `custom-studio-final-review-${viewport.name}.png`),
      fullPage: true,
    });

    // Verify forward, backward, and progress-rail navigation from a scrolled editor.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.getByRole('button', { name: /^Edit design$/i }).first().click();
    await page.getByRole('heading', { name: /^Upload My Own Artwork$/i }).first().waitFor({ state: 'visible', timeout: 10000 });
    await assertStepOpensAtTop(page, viewport.name + ' Final Review to Edit design');

    await page.locator('[data-gdp-premium-rail="true"] button').first().click();
    await page.locator('[data-gdp-garment-continue="true"]').waitFor({ state: 'visible', timeout: 10000 });
    await assertStepOpensAtTop(page, viewport.name + ' Customize to Garment');

    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.locator('[data-gdp-garment-continue="true"]').click();
    await page.getByRole('heading', { name: /^Choose a design path$/i }).waitFor({ state: 'visible', timeout: 10000 });
    await assertStepOpensAtTop(page, viewport.name + ' Garment to Choose Design');

    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.getByRole('button', { name: /Upload My Own Artwork/i }).first().click();
    await page.getByRole('heading', { name: /^Upload My Own Artwork$/i }).first().waitFor({ state: 'visible', timeout: 10000 });
    await assertStepOpensAtTop(page, viewport.name + ' Choose Design to Customize');

    return {
      viewport,
      route: new URL(page.url()).pathname,
      approvedPreviewVisible: true,
      approvedArtworkLoaded: true,
      redundantGarmentPreviewHidden: true,
      snapshotInteractiveControls: interactionCount,
      printGuideHidden: true,
      editorSelectionChromeRemoved: true,
      approvedPreviewBeforeSummary: previewBeforeSummary,
      noHorizontalOverflow: layout.scrollWidth <= layout.clientWidth + 3,
      pageErrors,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
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
  }

  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-final-review-report.json"), JSON.stringify(report, null, 2));
  const lines = [
    "# GDP Clothing Custom Studio Final Review Live Smoke",
    "",
    `Target: ${BASE_URL}/custom-studio-v2`,
    `Status: ${report.status.toUpperCase()}`,
    "",
    ...report.viewports.map((entry) => `- ${entry.viewport.name}: approved garment + artwork Final Review verified`),
    ...(report.error ? ["", `Failure: ${report.error}`] : []),
  ];
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-final-review-summary.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
