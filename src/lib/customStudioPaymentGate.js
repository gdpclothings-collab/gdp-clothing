// Artwork may be approved before checkout, but payment and live-mode verification
// are separate requirements for releasing physical production.
export function productionHandoff(order, design) {
  const paid = order?.paymentStatus === "paid";
  const live = (order?.paymentMode || order?.payment_mode) === "live";
  const locked = design?.renderStatus === "locked";
  const failed = order?.paymentStatus === "failed" || order?.status === "payment_failed";

  if (!paid) return {
    canRelease: false,
    canPrint: false,
    label: failed ? "Payment failed · production blocked" : "Awaiting payment · production blocked",
  };
  if (!live) return {
    canRelease: false,
    canPrint: false,
    label: "Test payment · production disabled",
  };
  return {
    canRelease: true,
    canPrint: locked,
    label: locked ? "Ready to print" : "Paid · artwork approval required",
  };
}
