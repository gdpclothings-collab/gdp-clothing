import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const OUT = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";
const EMAIL = (process.env.GDP_ADMIN_SMOKE_EMAIL || "").trim();
const PASSWORD = process.env.GDP_ADMIN_SMOKE_PASSWORD || "";
const TOTP_SECRET = (process.env.GDP_ADMIN_SMOKE_TOTP_SECRET || "").trim();
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("Invalid TOTP secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, timestamp = Date.now()) {
  const key = decodeBase32(secret);
  const counter = BigInt(Math.floor(timestamp / 30000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = crypto.createHmac("sha1", key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, "0");
}

async function nav(page, route) {
  const url = new URL(route, BASE_URL).toString();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert(response && response.status() < 400, `${url} returned HTTP ${response?.status() ?? "no response"}`);
  await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
}

async function noOverflow(page, viewport) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(
    metrics.scrollWidth <= Math.max(metrics.clientWidth, viewport.width) + 3,
    `Horizontal overflow: ${metrics.scrollWidth}px in ${metrics.clientWidth}px viewport`
  );
}

async function waitForAdminOrMfa(page) {
  await page.waitForURL(/\/admin(?:\/|$)/, { timeout: 30000 });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await page.getByText("GDP Commerce Admin", { exact: true }).first().isVisible().catch(() => false)) {
      return;
    }

    const codeInput = page.locator("#admin-mfa-code");
    if (await codeInput.isVisible().catch(() => false)) {
      assert(TOTP_SECRET, "Admin MFA challenge requires GDP_ADMIN_SMOKE_TOTP_SECRET.");
      await codeInput.fill(totp(TOTP_SECRET));
      await page.getByRole("button", { name: /^Verify$/i }).click();
      await page.waitForTimeout(900);
      continue;
    }

    const later = page.getByRole("button", { name: /Set up later/i });
    if (await later.isVisible().catch(() => false)) {
      await later.click();
      await page.waitForTimeout(700);
      continue;
    }

    if (await page.getByText(/MFA setup is now required/i).isVisible().catch(() => false)) {
      throw new Error("Admin smoke account requires MFA but no verified factor session could be established.");
    }

    await page.waitForTimeout(500);
  }

  throw new Error("Authenticated admin dashboard did not become available.");
}

async function authenticate(browser) {
  assert(EMAIL, "GDP_ADMIN_SMOKE_EMAIL is required.");
  assert(PASSWORD, "GDP_ADMIN_SMOKE_PASSWORD is required.");

  const context = await browser.newContext({
    viewport: DESKTOP,
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  await nav(page, "/login?returnTo=%2Fadmin");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^Log in$/i }).click();

  const loginError = page.getByRole("alert");
  await Promise.race([
    page.waitForURL(/\/admin(?:\/|$)/, { timeout: 30000 }),
    loginError.waitFor({ state: "visible", timeout: 30000 }).then(async () => {
      throw new Error(`Admin login failed: ${await loginError.innerText()}`);
    }),
  ]);

  try {
    await waitForAdminOrMfa(page);
  } catch (error) {
    const bodyText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 1200);
    console.error(`Admin auth diagnostic: url=${page.url()} body=${bodyText || "[empty]"}`);
    await page.screenshot({
      path: path.join(OUT, "admin-authentication-FAILED.png"),
      fullPage: true,
    }).catch(() => {});
    throw error;
  }

  const state = await context.storageState();
  await context.close();
  return state;
}

async function runCheck(browser, name, viewport, storageState, test) {
  const context = await browser.newContext({
    viewport,
    storageState,
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const startedAt = Date.now();

  try {
    await test(page);
    await page.screenshot({
      path: path.join(OUT, `admin-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`),
      fullPage: true,
    });
    return { name, status: "passed", durationMs: Date.now() - startedAt };
  } catch (error) {
    await page.screenshot({
      path: path.join(OUT, `admin-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-FAILED.png`),
      fullPage: true,
    }).catch(() => {});
    return {
      name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: error?.message || String(error),
      url: page.url(),
    };
  } finally {
    await context.close();
  }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    const storageState = await authenticate(browser);

    results.push(await runCheck(browser, "desktop dashboard", DESKTOP, storageState, async (page) => {
      await nav(page, "/admin");
      await page.getByRole("heading", { name: "Home" }).waitFor();
      assert(await page.getByText("GDP Commerce Admin", { exact: true }).first().isVisible(), "Admin identity missing.");
      assert(await page.locator('a[aria-label="Open System Health"]').isVisible(), "Desktop System Health shortcut missing.");
      assert(!(await page.getByRole("button", { name: "Quick Actions" }).isVisible()), "Mobile Quick Actions should be hidden on desktop.");
      await noOverflow(page, DESKTOP);
    }));

    results.push(await runCheck(browser, "desktop global search", DESKTOP, storageState, async (page) => {
      await nav(page, "/admin");
      await page.getByRole("button", { name: /Search orders, products and customers/i }).click();
      const dialog = page.getByRole("dialog", { name: "GDP admin search" });
      await dialog.waitFor();
      assert(await dialog.getAttribute("aria-modal") === "true", "Admin search dialog lost aria-modal.");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
    }));

    results.push(await runCheck(browser, "settings selected state", DESKTOP, storageState, async (page) => {
      await nav(page, "/admin/settings");
      const settings = page.getByRole("button", { name: /Store settings/i }).first();
      await settings.waitFor();
      assert(await settings.getAttribute("aria-current") === "page", "Store settings lost aria-current=page.");
    }));

    results.push(await runCheck(browser, "mobile quick actions", MOBILE, storageState, async (page) => {
      await nav(page, "/admin");
      await page.getByRole("heading", { name: "Home" }).waitFor();
      const trigger = page.getByRole("button", { name: "Quick Actions" });
      await trigger.waitFor();
      assert(!(await page.locator('a[aria-label="Open System Health"]').isVisible()), "Desktop shortcut should be hidden on mobile.");
      await trigger.click();
      const menu = page.getByRole("menu", { name: "Admin quick actions" });
      await menu.waitFor();
      assert(await menu.getByRole("menuitem").count() === 5, "Mobile Quick Actions should contain five entries.");
      for (const label of ["Apparel Pricing", "Shipping & Delivery", "AI Manager", "Sales Leads", "System Health"]) {
        assert(await menu.getByRole("menuitem", { name: label }).isVisible(), `Missing mobile Quick Action: ${label}`);
      }
      await noOverflow(page, MOBILE);
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
      assert(await trigger.getAttribute("aria-expanded") === "false", "Quick Actions trigger should collapse after Escape.");
    }));
  } finally {
    await browser.close();
  }

  const failed = results.filter((item) => item.status === "failed");
  const report = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    authenticated: true,
    safetyBoundary: "Read-only admin navigation and search checks; no commerce mutation, refund, pricing, inventory, payment, or customer-data write is submitted.",
    passed: results.length - failed.length,
    failed: failed.length,
    total: results.length,
    results,
  };

  await fs.writeFile(path.join(OUT, "admin-authenticated-smoke.json"), JSON.stringify(report, null, 2));

  for (const result of results) {
    console.log(`${result.status === "passed" ? "PASS" : "FAIL"} admin smoke - ${result.name}${result.error ? `: ${result.error}` : ""}`);
  }

  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
