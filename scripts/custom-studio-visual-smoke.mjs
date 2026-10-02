import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const CART_KEY = "gdp_cart_v2__guest";
const KNOWN_GARMENT_ID = "85e638f0-7fd0-4b0f-b661-c6e7b4965bf3";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

const report = {
  suite: "custom-studio-responsive-visual",
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  status: "running",
  viewports: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function visualUploadDraftState() {
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
          artwork: {
            url: artworkUrl,
            path: artworkUrl,
            name: "gdp-responsive-visual-smoke.webp",
            type: "image/webp",
            pixelWidth: 3000,
            pixelHeight: 3000,
            sourceDpi: 300,
            sourceDpiX: 300,
            sourceDpiY: 300,
            sourceWidthIn: 10,
            sourceHeightIn: 10,
            physicalSizeSource: "embedded",
            contentBounds: { left: 0, top: 0, right: 1, bottom: 1 },
          },
          transform: { scale: 100, rotation: 0, x: 0, y: 0 },
          confirmed: false,
        },
        back: { artwork: null, transform: { scale: 100, rotation: 0, x: 0, y: 0 }, confirmed: false },
      },
    },
    approval: { needByDate: "", rightsConfirmed: true, finalDesignApproved: false },
  };
}

async function waitForImage(image, label) {
  await image.waitFor({ state: "visible", timeout: 15000 });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const state = await image.evaluate((node) => ({
      complete: node.complete,
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight,
      src: node.currentSrc || node.src || "",
    }));
    if (state.complete && state.naturalWidth > 0 && state.naturalHeight > 0) return state;
    if (state.complete && state.src && state.naturalWidth === 0) throw new Error(`${label} failed to load: ${state.src}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`${label} did not finish loading within 15 seconds.`);
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(metrics.scrollWidth <= metrics.clientWidth + 3, `${label} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.clientWidth}px.`);
  return metrics;
}

async function inspectViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  const cartItemKey = `custom_v2_visual_smoke_${viewport.name}`;
  const draft = { version: 1, state: visualUploadDraftState() };

  await context.addInitScript(({ storageKey, cartKey, cartItem }) => {
    localStorage.setItem(storageKey, JSON.stringify([{ ...cartItem, key: cartKey }]));
  }, {
    storageKey: CART_KEY,
    cartKey: cartItemKey,
    cartItem: {
      productId: KNOWN_GARMENT_ID,
      name: "Custom Studio responsive visual smoke garment",
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

  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const screenshotPath = path.join(ARTIFACT_DIR, `custom-studio-visual-${viewport.name}.png`);

  try {
    const cartResponse = await page.goto(`${BASE_URL}/cart`, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert(cartResponse && cartResponse.status() < 400, `Cart failed to load on ${viewport.name}.`);

    const edit = page.getByRole("button", { name: /^Edit design$/i }).first();
    await edit.waitFor({ state: "visible", timeout: 15000 });
    await edit.click();
    await page.waitForURL((url) => url.pathname === "/custom-studio-v2", { timeout: 15000 });

    const guard = page.locator('[data-gdp-studio-v2-guard="true"]');
    const printGuide = page.locator('[data-gdp-print-guide="true"]').first();
    const artworkLayer = page.locator('[data-gdp-upload-artwork-layer="true"]').first();
    const metricsPanel = page.locator('[data-gdp-artwork-metrics="true"]').first();

    await guard.waitFor({ state: "visible", timeout: 20000 });
    await printGuide.waitFor({ state: "visible", timeout: 15000 });
    await artworkLayer.waitFor({ state: "visible", timeout: 15000 });
    await metricsPanel.waitFor({ state: "visible", timeout: 15000 });
    await waitForImage(artworkLayer.locator('img[alt="Uploaded artwork preview"]'), `${viewport.name} visual artwork`);

    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        };
      };
      const guide = document.querySelector('[data-gdp-print-guide="true"]');
      return {
        guard: rect('[data-gdp-studio-v2-guard="true"]'),
        guide: rect('[data-gdp-print-guide="true"]'),
        artwork: rect('[data-gdp-upload-artwork-layer="true"]'),
        guideOverflow: guide ? getComputedStyle(guide).overflow : "missing",
        overflowState: guide?.getAttribute("data-gdp-upload-overflow-preview") || "missing",
      };
    });

    assert(geometry.guard && geometry.guard.width > 0, `${viewport.name} Studio guard has invalid geometry.`);
    assert(geometry.guide && geometry.guide.width > 0 && geometry.guide.height > 0, `${viewport.name} print guide has invalid geometry.`);
    assert(geometry.artwork && geometry.artwork.width > 0 && geometry.artwork.height > 0, `${viewport.name} artwork layer has invalid geometry.`);
    assert(geometry.guide.left >= -3 && geometry.guide.right <= viewport.width + 3, `${viewport.name} print guide escapes the viewport horizontally.`);
    assert(geometry.artwork.left >= geometry.guide.left - 3 && geometry.artwork.right <= geometry.guide.right + 3, `${viewport.name} fitted 10 × 10 in artwork escapes the print guide horizontally.`);
    assert(geometry.artwork.top >= geometry.guide.top - 3 && geometry.artwork.bottom <= geometry.guide.bottom + 3, `${viewport.name} fitted 10 × 10 in artwork escapes the print guide vertically.`);
    assert(geometry.guideOverflow === "visible", `${viewport.name} print guide no longer exposes real artwork overhang (overflow=${geometry.guideOverflow}).`);
    assert(geometry.overflowState === "inside", `${viewport.name} fitting artwork unexpectedly reports overflow state ${geometry.overflowState}.`);

    const metricsText = (await metricsPanel.innerText()).replace(/\s+/g, " ");
    assert(/300\s*DPI/i.test(metricsText), `${viewport.name} artwork metrics lost the 300 DPI value.`);
    assert(/10\s*[×x]\s*10\s*in/i.test(metricsText), `${viewport.name} artwork metrics lost the 10 × 10 in physical size.`);

    const layout = await assertNoHorizontalOverflow(page, `${viewport.name} Custom Studio visual editor`);
    assert(pageErrors.length === 0, `${viewport.name} uncaught browser errors: ${pageErrors.join(" | ")}`);

    await page.screenshot({ path: screenshotPath, fullPage: true });

    return {
      viewport,
      route: new URL(page.url()).pathname,
      screenshot: screenshotPath,
      metricsVerified: true,
      printGuideOverflowVisible: true,
      artworkInsideGuide: true,
      noHorizontalOverflow: layout.scrollWidth <= layout.clientWidth + 3,
      geometry,
      pageErrors,
    };
  } catch (error) {
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `custom-studio-visual-${viewport.name}-failure.png`),
      fullPage: true,
    }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

await fs.mkdir(ARTIFACT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of VIEWPORTS) {
    report.viewports.push(await inspectViewport(browser, viewport));
  }
  report.status = "passed";
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-visual-report.json"), JSON.stringify(report, null, 2));
  console.log("Custom Studio responsive visual smoke passed for desktop, tablet and mobile.");
} catch (error) {
  report.status = "failed";
  report.error = error?.message || String(error);
  await fs.writeFile(path.join(ARTIFACT_DIR, "custom-studio-visual-report.json"), JSON.stringify(report, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
