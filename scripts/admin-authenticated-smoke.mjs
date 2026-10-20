import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { accessHeadersForRequest, cloudflareChallengeDetails, publicPathOnly } from "./admin-smoke-cloudflare.mjs";
import { GDP_PAGES_ORIGIN, resolveAdminSmokeOrigin } from "./admin-smoke-origin.mjs";
import { submitMfaCodeAndAwaitAal2 } from "./admin-smoke-mfa.mjs";

const PRODUCTION_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
let BASE_URL = PRODUCTION_URL;
let smokeTarget = { baseUrl: PRODUCTION_URL, mode: "production", challenge: null };
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
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const challenge = cloudflareChallengeDetails(bodyText);
  if (challenge) {
    throw new Error(`Cloudflare security verification challenged ${route} (Ray ID: ${challenge.rayId || "not available"}).`);
  }
  assert(response && response.status() < 400, `${url} returned HTTP ${response?.status() ?? "no response"}`);
  await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
}

async function noOverflow(page, viewport) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (metrics.scrollWidth > Math.max(metrics.clientWidth, viewport.width) + 3) {
    // Narrow diagnostics only: classes, element geometry, never customer text.
    const elements = await page.evaluate(() => [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName.toLowerCase(),
          classes: String(element.className?.baseVal || element.className || "").slice(0, 110),
          right: Math.round(rect.right), width: Math.round(rect.width) };
      })
      .filter((entry) => entry.right > window.innerWidth + 3 && entry.width > 0)
      .sort((left, right) => right.right - left.right)
      .slice(0, 8));
    console.error("Admin viewport overflow element geometry:", JSON.stringify(elements));
  }
  assert(
    metrics.scrollWidth <= Math.max(metrics.clientWidth, viewport.width) + 3,
    `Horizontal overflow: ${metrics.scrollWidth}px in ${metrics.clientWidth}px viewport`
  );
}

// The admin shell renders before its async Supabase data loads. A visible
// dashboard heading alone is not a functional data-readiness test.
function expectAdminDashboardSettingsResponse(page) {
  const protectedSettingsResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === "/rest/v1/rpc/get_admin_store_settings",
    { timeout: 30000 }
  );
  return protectedSettingsResponse;
}

async function assertAdminDashboardHasLoadedData(page, protectedSettingsResponse) {
  const response = await protectedSettingsResponse;
  assert(response.status() === 200,
    `Step-up-protected dashboard settings RPC failed (HTTP ${response.status()}).`);
  // "0 products total" is a valid empty catalog, unlike the initial loading
  // placeholder. The red error message must be absent after loading settles.
  await page.getByText(/\d[\d,]* products total/).waitFor({ timeout: 30000 });
  assert(!(await page.getByText("Admin overview could not load").isVisible()),
    "Admin dashboard displayed a backend data-loading error.");
  assert(!(await page.getByText(/permission denied for table store_settings/i).isVisible()),
    "Dashboard still reads restricted store_settings directly.");
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
      await submitMfaCodeAndAwaitAal2(page, totp(TOTP_SECRET));
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

function cloudflareAccessCredentials() {
  const id = (process.env.GDP_SMOKE_CF_ACCESS_CLIENT_ID || "").trim();
  const secret = (process.env.GDP_SMOKE_CF_ACCESS_CLIENT_SECRET || "").trim();
  assert(Boolean(id) === Boolean(secret), "Cloudflare Access smoke credentials must be supplied as a pair.");
  const target = new URL(BASE_URL);
  // Never transmit configured Access credentials to the Pages mirror or
  // anything other than the exact protected production hostname.
  if (target.origin !== "https://gdpclothing.ca") return { id: "", secret: "" };
  assert(!id || target.protocol === "https:",
    "Cloudflare Access credentials require HTTPS on the GDP production hostname.");
  return { id, secret };
}

// Install on every independent Playwright context, including post-login checks.
// Never send service-token headers to Supabase, Stripe or other third parties.
async function installCloudflareAccessRoute(context, credentials) {
  if (!credentials?.id) return;
  await context.route("**/*", async (route) => {
    const request = route.request();
    const headers = accessHeadersForRequest(request.url(), BASE_URL, request.headers(), credentials);
    if (!headers) {
      await route.continue();
      return;
    }
    await route.continue({ headers });
  });
}

async function authenticate(browser) {
  assert(EMAIL, "GDP_ADMIN_SMOKE_EMAIL is required.");
  assert(PASSWORD, "GDP_ADMIN_SMOKE_PASSWORD is required.");

  const credentials = cloudflareAccessCredentials();
  const context = await browser.newContext({
    viewport: DESKTOP,
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  await installCloudflareAccessRoute(context, credentials);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
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
    await waitForAdminOrMfa(page);
  } catch (error) {
    const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 2500);
    const challenge = cloudflareChallengeDetails(bodyText);
    const route = publicPathOnly(page.url());
    console.error(`Admin auth diagnostic: path=${route} error=${error?.message || "unknown"}`);
    await page.screenshot({
      path: path.join(OUT, "admin-authentication-FAILED.png"),
      fullPage: true,
    }).catch(() => {});

    if (challenge) {
      console.error(`Cloudflare challenge on ${route}; Ray ID: ${challenge.rayId || "unavailable"}. Check Cloudflare Security Events for the matching rule. Cloudflare Access service tokens alone do not skip WAF challenges.`);
      await context.close();
      return {
        blocked: true,
        reason: challenge.reason,
        path: route,
        rayId: challenge.rayId,
        cfAccessConfigured: Boolean(credentials.id),
      };
    }

    await context.close();
    throw error;
  }

  const state = await context.storageState();
  await context.close();
  return { blocked: false, storageState: state };
}

async function runCheck(browser, name, viewport, storageState, test) {
  const context = await browser.newContext({
    viewport,
    storageState,
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });
  await installCloudflareAccessRoute(context, cloudflareAccessCredentials());
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
  // This pre-authentication check enforces production-build identity; it is
  // impossible to pass the admin test using a stale/mismatched Pages build.
  smokeTarget = await resolveAdminSmokeOrigin({
    productionUrl: PRODUCTION_URL,
    mirrorUrl: process.env.GDP_ADMIN_SMOKE_MIRROR_URL || GDP_PAGES_ORIGIN,
  });
  BASE_URL = smokeTarget.baseUrl;
  if (smokeTarget.challenge) {
    console.log(`Production Cloudflare WAF challenge preserved at /admin; Ray ID: ${smokeTarget.challenge.rayId || "not available"}. Authenticated app checks use same-build Pages mirror (${smokeTarget.buildDigest}).`);
  } else {
    console.log("Production /admin accepted smoke browser preflight; authenticated checks target production directly.");
  }
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    const authResult = await authenticate(browser);

    if (authResult?.blocked) {
      const report = {
        baseUrl: BASE_URL,
        generatedAt: new Date().toISOString(),
        authenticated: false,
        status: "blocked",
        blocker: authResult.reason,
        path: authResult.path,
        rayId: authResult.rayId,
        cfAccessConfigured: authResult.cfAccessConfigured,
        smokeOriginMode: smokeTarget.mode,
        productionWafChallenge: smokeTarget.challenge,
        safetyBoundary: "Authenticated admin smoke was blocked by Cloudflare security verification before the admin app rendered. No commerce mutation was submitted.",
        passed: 0,
        failed: 0,
        total: 0,
        results: [],
      };
      await fs.writeFile(path.join(OUT, "admin-authenticated-smoke.json"), JSON.stringify(report, null, 2));
      console.error(`BLOCKED admin smoke - Cloudflare security verification prevented authenticated coverage (Ray ID: ${authResult.rayId || "unavailable"}). Failing closed.`);
      process.exitCode = 1;
      return;
    }

    const storageState = authResult.storageState;

    results.push(await runCheck(browser, "desktop dashboard", DESKTOP, storageState, async (page) => {
      const settingsResponse = expectAdminDashboardSettingsResponse(page);
      await nav(page, "/admin");
      await page.getByRole("heading", { name: "Home" }).waitFor();
      await assertAdminDashboardHasLoadedData(page, settingsResponse);
      assert(await page.getByText("GDP Commerce Admin", { exact: true }).first().isVisible(), "Admin identity missing.");
      assert(await page.locator('a[aria-label="Open System Health"]').isVisible(), "Desktop System Health shortcut missing.");
      assert(!(await page.getByRole("button", { name: "Quick Actions" }).isVisible()), "Mobile Quick Actions should be hidden on desktop.");
      await noOverflow(page, DESKTOP);
    }));

    results.push(await runCheck(browser, "desktop admin sign out entry", DESKTOP, storageState, async (page) => {
      await nav(page, "/admin");
      const sidebar = page.getByRole("navigation", { name: "Admin navigation" });
      await sidebar.getByRole("link", { name: "Home" }).waitFor();
      const sidebarSignOut = page.locator("aside").getByRole("button", { name: "Sign out" });
      assert(await sidebarSignOut.isVisible(), "Desktop sidebar must offer Sign out.");
      const accountMenu = page.getByRole("button", { name: "Admin account menu" });
      await accountMenu.click();
      assert(await accountMenu.getAttribute("aria-expanded") === "true", "Account menu must expand.");
      assert(await page.locator("header").getByRole("button", { name: "Sign out" }).isVisible(),
        "Profile dropdown must offer Sign out.");
      // Read-only: never click Sign out; preserve authenticated smoke session.
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
      const settings = page.getByRole("link", { name: /Store settings/i }).first();
      await settings.waitFor();
      assert(await settings.getAttribute("aria-current") === "page", "Store settings lost aria-current=page.");
    }));

    results.push(await runCheck(browser, "admin data cleanup preview only", DESKTOP, storageState, async (page) => {
      await nav(page, "/admin/settings");
      const panel = page.getByRole("region", { name: "Admin data cleanup" });
      const opener = panel.getByRole("button", { name: /Data Cleanup/i });
      await opener.waitFor();
      await opener.click();
      await panel.getByRole("tab", { name: "Uploads" }).waitFor();
      await panel.getByText(/record\(s\) · \d+ eligible/).waitFor({ timeout: 60000 });
      assert(!(await panel.getByRole("alert").isVisible().catch(() => false)), "Admin cleanup preview returned an error.");
      assert(!(await panel.getByRole("button", { name: /Delete selected/i }).isVisible().catch(() => false)),
        "Destructive button must remain hidden before explicit selection.");
      const options = await panel.locator("#gdp-cleanup-bucket option").allTextContents();
      assert(options.length === 2 && options.some((name) => /Customer uploads/.test(name)) && options.some((name) => /DTF artwork/.test(name)),
        "Admin cleanup allowed buckets changed.");
      // Preview-only: do not select or delete any file, order or account.
    }));

    results.push(await runCheck(browser, "invoice editor read-only", DESKTOP, storageState, async (page) => {
      await nav(page, "/admin/invoices");
      await page.getByRole("heading", { name: "Invoices", exact: true, level: 1 }).waitFor();
      await page.getByRole("button", { name: "Create invoice", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "Create invoice" });
      await editor.waitFor();
      await editor.getByLabel("Customer name").waitFor();
      await editor.getByLabel("Invoice Date:").waitFor();
      await editor.getByRole("button", { name: "Preview", exact: true }).click();
      await page.getByText("Unsaved preview — not issued, not a payment receipt.").waitFor();
      await page.getByRole("button", { name: "Back to editing" }).click();
      await editor.getByRole("button", { name: "Cancel" }).click();
      await editor.waitFor({ state: "hidden" });
      // Intentionally never save, create a customer, issue, or print a live record.
    }));

    results.push(await runCheck(browser, "mobile admin sign out entry", MOBILE, storageState, async (page) => {
      await nav(page, "/admin");
      await page.getByRole("button", { name: "Open navigation" }).click();
      const navDrawer = page.locator("aside").filter({ has: page.getByText("GDP Commerce", { exact: true }) });
      assert(await navDrawer.getByRole("button", { name: "Sign out" }).isVisible(),
        "Mobile navigation must offer Sign out below Security.");
      await noOverflow(page, MOBILE);
      await navDrawer.getByRole("button", { name: "Close navigation" }).click();
      assert(!(await navDrawer.isVisible()), "Mobile navigation must close.");
      // Do not invalidate the CI admin session.
    }));

    results.push(await runCheck(browser, "mobile quick actions", MOBILE, storageState, async (page) => {
      const settingsResponse = expectAdminDashboardSettingsResponse(page);
      await nav(page, "/admin");
      await page.getByRole("heading", { name: "Home" }).waitFor();
      await assertAdminDashboardHasLoadedData(page, settingsResponse);
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
    smokeOriginMode: smokeTarget.mode,
    productionWafChallenge: smokeTarget.challenge,
    verifiedProductionBuild: smokeTarget.buildDigest || null,
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
