import fs from "node:fs";

const source = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const paymentApi = fs.readFileSync("src/lib/paymentApi.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

const continueStart = source.indexOf("const continueToPayment");
const continueEnd = source.indexOf("const editInformation", continueStart);
const continueBlock = source.slice(continueStart, continueEnd);
const payStart = source.indexOf("const pay = async");
const payEnd = source.indexOf("if (!items.length)", payStart);
const payBlock = source.slice(payStart, payEnd);

const checks = [
  [source.includes('mode:"payment"'), "deferred Payment Element renders without a pre-created intent"],
  [source.includes('currency:"cad"'), "deferred Payment Element uses CAD"],
  [source.includes('paymentMethodOrder:["card"'), "Card is first in the Payment Element"],
  [source.includes('defaultCollapsed:false'), "Card/payment accordion is expanded by default"],
  [source.includes('elements.create("payment"'), "Payment Element mounts directly on Step 2"],
  [!continueBlock.includes("createOrder"), "Continue to payment does not create an order before Step 2"],
  [continueBlock.includes('navigate("/checkout/payment")'), "payment route navigation remains intact"],
  [source.includes("setTimeout(() => beginCheckoutTracking().catch(() => {}), 900)"), "non-critical checkout tracking is delayed off the payment render path"],
  [payBlock.indexOf("paymentClient.elements.submit()") < payBlock.indexOf("customerApi.createOrder"), "payment details are validated before authoritative order creation"],
  [payBlock.indexOf("acceptCheckoutPolicies") < payBlock.indexOf("confirmPayment"), "final policy acceptance remains required before Stripe confirmation"],
  [source.includes("disabled={placing || !paymentClient || !canConfirm || !form.termsAccepted}"), "Pay remains gated by payment readiness and policy acceptance"],
  [paymentApi.includes("bootstrapPromise"), "Stripe bootstrap request is cached"],
  [html.includes('rel="preconnect" href="https://js.stripe.com"'), "Stripe origin is preconnected"],
  [!source.includes("paymentPreparation.current"), "unsafe Step-1 order/session prewarm remains removed"],
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
console.log("Payment fast-start verification passed.");
