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

assert(confirmation.includes('const paid = order?.paymentStatus === "paid"'), "Order Confirmed must depend on server payment_status");
assert(!confirmation.includes('status === "success"'), "URL success flags must not mark an order paid");
assert(confirmation.includes("window.setInterval(refresh, 2000)"), "pending redirect payments must be rechecked server-side");
assert(confirmation.includes("if (!paid && <Link") || confirmation.includes("{!paid && <Link"), "unpaid orders must offer a safe return to checkout");
assert(confirmation.includes("paid && order.items?.some"), "production-ready custom messaging must be paid-only");

assert(webhook.includes('event.type === "checkout.session.completed"'), "webhook must preserve legacy Checkout Session success handling during migration");
assert(webhook.includes('event.type === "checkout.session.async_payment_succeeded"'), "webhook must preserve delayed Checkout Session success handling");
assert(webhook.includes('event.type === "payment_intent.succeeded"'), "webhook must finalize Michaels-style direct PaymentIntent success");
assert(webhook.includes('paymentObject?.payment_status !== "paid"'), "legacy Checkout Sessions must not finalize before Stripe marks them paid");
assert(webhook.includes('payment_status: "paid"'), "verified Stripe success must still finalize orders");
assert(webhook.includes("finalizePaidOrder"), "all verified Stripe success paths must share one paid-order finalizer");

console.log("Payment confirmation authority regression checks passed.");
