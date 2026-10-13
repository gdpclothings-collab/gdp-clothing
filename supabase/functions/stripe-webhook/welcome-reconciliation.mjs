// Isolated WELCOME10 reconciliation writer. Not imported by the active webhook.
// Invoke only after signature verification AND independently verified order/payment binding.
// Never expose the service-role client to browser code.
export async function recordWelcomeReconciliation({
  service, orderId, eventId, paymentIntentId, paymentMode,
  reason, verifiedPaymentBinding = false, integrationEnabled = false,
}) {
  if (!integrationEnabled || !verifiedPaymentBinding) return { recorded: false, reason: "not_verified" };
  if (!service?.rpc || !orderId || !eventId || !paymentIntentId ||
      !["test", "live"].includes(paymentMode) || !reason) {
    return { recorded: false, reason: "invalid_input" };
  }
  try {
    const { error } = await service.rpc("record_welcome10_reconciliation", {
      p_order_id: orderId, p_stripe_event_id: eventId,
      p_payment_intent_id: paymentIntentId, p_payment_mode: paymentMode,
      p_error_code: String(reason).slice(0, 80),
    });
    return error ? { recorded: false, reason: "persistence_failed" } : { recorded: true };
  } catch {
    return { recorded: false, reason: "persistence_failed" };
  }
}
