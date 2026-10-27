import fs from "node:fs";

const checkout = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const confirmation = fs.readFileSync("src/pages/OrderConfirmation.jsx", "utf8");
const webhook = fs.readFileSync("supabase/functions/stripe-webhook/index.ts", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`PAYMENT CONFIRMATION REGRESSION: ${message}`);
    process.exit(1);
  }
}

const payStart = checkout.indexOf("const pay = async () =>");
const emptyCartStart = checkout.indexOf("if (!items.length)", payStart);
const payBlock = payStart >= 0 && emptyCartStart > payStart
  ? checkout.slice(payStart, emptyCartStart)
  : "";

assert(payBlock.includes("paymentClient.elements.submit()"), "checkout must validate the deferred Payment Element before creating the authoritative order");
assert(payBlock.includes("paymentClient.stripe.confirmPayment"), "checkout pay handler must still submit through Stripe");
assert(payBlock.includes("await customerApi.acceptCheckoutPolicies"), "checkout policy acceptance must still be recorded before payment confirmation");
assert(payBlock.indexOf("acceptCheckoutPolicies") < payBlock.indexOf("confirmPayment"), "policy acceptance must occur before Stripe confirmation");
assert(payBlock.includes("orderData?.paid"), "a resumed checkout must trust the server paid state before treating the order as paid");
assert(payBlock.indexOf("clearCart()") > payBlock.indexOf("orderData?.paid"), "cart clearing must only occur behind a server-verified paid response");
assert(payBlock.includes('redirect:"if_required"'), "Stripe confirmation must preserve redirect-capable payment methods");

assert(checkout.includes("const payInFlightRef = useRef(false);"), "checkout must retain a synchronous duplicate-pay guard");
assert(payBlock.includes("if (payInFlightRef.current) return;"), "second Pay click must exit synchronously");
assert(payBlock.indexOf("payInFlightRef.current = true;") > payBlock.indexOf("if (payInFlightRef.current) return;"), "guard must lock before async work");
assert(payBlock.indexOf("payInFlightRef.current = true;") < payBlock.indexOf("customerApi.createOrder"), "guard must lock before order creation");
assert(payBlock.indexOf("payInFlightRef.current = false;") > payBlock.indexOf("confirmPayment"), "guard must release in final cleanup to allow a safe retry");
assert(payBlock.includes('setPaymentProgress("checking")') && payBlock.includes('setPaymentProgress("preparing")') && payBlock.includes('setPaymentProgress("verifying")'), "payment stages must follow actual checkout operations");
assert(checkout.includes('role="status" aria-live="polite" aria-atomic="true"'), "secure payment progress must be accessible");
assert(checkout.includes("disabled={placing || !paymentClient || !canConfirm || !form.termsAccepted}"), "Pay button must remain disabled while an attempt is in flight");
assert(!checkout.includes('"Processing order…"'), "generic long-running processing copy should be retired");
assert(checkout.includes('`Pay · $${total.toFixed(2)}`'), "Pay button must retain currency formatting");


assert(confirmation.includes('const paid = order?.paymentStatus === "paid"'), "Order Confirmed must depend on server payment_status");
assert(!confirmation.includes('status === "success"'), "URL success flags must not mark an order paid");
assert(confirmation.includes("window.setInterval(refresh, 2000)"), "pending redirect payments must be rechecked server-side");
assert(confirmation.includes('{failed && <Link to="/checkout/payment"'), "only confirmed failed payments may offer a checkout retry");
assert(!confirmation.includes('{!paid && <Link'), "unresolved payments must not invite duplicate payment attempts");
assert(confirmation.includes("Please do not submit another payment while this status is unresolved."), "expired verification must discourage an unsafe repeat payment");
assert(confirmation.includes("Please do not submit another payment yet."), "unavailable order state must discourage an unsafe repeat payment");
assert(confirmation.includes("paid && order.items?.some"), "production-ready custom messaging must be paid-only");
assert(confirmation.includes('"FINALIZING YOUR ORDER"'), "brief pending verification must be described as order finalization");
assert(confirmation.includes('"PAYMENT NOT YET CONFIRMED"'), "unresolved payment must retain an honest pending state");
assert(confirmation.includes("setVerificationExpired(true)"), "verification messaging must stop promising automatic updates after polling stops");
assert(confirmation.includes('"ORDER STATUS UNAVAILABLE"'), "missing server response must not be treated as a payment success");
assert(!confirmation.includes('"PAYMENT PENDING"'), "old alarming intermediate heading must be retired");

assert(webhook.includes('event.type === "checkout.session.completed"'), "webhook must preserve legacy Checkout Session success handling during migration");
assert(webhook.includes('event.type === "checkout.session.async_payment_succeeded"'), "webhook must preserve delayed Checkout Session success handling");
assert(webhook.includes('event.type === "payment_intent.succeeded"'), "webhook must finalize Michaels-style direct PaymentIntent success");
assert(webhook.includes('paymentObject?.payment_status !== "paid"'), "legacy Checkout Sessions must not finalize before Stripe marks them paid");
assert(webhook.includes('payment_status: "paid"'), "verified Stripe success must still finalize orders");
assert(webhook.includes("finalizePaidOrder"), "all verified Stripe success paths must share one paid-order finalizer");

// Invalid or absent payment-mode configuration must NEVER silently select live keys.
// Exercise the three TypeScript normalizers directly, including their failure path.
for (const filename of [
  "supabase/functions/checkout-gateway/index.ts",
  "supabase/functions/payment-session/index.ts",
  "supabase/functions/payment-preflight/index.ts",
]) {
  const source = fs.readFileSync(filename, "utf8");
  const extracted = source.match(/function normalizePaymentMode\(value: unknown\)(?:: "(?:live|test)" \| "(?:live|test)")? \{([\s\S]*?)\n\}/);
  assert(Boolean(extracted), filename + ": missing explicit payment mode normalizer");
  const normalize = new Function("value", extracted[1]);
  assert(normalize("live") === "live" && normalize("test") === "test", filename + ": valid modes should round-trip");
  for (const invalid of [null, undefined, "", "LIVE", "unknown", 0]) {
    let rejected = false;
    try { normalize(invalid); } catch { rejected = true; }
    assert(rejected, filename + ": invalid value must fail closed, never default to live");
  }
}

const checkoutCore = fs.readFileSync("supabase/functions/checkout/index.ts", "utf8");
assert(checkoutCore.includes('const paymentMode = storeSettings?.payment_mode;'), "checkout core must read exact payment mode");
assert(checkoutCore.includes('paymentMode !== "test" && paymentMode !== "live"'), "checkout core must reject missing/invalid mode");
assert(!checkoutCore.includes('storeSettings?.payment_mode === "test" ? "test" : "live"'), "checkout core must not default to live");


// Execute the actual Pay handler with isolated fakes. No network calls, orders,
// Stripe intents or charges are created during these concurrency regressions.
const handlerEnd = checkout.indexOf("\n  const paymentProgressText", payStart);
assert(payStart >= 0 && handlerEnd > payStart, "mock QA could not isolate the Pay handler");
const handlerSource = checkout.slice(payStart, handlerEnd);

function mockPaymentAttempt() {
  const trace = [];
  const count = { submits: 0, orders: 0, confirmations: 0, navigations: 0 };
  const payInFlightRef = { current: false };
  let releaseFirstSubmit;
  const firstSubmit = new Promise((resolve) => { releaseFirstSubmit = resolve; });
  const env = {
    payInFlightRef,
    setError: (message) => trace.push(["error", message]),
    form: { termsAccepted: true, email: "qa@example.invalid", postalCode: "S7K2A1" },
    paymentClient: {
      elements: {
        submit: async () => { count.submits++; return count.submits === 1 ? firstSubmit : {}; },
        update: () => {},
      },
      stripe: { confirmPayment: async () => { count.confirmations++; return {}; } },
    },
    canConfirm: true,
    setPlacing: (value) => trace.push(["placing", value]),
    setPaymentProgress: (value) => trace.push(["progress", value]),
    ensureToken: () => "qa-token",
    normalizePostal: () => "S7K 2A1",
    items: [{ productId: "mock", quantity: 1, price: 12 }],
    subtotal: 12, quantityDiscount: 0, coupon: 0, shipping: 0, tax: 0, total: 12,
    tracking: { current: null }, trackedToken: { current: "" },
    customerApi: {
      trackCheckout: async () => {},
      createOrder: async () => {
        count.orders++;
        return {
          orderNumber: "QA-ORDER", confirmationToken: "qa-confirm",
          clientSecret: "pi_mock_secret", paymentIntentId: "pi_mock",
          pricing: { total: 12 },
        };
      },
      acceptCheckoutPolicies: async () => {},
    },
    applyAuthoritativePricing: () => {},
    paymentApi: { createPaymentIntent: async () => { throw new Error("unexpected fallback"); } },
    navigate: () => { count.navigations++; },
    clearCart: () => { throw new Error("unverified payment must not clear cart"); },
    cents: () => 1200,
    window: { location: { origin: "https://checkout-qa.invalid" } },
  };
  const pay = new Function(...Object.keys(env), handlerSource + "\nreturn pay;")(...Object.values(env));
  return { pay, releaseFirstSubmit, trace, count, payInFlightRef };
}

const simultaneous = mockPaymentAttempt();
const activePayment = simultaneous.pay();
await simultaneous.pay();
assert(simultaneous.count.submits === 1 && simultaneous.count.orders === 0, "rapid repeat Pay click must not submit again");
assert(simultaneous.payInFlightRef.current, "in-flight guard must remain locked while Stripe validation is pending");
simultaneous.releaseFirstSubmit({});
await activePayment;
assert(simultaneous.count.orders === 1 && simultaneous.count.confirmations === 1 && simultaneous.count.navigations === 1, "one valid click must create only one mocked order and Stripe confirmation");
assert(!simultaneous.payInFlightRef.current, "completed Pay attempt must release the guard");
assert(
  JSON.stringify(simultaneous.trace.filter(([kind]) => kind === "progress").map(([, stage]) => stage)) ===
  JSON.stringify(["checking", "preparing", "verifying", "idle"]),
  "progress messages must match the existing async checkout stages"
);

const failedThenRetried = mockPaymentAttempt();
const firstAttempt = failedThenRetried.pay();
failedThenRetried.releaseFirstSubmit({ error: { message: "QA card validation failed" } });
await firstAttempt;
assert(failedThenRetried.count.orders === 0 && failedThenRetried.count.confirmations === 0, "invalid card must not create an order or confirm payment");
assert(!failedThenRetried.payInFlightRef.current, "failed Pay attempt must release the guard");
await failedThenRetried.pay();
assert(failedThenRetried.count.submits === 2 && failedThenRetried.count.orders === 1 && failedThenRetried.count.confirmations === 1, "deliberate retry after error must remain possible");

console.log("Payment confirmation authority regression checks passed.");
