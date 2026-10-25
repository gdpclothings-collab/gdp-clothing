import fs from "node:fs";
import assert from "node:assert/strict";
import { productionHandoff } from "../src/lib/customStudioPaymentGate.js";

const checkout = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const confirmation = fs.readFileSync("src/pages/OrderConfirmation.jsx", "utf8");
const admin = fs.readFileSync("src/components/admin/CustomStudioAdminModule.jsx", "utf8");
const adminApi = fs.readFileSync("src/lib/adminCustomStudioApi.js", "utf8");
const paymentSession = fs.readFileSync("supabase/functions/payment-session/index.ts", "utf8");
const webhook = fs.readFileSync("supabase/functions/stripe-webhook/index.ts", "utf8");

const locked = { renderStatus:"locked" };
for (const paymentStatus of ["pending", "failed", null]) {
  const result = productionHandoff({ paymentStatus, paymentMode:"live" }, locked);
  assert.equal(result.canPrint, false, "Unpaid artwork must never say ready to print");
  assert.equal(result.canRelease, false, "Unpaid artwork must never be releasable");
}
assert.equal(productionHandoff({ paymentStatus:"paid", paymentMode:"test" }, locked).canRelease, false);
assert.equal(productionHandoff({ paymentStatus:"paid", paymentMode:"live" }, locked).canPrint, true);
assert.equal(productionHandoff({ paymentStatus:"paid", paymentMode:"live" }, { renderStatus:"draft" }).canPrint, false);

assert(checkout.includes("if (placingRef.current) return"), "Pay must have a synchronous double-submit guard");
assert(checkout.includes('status=pending'), "Client navigation must not claim paid before the webhook");
assert(checkout.includes("intentStatus") && checkout.includes('"requires_payment_method"'), "Payment intent result must be checked");
assert(confirmation.includes("stripeSucceededButUnconfirmed"), "Order page must flag missing webhook reconciliation");
assert(confirmation.includes("Please do not pay again"), "Order page must warn about double-payment risk");
assert(admin.includes("handoff.canRelease &&"), "Admin release button must be gated by verified payment");
assert(admin.includes("handoff.canPrint"), "Admin print label must be gated by verified payment");
assert(adminApi.includes('.eq("payment_status", "paid")') && adminApi.includes('.eq("payment_mode", "live")'), "Release update must have atomic paid/live database predicates");
assert(adminApi.includes("createSignedUrls(visiblePaths, 3600)"), "Private upload thumbnails must be signed in a batch");

const inspectStart = paymentSession.indexOf("async function inspectIntent(");
const inspectEnd = paymentSession.indexOf("Deno.serve(", inspectStart);
assert(inspectStart > 0 && inspectEnd > inspectStart, "Read-only status inspection endpoint must exist");
const inspect = paymentSession.slice(inspectStart, inspectEnd);
assert(inspect.includes('uuidRe.test(confirmationToken)'), "Status inspection must require a valid order token");
assert(inspect.includes('.eq("confirmation_token", confirmationToken)'), "Status inspection must verify order ownership");
assert(inspect.includes('metadata?.order_id'), "Status inspection must verify PaymentIntent order binding");
assert(!/\.update\(|\.insert\(|\.delete\(/.test(inspect), "Status inspection must never mutate orders");
assert(webhook.includes('event.type === "payment_intent.succeeded"') && webhook.includes("verifyStripeSignature"), "Only signed success webhooks may finalize payment");

console.log("PASS GDP test checkout V1 payment safeguards, admin gating, and read-only inspection");
