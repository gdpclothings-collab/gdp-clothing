// Isolated WELCOME10 webhook adapter. Not imported by the active webhook.
// This must remain disabled until dedicated RPC, verified Stripe linkage,
// identity proof, and reconciliation are deployed and tested.
export async function redeemWelcomeOrder({
  service, orderId, order, signedStripeEventVerified = false,
  paymentLinkVerified = false, integrationEnabled = false,
}) {
  if (String(order?.discount_code || "").trim().toUpperCase() !== "WELCOME10") {
    return { handled: false, reason: "ordinary_coupon" };
  }
  if (!integrationEnabled || !signedStripeEventVerified || !paymentLinkVerified) {
    return { handled: true, redeemed: false, reason: "welcome_not_ready" };
  }
  if (!service?.rpc || !orderId || order?.id !== orderId || order?.payment_status !== "paid") {
    return { handled: true, redeemed: false, reason: "invalid_paid_order" };
  }
  try {
    const { data, error } = await service.rpc("redeem_welcome10_coupon", { p_order_id: orderId });
    if (error || data?.redeemed !== true) {
      return { handled: true, redeemed: false, reason: "reconciliation_required" };
    }
    return { handled: true, redeemed: true, existing: data?.existing === true };
  } catch {
    return { handled: true, redeemed: false, reason: "reconciliation_required" };
  }
}
