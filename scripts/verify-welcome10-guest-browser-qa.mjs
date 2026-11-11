// Browser smoke of the REAL checkout UI with isolated localhost-only
// synthetic responses. No Stripe, customer data, email or paid services.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:4179";
const apiOrigin = "http://127.0.0.1:54321";
const server = spawn(process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4179", "--strictPort"],
  { env: { ...process.env, VITE_SUPABASE_URL: apiOrigin,
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_LOCAL_QA_ONLY" }, stdio: "ignore" });
let browser;
async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw Error("Vite stopped unexpectedly");
    try { if ((await fetch(origin + "/checkout")).ok) return; } catch {}
    await delay(250);
  }
  throw Error("Isolated Vite checkout not ready");
}
async function verifyViewport(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  await context.addInitScript(() => {
    localStorage.setItem("gdp_cart_v2__guest", JSON.stringify([{
      key: "qa-shirt-M", productId: "00000000-0000-4000-8000-000000000001",
      name: "Synthetic QA T-shirt", price: 50, quantity: 1, size: "M",
      color: "Black", isCustom: false, isDtf: false,
    }]));
  });
  let remote = 0;
  let otp = 0;
  await context.route("**/*", async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin === origin) return route.continue();
    if (u.origin !== apiOrigin) { remote++; return route.abort(); }
    const respond = (data) => route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,apikey,x-client-info,content-type",
        "access-control-allow-methods": "GET,POST,OPTIONS" },
      body: JSON.stringify(data),
    });
    if (req.method() === "OPTIONS") return respond({});
    if (u.pathname.includes("/auth/v1/otp")) { otp++; return respond({}); }
    if (u.pathname.includes("/rest/v1/store_settings"))
      return respond({ store_name: "Local QA", maintenance_settings: { enabled: false } });
    if (u.pathname.includes("/functions/v1/payment-session"))
      return respond({ configured: false });
    if (u.pathname.includes("/functions/v1/checkout")) {
      let b = {};
      try { b = req.postDataJSON() || {}; } catch {}
      if (b.action === "welcomePromotionStatus") return respond({ enabled: true, guestOtpEnabled: false });
      if (b.action === "checkoutConfig")
        return respond({ configured: true, shipping: 0, tax: 3, taxRate: 0.06, taxName: "PST 6%" });
      return respond({ error: true, message: "LOCAL_QA_BLOCKED" });
    }
    return respond({});
  });
  try {
    const page = await context.newPage();
    await page.goto(origin + "/checkout", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.locator("#checkout-email").waitFor({ timeout: 20000 });
    await page.locator("#checkout-email").fill("buyer@example.test");
    await page.getByPlaceholder("Enter code").fill("WELCOME10");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByText("For now, sign in with your verified GDP Clothing account",
      { exact: false }).waitFor({ timeout: 10000 });
    assert.equal(otp, 0);
    assert.equal(await page.getByRole("button", { name: "Send verification code" }).count(), 0);
    assert.equal(await page.locator("#checkout-email").isVisible(), true);
    console.log("PASS actual checkout " + width + "x" + height +
      " guest OTP OFF, emails 0, external requests blocked " + remote);
  } finally { await context.close(); }
}
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  await verifyViewport(1440, 900);
  await verifyViewport(390, 844);
} finally {
  if (browser) await browser.close();
  server.kill();
}
