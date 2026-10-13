// Server-side adapter for the existing checkout reservation RPC.
// This is an isolated helper: checkout must NOT call it for WELCOME10 until
// the database RPC is extended to atomically enforce first-paid-order identity.
export async function reserveWelcomeOrder({
  service,
  orderId,
  discountId,
  expiresAt,
  identityVerified,
  paidHistoryChecked,
  atomicIdentityConstraintEnabled,
}) {
  // Never call the legacy RPC for WELCOME10 without a database-enforced identity lock.
  if (!identityVerified || !paidHistoryChecked || !atomicIdentityConstraintEnabled) {
    return { reserved: false, reason: "welcome_reservation_not_secure" };
  }
  if (!service?.rpc || !orderId || !discountId || !expiresAt) {
    return { reserved: false, reason: "invalid_reservation_input" };
  }
  const { data, error } = await service.rpc("reserve_order_coupon", {
    p_order_id: orderId,
    p_discount_id: discountId,
    p_expires_at: expiresAt,
  });
  if (error) return { reserved: false, reason: "reservation_failed" };
  // A successful RPC is meaningful only once its database implementation
  // atomically enforces welcome identity and paid-order history.
  return { reserved: true, data };
}
