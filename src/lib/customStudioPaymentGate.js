// Read-only production display gate. The authoritative paid/live predicate
// is also enforced atomically in adminCustomStudioApi.releaseApprovedOrder.
export function productionHandoff(order, design) {
  const paymentStatus = order?.paymentStatus ?? order?.payment_status;
  const mode = order?.paymentMode ?? order?.payment_mode;
  const paid = paymentStatus === "paid";
  const live = mode === "live";
  const qaOnly = mode === "test";
  const locked = design?.renderStatus === "locked";
  const failed = paymentStatus === "failed" || order?.status === "payment_failed";

  if (!paid) return {
    canRelease: false,
    canPrint: false,
    qaOnly,
    label: "Production Blocked",
    detail: failed ? "Payment failed" : "Payment not verified",
  };
  if (!live) return {
    canRelease: false,
    canPrint: false,
    qaOnly,
    label: qaOnly ? "QA Only" : "Production Blocked",
    detail: qaOnly ? "Stripe test order" : "Unverified payment environment",
  };
  return {
    canRelease: true,
    canPrint: locked,
    qaOnly: false,
    label: locked ? "Ready to print" : "Paid live · artwork approval required",
    detail: "",
  };
}
