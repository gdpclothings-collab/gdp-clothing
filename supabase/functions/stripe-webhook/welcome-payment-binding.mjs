// Only for already signature-verified Stripe webhook events.
// A new order will not have a stored payment_intent_id until finalization,
// so the first confirmation MUST be linked by the persisted Checkout session ID.
// Standalone payment_intent events are accepted only after the intent was stored.
export function verifyWelcomePaymentBinding({ event, order, signatureVerified = false }) {
  if (signatureVerified !== true || !event?.id || !order?.id) {
    return { verified: false, reason: "unverified_event" };
  }
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded",
         "payment_intent.succeeded"].includes(event.type)) {
    return { verified: false, reason: "unsupported_event" };
  }
  const obj = event.data?.object;
  const mode = event.livemode === true ? "live" : event.livemode === false ? "test" : null;
  if (!obj || !mode || order.payment_mode !== mode ||
      String(obj.metadata?.order_id || "") !== String(order.id) ||
      obj.metadata?.payment_mode !== mode) {
    return { verified: false, reason: "order_or_mode_mismatch" };
  }
  if (!["pending", "paid"].includes(order.payment_status)) {
    return { verified: false, reason: "invalid_order_status" };
  }
  const isIntent = event.type === "payment_intent.succeeded";
  if (!isIntent && obj.payment_status !== "paid") {
    return { verified: false, reason: "payment_not_paid" };
  }
  const intent = isIntent ? obj.id : obj.payment_intent;
  if (!intent || typeof intent !== "string" || !intent.startsWith("pi_")) {
    return { verified: false, reason: "payment_intent_missing" };
  }
  if (order.stripe_payment_intent_id &&
      String(order.stripe_payment_intent_id) !== intent) {
    return { verified: false, reason: "payment_intent_mismatch" };
  }
  if (isIntent) {
    // Never trust PaymentIntent metadata alone to claim an as-yet-unlinked order.
    if (!order.stripe_payment_intent_id) {
      return { verified: false, reason: "checkout_session_confirmation_required" };
    }
  } else if (!order.stripe_checkout_session_id ||
             String(order.stripe_checkout_session_id) !== String(obj.id || "")) {
    return { verified: false, reason: "session_mismatch" };
  }
  return { verified: true, paymentIntentId: intent, eventId: event.id };
}
