import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

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
    const writeMethod = !["GET", "HEAD", "OPTIONS"].includes(method);

    let action = null;
    try { action = request.postDataJSON()?.action || null; } catch {}
    if (/\/functions\/v1\/payment-session(?:\?|$|\/)/i.test(url) && action) {
      observedPaymentActions.push(action);
    }

    const protectedTarget =
      /\/functions\/v1\/checkout(?:-gateway)?(?:\?|$|\/)/i.test(url) ||
      /\/rest\/v1\/(orders|order_items|inventory|inventory_reservations|payments)(?:\?|$|\/)/i.test(url);

    if (writeMethod && protectedTarget) {
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
    await page.addInitScript(() => {
      window.localStorage.setItem("gdp_cart_v2__guest", JSON.stringify([
        {
          productId: "wiring-fallback-product",
          variantId: "wiring-fallback-variant",
          key: "wiring-fallback-item",
          name: "GDP Wiring Canary",
          price: 1,
          quantity: 1,
          size: "M",
          color: "Black",
          image: "/images/gdp-tshirt.svg",
        },
      ]));
    });

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
    await page.locator("#checkout-postal-code").fill("S7K 0J5");

    const continueButton = page.getByRole("button", { name: /Continue to payment/i }).first();
    await continueButton.waitFor({ state: "visible" });
    assert(await continueButton.isEnabled(), "Continue to payment did not enable after required checkout fields were completed.");

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
