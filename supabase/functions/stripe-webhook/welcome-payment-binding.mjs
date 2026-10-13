// Isolated Stripe-to-order binding check; not wired into production webhook.
// Call ONLY after the active webhook has cryptographically verified the Stripe signature.
// Do not accept an event or verification flag supplied by the browser.
export function verifyWelcomePaymentBinding({ event, order, signatureVerified = false }) {
  if (signatureVerified !== true || !event || !order?.id) return { verified: false, reason: "unverified_event" };
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"].includes(event.type)) {
    return { verified: false, reason: "unsupported_event" };
  }
  const obj = event.data?.object;
  const mode = event.livemode === true ? "live" : event.livemode === false ? "test" : null;
  if (!obj || !mode || order.payment_mode !== mode || String(obj.metadata?.order_id || "") !== String(order.id)) {
    return { verified: false, reason: "order_or_mode_mismatch" };
  }
  const intent = event.type === "payment_intent.succeeded" ? obj.id : obj.payment_intent;
  if (event.type !== "payment_intent.succeeded" && obj.payment_status !== "paid") {
    return { verified: false, reason: "payment_not_paid" };
  }
  if (!intent || String(order.stripe_payment_intent_id || "") !== String(intent)) {
    return { verified: false, reason: "payment_intent_mismatch" };
  }
  if (event.type !== "payment_intent.succeeded" &&
      String(order.stripe_checkout_session_id || "") !== String(obj.id || "")) {
    return { verified: false, reason: "session_mismatch" };
  }
  return { verified: true, paymentIntentId: String(intent), eventId: String(event.id || "") };
}
