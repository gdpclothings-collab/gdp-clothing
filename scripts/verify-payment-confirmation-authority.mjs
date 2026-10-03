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

assert(payBlock.includes("actions.confirm()"), "checkout pay handler must still submit through Stripe");
assert(!payBlock.includes("clearCart()"), "client confirm result must not clear the cart before server payment verification");
assert(!payBlock.includes("status=success"), "client confirm result must not manufacture a success URL");
assert(payBlock.includes("The order page") || payBlock.includes("server-side payment_status"), "checkout must document server payment authority");

assert(confirmation.includes('const paid = order?.paymentStatus === "paid"'), "Order Confirmed must depend on server payment_status");
assert(!confirmation.includes('status === "success"'), "URL success flags must not mark an order paid");
assert(confirmation.includes("window.setInterval(refresh, 2000)"), "pending redirect payments must be rechecked server-side");
assert(confirmation.includes("if (!paid && <Link") || confirmation.includes("{!paid && <Link"), "unpaid orders must offer a safe return to checkout");
assert(confirmation.includes("paid && order.items?.some"), "production-ready custom messaging must be paid-only");

assert(webhook.includes('event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"'), "webhook must handle delayed-payment success");
assert(webhook.includes('session?.payment_status !== "paid"'), "webhook must not finalize unpaid Checkout Sessions");
assert(webhook.includes('payment_status: "paid"'), "verified paid sessions must still finalize orders");

console.log("Payment confirmation authority regression checks passed.");
