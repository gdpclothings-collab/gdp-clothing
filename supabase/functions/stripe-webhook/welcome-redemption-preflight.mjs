// Future webhook preflight: no mutation, no reliance on untrusted Stripe metadata.
// Call only after Stripe signature verification and lookup of the canonical order.
// The payment has already occurred at Stripe: failures must be surfaced for
// manual reconciliation, never silently treated as a successful redemption.
export async function checkWelcomePaidOrderReservation({ service, order }) {
  if (String(order?.discount_code || "").trim().toUpperCase() !== "WELCOME10") {
    return { ok: true, reason: "ordinary_order" };
  }
  if (!service?.from || !order?.id) return { ok: false, reason: "missing_order" };
  const { data, error } = await service.from("order_coupon_reservations")
    .select("order_id,discount_id,status,expires_at")
    .eq("order_id", order.id)
    .maybeSingle();
  if (error || !data) return { ok: false, reason: "reservation_missing" };
  if (data.status === "consumed") return { ok: true, reason: "already_consumed" };
  if (data.status !== "active") return { ok: false, reason: "reservation_not_active" };
  if (!data.expires_at || !Number.isFinite(Date.parse(data.expires_at))) {
    return { ok: false, reason: "reservation_expiry_invalid" };
  }
  // Stripe may confirm payment after the original reservation expiry.
  // Do not release or deny a legitimately paid order solely on expiry here:
  // reconciliation must consult Stripe's authoritative payment timestamp.
  return { ok: true, reason: "reservation_present_requires_atomic_redemption", discountId: data.discount_id };
}
