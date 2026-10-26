// Read-only payment classification shared by the admin production entry points.
// The database trigger is the authoritative safeguard against stale UI state.
export function productionPaymentGate(order = {}) {
  const paymentStatus = order.paymentStatus ?? order.payment_status;
  const paymentMode = order.paymentMode ?? order.payment_mode;

  if (paymentStatus !== "paid") {
    return {
      canRelease: false,
      label: "Production Blocked",
      detail: paymentStatus === "failed" ? "Payment failed" : "Payment not verified",
    };
  }
  if (paymentMode !== "live") {
    return {
      canRelease: false,
      label: paymentMode === "test" ? "QA Only" : "Production Blocked",
      detail: paymentMode === "test" ? "Stripe test order — never print" : "Unverified payment environment",
    };
  }
  return { canRelease: true, label: "Paid Live", detail: "Production checklist and artwork approval still apply" };
}

export function enteringProduction(currentStatus, nextStatus) {
  return currentStatus === "not_started" && Boolean(nextStatus) && nextStatus !== "not_started";
}
