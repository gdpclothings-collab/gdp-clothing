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
  suite: "custom-studio-final-review-two-sided-live",
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  status: "running",
  viewports: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForImage(image, label, expectedSourcePart = "") {
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
    const sourceMatches = !expectedSourcePart || state.src.includes(expectedSourcePart);
    if (state.complete && state.naturalWidth > 0 && state.naturalHeight > 0 && sourceMatches) return state;
    if (state.complete && state.src && state.naturalWidth === 0) throw new Error(`${label} failed to load: ${state.src}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${label} did not load the expected source within 15 seconds${state?.src ? `: ${state.src}` : "."}`);
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(metrics.scrollWidth <= metrics.clientWidth + 3, `${label} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.clientWidth}px.`);
  return metrics;
}

function approvedTwoSidedUploadDraftState() {
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
  const frontArtworkUrl = `${BASE_URL}/images/gdp-logo.webp`;
  const backArtworkUrl = `${BASE_URL}/images/gdp-hero-approved.webp`;

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
          artwork: { url: frontArtworkUrl, path: frontArtworkUrl, name: "gdp-final-review-front.webp", type: "image/webp" },
          transform: { scale: 90, rotation: -2, x: -4, y: 3 },
          confirmed: true,
        },
        back: {
          artwork: { url: backArtworkUrl, path: backArtworkUrl, name: "gdp-final-review-back.webp", type: "image/webp" },
          transform: { scale: 84, rotation: 3, x: 5, y: -2 },
          confirmed: true,
        },
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
  const cartItemKey = `custom_v2_two_sided_final_review_${viewport.name}`;
  const draft = { version: 1, state: approvedTwoSidedUploadDraftState() };

  await context.addInitScript(({ storageKey, cartKey, cartItem }) => {
    localStorage.setItem(storageKey, JSON.stringify([{ ...cartItem, key: cartKey }]));
  }, {
    storageKey: CART_KEY,
    cartKey: cartItemKey,
    cartItem: {
      productId: KNOWN_GARMENT_ID,
      name: "Custom Studio two-sided Final Review smoke garment",
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

    const uploadPreview = page.locator('[data-gdp-upload-artwork-layer="true"] img[alt="Uploaded artwork preview"]').first();
    const frontLive = await waitForImage(uploadPreview, `${viewport.name} live front artwork`, "gdp-logo.webp");

    const frontSide = page.getByRole("button", { name: /^front/i }).first();
    const backSide = page.getByRole("button", { name: /^back/i }).first();
    await frontSide.waitFor({ state: "visible", timeout: 10000 });
    await backSide.waitFor({ state: "visible", timeout: 10000 });

    const finishSide = page.locator('[data-gdp-step3-finish-side="true"]').first();
    await finishSide.waitFor({ state: "visible", timeout: 10000 });
    assert(await finishSide.getAttribute("aria-pressed") === "true", `${viewport.name} restored front side is not marked finished.`);

    await backSide.click();
    const backLive = await waitForImage(uploadPreview, `${viewport.name} live back artwork`, "gdp-hero-approved.webp");
    assert(await finishSide.getAttribute("aria-pressed") === "true", `${viewport.name} restored back side is not marked finished.`);

    const approve = page.getByRole("button", { name: /I approve the final print layout/i }).first();
    await approve.waitFor({ state: "visible", timeout: 10000 });
    assert(!(await approve.isDisabled()), `${viewport.name} two-sided final layout approval is unexpectedly disabled.`);
    await page.waitForTimeout(300);
    await approve.click();

    const finalReviewAction = page.getByRole("button", { name: /Final review/i }).last();
    await finalReviewAction.waitFor({ state: "visible", timeout: 10000 });
    const enabledDeadline = Date.now() + 10000;
    while (await finalReviewAction.isDisabled()) {
      if (Date.now() >= enabledDeadline) throw new Error(`${viewport.name} Final review action did not enable for the two-sided design.`);
      await page.waitForTimeout(100);
    }
    await finalReviewAction.click();

    await page.getByRole("heading", { name: /^Final review$/i }).waitFor({ state: "visible", timeout: 10000 });
    const finalPreview = page.locator('[data-gdp-final-review-preview="true"]');
    await finalPreview.waitFor({ state: "visible", timeout: 10000 });

    const frontCard = finalPreview.locator('[data-gdp-final-review-preview-card="front"]');
    const backCard = finalPreview.locator('[data-gdp-final-review-preview-card="back"]');
    await frontCard.waitFor({ state: "visible", timeout: 10000 });
    await backCard.waitFor({ state: "visible", timeout: 10000 });
    assert(await frontCard.getByText(/Final garment preview · front/i).first().isVisible(), `${viewport.name} front Final Review snapshot label is missing.`);
    assert(await backCard.getByText(/Final garment preview · back/i).first().isVisible(), `${viewport.name} back Final Review snapshot label is missing.`);

    const frontFinal = await waitForImage(
      frontCard.locator('[data-gdp-upload-artwork-layer="true"] img[alt="Uploaded artwork preview"]').first(),
      `${viewport.name} Final Review front artwork`,
      "gdp-logo.webp"
    );
    const backFinal = await waitForImage(
      backCard.locator('[data-gdp-upload-artwork-layer="true"] img[alt="Uploaded artwork preview"]').first(),
      `${viewport.name} Final Review back artwork`,
      "gdp-hero-approved.webp"
    );
    assert(frontFinal.src !== backFinal.src, `${viewport.name} front and back Final Review artwork sources collapsed to the same image.`);

    const interactionCount = await finalPreview.locator("button, input, select, textarea").count();
    assert(interactionCount === 0, `${viewport.name} two-sided Final Review preview contains ${interactionCount} interactive controls.`);

    for (const [side, card] of [["front", frontCard], ["back", backCard]]) {
      const guide = card.locator('[data-gdp-print-guide="true"]').first();
      await guide.waitFor({ state: "visible", timeout: 10000 });
      const style = await guide.evaluate((node) => ({ borderColor: node.style.borderColor, backgroundColor: node.style.backgroundColor }));
      assert(style.borderColor === "transparent", `${viewport.name} ${side} Final Review print-guide border was not removed.`);
      assert(style.backgroundColor === "transparent", `${viewport.name} ${side} Final Review print-guide background was not removed.`);
    }

    const layout = await assertNoHorizontalOverflow(page, `${viewport.name} two-sided Final Review`);
    assert(pageErrors.length === 0, `${viewport.name} uncaught browser errors: ${pageErrors.join(" | ")}`);

    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `custom-studio-final-review-two-sided-${viewport.name}.png`),
      fullPage: true,
    });

    return {
      viewport,
      route: new URL(page.url()).pathname,
      frontLiveSrc: frontLive.src,
      backLiveSrc: backLive.src,
      frontFinalSrc: frontFinal.src,
      backFinalSrc: backFinal.src,
      bothPreviewCardsVisible: true,
      snapshotInteractiveControls: interactionCount,
      printGuidesHidden: true,
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

  await fs.writeFile(
    path.join(ARTIFACT_DIR, "custom-studio-final-review-two-sided-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  const lines = [
    "# GDP Clothing Custom Studio Two-Sided Final Review Live Smoke",
    "",
    `Target: ${BASE_URL}/custom-studio-v2`,
    `Status: ${report.status.toUpperCase()}`,
    "",
    ...report.viewports.map((entry) => `- ${entry.viewport.name}: distinct front + back approved artwork verified in Final Review`),
    ...(report.error ? ["", `Failure: ${report.error}`] : []),
  ];
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-final-review-two-sided-summary.md"), lines.join("\n"), "utf8");
  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
