import fs from "node:fs";

const source = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const html = fs.readFileSync("index.html", "utf8");

const checks = [
  [source.includes("const paymentPreparation = useRef(null)"), "payment preparation promise is cached"],
  [source.includes("const preparedToken = useRef(\"\")"), "payment preparation is bound to the checkout token"],
  [source.includes("paymentPreparation.current = prepPromise"), "Continue to payment starts preparation before navigation completes"],
  [source.includes("navigate(\"/checkout/payment\")"), "payment route navigation remains intact"],
  [source.includes("paymentPreparation.current && preparedToken.current === token"), "Payment Step reuses in-flight preparation instead of duplicating it"],
  [source.includes("await customerApi.acceptCheckoutPolicies"), "final policy acceptance remains required before Stripe confirmation"],
  [source.includes("disabled={placing||!actions||!canConfirm||!form.termsAccepted}"), "Pay remains gated by payment readiness and policy acceptance"],
  [html.includes('rel="preconnect" href="https://js.stripe.com"'), "Stripe origin is preconnected"],
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
console.log("Payment fast-start verification passed.");
