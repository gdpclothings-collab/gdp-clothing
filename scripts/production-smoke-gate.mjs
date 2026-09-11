import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };
const MAINTENANCE_PATTERN = /tuning things up|site maintenance|temporarily unavailable|temporarily paused/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function navigate(page, route) {
  const response = await page.goto(new URL(route, BASE_URL).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  assert(response, `No document response received for ${route}`);
  assert(response.status() < 400, `${route} returned HTTP ${response.status()}`);
  await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(900);
}

async function hasMaintenancePage(page, route = "/") {
  await navigate(page, route);
  const body = await page.locator("body").innerText();
  return MAINTENANCE_PATTERN.test(body);
}

async function assertNoHorizontalOverflow(page, viewport) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(
    metrics.scrollWidth <= Math.max(metrics.clientWidth, viewport.width) + 3,
    `Horizontal overflow detected: ${metrics.scrollWidth}px content in ${metrics.clientWidth}px viewport.`
  );
}

async function screenshot(page, name) {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, name), fullPage: true });
}

async function runMaintenanceSmoke(browser) {
  const results = [];

  async function check(name, viewport, fn) {
    const context = await browser.newContext({
      viewport,
      locale: "en-CA",
      timezoneId: "America/Regina",
      colorScheme: "light",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const startedAt = Date.now();
    try {
      await fn(page);
      await screenshot(page, `maintenance-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`);
      results.push({ name, status: "passed", durationMs: Date.now() - startedAt });
      console.log(`PASS ${name}`);
    } catch (error) {
      results.push({ name, status: "failed", durationMs: Date.now() - startedAt, error: error?.message || String(error) });
      console.error(`FAIL ${name}: ${error?.message || error}`);
    } finally {
      await context.close();
    }
  }

  await check("maintenance desktop", DESKTOP, async (page) => {
    assert(await hasMaintenancePage(page, "/"), "Maintenance page was expected on the home route.");
    const body = await page.locator("body").innerText();
    assert(/GDP|GOOD PEOPLE|DOPE CLOTHES/i.test(body), "GDP Clothing identity is missing from maintenance mode.");
  });

  await check("maintenance mobile layout", MOBILE, async (page) => {
    assert(await hasMaintenancePage(page, "/"), "Maintenance page was expected on mobile.");
    await assertNoHorizontalOverflow(page, MOBILE);
  });

  await check("maintenance public route enforcement", DESKTOP, async (page) => {
    assert(await hasMaintenancePage(page, "/shop"), "Shop should be gated while maintenance mode is enabled.");
    assert(await hasMaintenancePage(page, "/register"), "Registration should be gated while maintenance mode is enabled.");
  });

  await check("maintenance safe auth routes", DESKTOP, async (page) => {
    await navigate(page, "/login");
    assert((await page.locator('input[type="email"]').count()) > 0, "Login email field is missing.");
    assert((await page.locator('input[type="password"]').count()) > 0, "Login password field is missing.");

    await navigate(page, "/forgot-password");
    assert((await page.locator('input[type="email"]').count()) > 0, "Password recovery email field is missing.");

    await navigate(page, "/reset-password");
    const resetBody = await page.locator("body").innerText();
    assert(/invalid reset link|reset password|new password/i.test(resetBody), "Reset-password route did not render its safe recovery state.");
  });

  await check("maintenance guest admin enforcement", DESKTOP, async (page) => {
    await navigate(page, "/admin");
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 15000 });
    assert(new URL(page.url()).pathname === "/login", "Guest admin route did not redirect to login.");
  });

  const failed = results.filter((item) => item.status === "failed");
  const report = {
    baseUrl: BASE_URL,
    mode: "maintenance",
    generatedAt: new Date().toISOString(),
    passed: results.length - failed.length,
    failed: failed.length,
    total: results.length,
    results,
  };
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await fs.writeFile(path.join(ARTIFACT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(
    path.join(ARTIFACT_DIR, "summary.md"),
    [
      "# GDP Clothing Production Smoke Report",
      "",
      `Target: ${BASE_URL}`,
      "Mode: maintenance",
      `Passed: ${report.passed}/${report.total}`,
      `Failed: ${report.failed}/${report.total}`,
      "",
      ...results.map((item) => `- ${item.status === "passed" ? "PASS" : "FAIL"} - ${item.name}${item.error ? `: ${item.error}` : ""}`),
      "",
      "Maintenance mode is intentionally blocking normal storefront and registration routes; safe auth/admin-entry routes remain verified.",
    ].join("\n")
  );

  if (failed.length) process.exitCode = 1;
}

async function runNormalSmoke() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/production-smoke.mjs"], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) return reject(new Error(`Production smoke terminated by ${signal}`));
      if (code !== 0) process.exitCode = code || 1;
      resolve();
    });
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let maintenanceEnabled = false;
  try {
    const context = await browser.newContext({ viewport: DESKTOP, locale: "en-CA" });
    const page = await context.newPage();
    maintenanceEnabled = await hasMaintenancePage(page, "/");
    await context.close();

    if (maintenanceEnabled) {
      console.log("Maintenance mode detected. Running maintenance-aware production smoke checks.");
      await runMaintenanceSmoke(browser);
    }
  } finally {
    await browser.close();
  }

  if (!maintenanceEnabled) {
    console.log("Maintenance mode is off. Running the full storefront production smoke suite.");
    await runNormalSmoke();
  }
}

main().catch(async (error) => {
  console.error(error);
  await fs.mkdir(ARTIFACT_DIR, { recursive: true }).catch(() => {});
  await fs.writeFile(path.join(ARTIFACT_DIR, "fatal-error.txt"), error?.stack || error?.message || String(error)).catch(() => {});
  process.exitCode = 1;
});
