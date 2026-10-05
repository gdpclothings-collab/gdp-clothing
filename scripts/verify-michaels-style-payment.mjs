import fs from "node:fs";

const checkout = fs.readFileSync("src/pages/CheckoutTwoStepMichaels.jsx", "utf8");
const alias = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const paymentApi = fs.readFileSync("src/lib/paymentApi.js", "utf8");
const paymentSession = fs.readFileSync("supabase/functions/payment-session/index.ts", "utf8");
const webhook = fs.readFileSync("supabase/functions/stripe-webhook/index.ts", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const continueStart = checkout.indexOf("const continueToPayment");
const continueEnd = checkout.indexOf("const editInformation", continueStart);
const continueBlock = checkout.slice(continueStart, continueEnd);
const payStart = checkout.indexOf("const pay = async");
const payEnd = checkout.indexOf("if (!items.length)", payStart);
const payBlock = checkout.slice(payStart, payEnd);

assert(alias.includes("CheckoutTwoStepMichaels"), "Checkout route is not using the Michaels-style implementation.");
assert(checkout.includes('mode:"payment"'), "Deferred Payment Element mode is missing.");
assert(checkout.includes('currency:"cad"'), "Deferred Payment Element currency is missing.");
assert(checkout.includes('defaultCollapsed:false'), "Payment Element is not configured to expand by default.");
assert(checkout.includes('paymentMethodOrder:["card"'), "Card is not first in payment method order.");
assert(checkout.includes('elements.create("payment"'), "Payment Element is not mounted from deferred Elements.");
assert(!continueBlock.includes("createOrder"), "Continue to payment must not create an order before Step 2 renders.");
assert(payBlock.indexOf("elements.submit()") >= 0, "Payment details are not validated before authoritative order creation.");
assert(payBlock.indexOf("elements.submit()") < payBlock.indexOf("customerApi.createOrder"), "Order creation happens before Payment Element validation.");
assert(payBlock.includes("paymentApi.createPaymentIntent"), "Authoritative order is not bridged to a PaymentIntent.");
assert(payBlock.indexOf("acceptCheckoutPolicies") < payBlock.indexOf("confirmPayment"), "Checkout consent is not recorded before payment confirmation.");
assert(payBlock.includes('redirect:"if_required"'), "Payment confirmation redirect handling is not configured.");
assert(checkout.includes("setTimeout(() => beginCheckoutTracking().catch(() => {}), 900)"), "Non-critical checkout tracking is not deferred off the payment render path.");

assert(paymentApi.includes("bootstrapPromise"), "Payment bootstrap is not cached for Step 2.");
assert(paymentSession.includes('action === "bootstrap"'), "Payment bootstrap endpoint is missing.");
assert(paymentSession.includes('action === "createIntent"'), "PaymentIntent bridge endpoint is missing.");
assert(paymentSession.includes('form.set("amount", String(expectedAmount))'), "PaymentIntent amount is not server-authoritative.");
assert(paymentSession.includes('form.set("automatic_payment_methods[enabled]", "true")'), "Automatic payment methods are not enabled.");
assert(paymentSession.includes('scrub.set("metadata[order_id]", "")'), "Legacy Checkout Session order metadata is not scrubbed before retirement.");
assert(paymentSession.indexOf('scrub.set("metadata[order_id]", "")') < paymentSession.indexOf('/expire`'), "Legacy Checkout Session is expired before metadata is scrubbed.");
assert(paymentSession.includes('stripe_payment_intent_id: paymentIntent.id'), "PaymentIntent is not linked to the GDP order.");
assert(paymentSession.includes('stripe_checkout_session_id: null'), "Legacy Checkout Session linkage is not cleared after the bridge.");

assert(webhook.includes('event.type === "payment_intent.succeeded"'), "Webhook does not accept direct PaymentIntent success.");
assert(webhook.includes("finalizePaidOrder"), "Paid-order finalization is not shared across Stripe success paths.");
assert(webhook.includes('service.rpc("apply_paid_order_inventory"'), "Paid inventory allocation is missing from the shared finalizer.");
assert(webhook.includes('service.rpc("redeem_order_coupon"'), "Coupon redemption is missing from the shared finalizer.");
assert(webhook.includes("handleStripeDispute"), "Existing dispute handling was not preserved.");
assert(webhook.includes('event.type === "charge.refunded"'), "Existing refund handling was not preserved.");

console.log("PASS Michaels-style deferred payment architecture verification");
