import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { selectSafeCheckoutSmokeItem, checkoutSmokeRequestGuard, assertSaskatchewanPstOnlyQuote } from "./production-checkout-smoke-helpers.mjs";

const BASE_URL = (process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca").replace(/\/+$/, "");
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "en-CA",
    timezoneId: "America/Regina",
    colorScheme: "light",
  });

  const blocked = [];
  const observedPaymentActions = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = request.url();
    let action = null;
    try { action = request.postDataJSON()?.action || null; } catch {}
    if (new URL(url).pathname.replace(/\/+$/, "") === "/functions/v1/payment-session" && action) {
      observedPaymentActions.push(action);
    }
    const decision = checkoutSmokeRequestGuard({ url, method, action });
    if (decision.blocked) {
      blocked.push({ method, url, action });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    // Resolve a real active, available public SKU using the storefront's own
    // read-only catalog GET. Never inject a made-up product ID: checkoutConfig
    // correctly rejects those before it can return an authoritative tax quote.
    const catalogResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/rest/v1/products";
    }, { timeout: 30000 });
    await page.goto(`${BASE_URL}/shop`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const catalogResponse = await catalogResponsePromise;
    assert(catalogResponse.ok(), "Public catalog did not load for the safe checkout smoke.");
    const cartItem = selectSafeCheckoutSmokeItem(await catalogResponse.json());
    await page.evaluate((item) => {
      window.localStorage.setItem("gdp_cart_v2__guest", JSON.stringify([item]));
    }, cartItem);

    await page.goto(`${BASE_URL}/cart`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("body").waitFor({ state: "visible" });

    const checkoutButton = page.getByRole("button", { name: /Secure checkout/i }).first();
    await checkoutButton.waitFor({ state: "visible" });
    await checkoutButton.click();
    await page.waitForURL((url) => url.pathname === "/checkout", { timeout: 15000 });

    await page.locator("#checkout-email").fill("gdp-production-smoke@example.com");
    await page.locator("#checkout-first-name").fill("GDP");
    await page.locator("#checkout-last-name").fill("Smoke");
    await page.locator("#checkout-address").fill("123 Test Avenue");
    await page.locator("#checkout-city").fill("Saskatoon");

    // checkoutConfig is a POST but READ-ONLY. Wait for its actual server result
    // instead of checking the button during the 180ms debounce/network request.
    const quoteResults = [];
    const waitForVerifiedQuote = async (shippingMethod, updateForm) => {
      const quoteResponsePromise = page.waitForResponse((response) => {
        if (response.request().method() !== "POST" ||
            new URL(response.url()).pathname !== "/functions/v1/checkout") return false;
        try {
          const body = response.request().postDataJSON();
          return body?.action === "checkoutConfig" &&
            body?.shippingMethod === shippingMethod &&
            String(body?.postalCode || "").replace(/\s/g, "") === "S7K0J5";
        } catch { return false; }
      }, { timeout: 30000 });
      await updateForm();
      const response = await quoteResponsePromise;
      const payload = await response.json().catch(() => null);
      assert(response.ok(), "Authoritative checkoutConfig returned HTTP " + response.status() + ".");
      assertSaskatchewanPstOnlyQuote(payload, shippingMethod, cartItem.price);
      quoteResults.push({ shippingMethod, pst: payload.pstTax, gst: payload.gstHstTax, shipping: payload.shipping });
    };
    await waitForVerifiedQuote("standard", () => page.locator("#checkout-postal-code").fill("S7K 0J5"));
    await waitForVerifiedQuote("pickup", () => page.getByRole("button", { name: /Local Pickup/i }).first().click());
    await waitForVerifiedQuote("standard", () => page.getByRole("button", { name: /Standard Shipping/i }).first().click());

    const continueButton = page.getByRole("button", { name: /Continue to payment/i }).first();
    await continueButton.waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some((button) =>
        /Continue to payment/i.test(button.textContent || "") && !button.disabled),
      undefined, { timeout: 15000 });
    assert(await continueButton.isEnabled(), "Continue to payment stayed disabled despite a verified tax quote.");

    const clickStartedAt = Date.now();
    await continueButton.click();
    await page.waitForURL((url) => url.pathname === "/checkout/payment", { timeout: 15000 });

    assert((await page.getByText(/Step 2 of 2 · Payment & review/i).count()) > 0, "Checkout did not reach Payment Step 2.");
    assert((await page.getByText("Secure payment", { exact: true }).count()) > 0, "Secure payment surface is missing from Payment Step 2.");
    assert((await page.getByText(/Accept the policies above to load secure payment/i).count()) === 0, "Retired policy-gated payment copy is still visible.");

    const terms = page.locator('label:has-text("I agree to the") input[type="checkbox"]').first();
    await terms.waitFor({ state: "visible" });
    assert(!(await terms.isChecked()), "Terms checkbox must start unchecked on Payment Step 2.");

    const payButton = page.getByRole("button", { name: /^Pay · \$/i }).first();
    await payButton.waitFor({ state: "visible" });
    assert(await payButton.isDisabled(), "Pay must remain disabled until payment details are ready and policies are accepted.");

    await page.waitForFunction(
      () => !document.body.innerText.includes("Loading secure payment…"),
      undefined,
      { timeout: 15000 },
    );
    const paymentReadyMs = Date.now() - clickStartedAt;

    assert(observedPaymentActions.includes("bootstrap"), "Payment Step 2 did not bootstrap the deferred Stripe Payment Element.");
    assert(!observedPaymentActions.includes("createIntent"), "PaymentIntent was created before the customer pressed Pay.");

    await page.waitForTimeout(1200);
    const checkoutBlocks = blocked.filter((entry) => /\/functions\/v1\/checkout(?:-gateway)?(?:\?|$|\/)/i.test(entry.url));
    assert(!checkoutBlocks.some((entry) => entry.action === "createOrder"), "An order was created before the customer pressed Pay.");
    assert(new URL(page.url()).pathname === "/checkout/payment", "Checkout unexpectedly left Payment Step 2 during the safe deferred-payment probe.");
    assert(pageErrors.length === 0, `Uncaught browser errors: ${pageErrors.join(" | ")}`);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "checkout-fast-start-safe.png"), fullPage: true });
    await fs.writeFile(path.join(ARTIFACT_DIR, "checkout-fast-start-report.json"), JSON.stringify({
      status: "passed",
      target: BASE_URL,
      step: 2,
      termsAccepted: false,
      payEnabled: false,
      paymentReadyMs,
      paymentActions: observedPaymentActions,
      verifiedReadOnlyTaxQuotes: quoteResults,
      blockedCheckoutActions: checkoutBlocks.map((entry) => entry.action).filter(Boolean),
      safety: "Deferred Payment Element rendered before order/PaymentIntent creation; no charge was attempted.",
    }, null, 2));

    console.log(`PASS checkout Michaels-style deferred payment production smoke (${paymentReadyMs}ms to Stripe ready)`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`FAIL checkout fast-start safe production smoke: ${error?.message || error}`);
  process.exit(1);
});
