// Pure policy checks for the future server-only WELCOME10 reservation path.
// These checks are necessary but NOT a substitute for an atomic database transaction.
export const WELCOME_CODE = "WELCOME10";
export const WELCOME_MAX_CAD = 15;

export function normalizeWelcomeEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function welcomeEligibility({
  verifiedEmail,
  verifiedUserId = null,
  guestEmailOwnershipVerified = false,
  previousPaidOrderCount,
  activeReservationForOtherOrder = false,
  otherDiscountApplied = false,
  eligibleSubtotal,
} = {}) {
  const email = normalizeWelcomeEmail(verifiedEmail);
  if (!email) return { eligible: false, reason: "verified_email_required" };
  if (!verifiedUserId && !guestEmailOwnershipVerified) {
    return { eligible: false, reason: "guest_email_verification_required" };
  }
  if (!Number.isSafeInteger(previousPaidOrderCount) || previousPaidOrderCount < 0) {
    return { eligible: false, reason: "paid_order_history_unavailable" };
  }
  if (previousPaidOrderCount !== 0) return { eligible: false, reason: "not_first_paid_order" };
  if (activeReservationForOtherOrder) return { eligible: false, reason: "already_reserved" };
  if (otherDiscountApplied) return { eligible: false, reason: "cannot_stack" };
  if (!Number.isFinite(eligibleSubtotal) || eligibleSubtotal <= 0) {
    return { eligible: false, reason: "no_eligible_merchandise" };
  }
  return { eligible: true, reason: "eligible_for_atomic_reservation" };
}
