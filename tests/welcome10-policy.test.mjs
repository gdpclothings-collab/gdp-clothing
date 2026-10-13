import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWelcomeEmail, welcomeEligibility } from "../supabase/functions/checkout/welcome-policy.mjs";

const valid = { verifiedEmail: " FIRST@EXAMPLE.COM ", verifiedUserId: "server-verified-user", previousPaidOrderCount: 0, eligibleSubtotal: 100 };
test("email normalization is stable", () => {
  assert.equal(normalizeWelcomeEmail(" FIRST@EXAMPLE.COM "), "first@example.com");
  assert.equal(normalizeWelcomeEmail("not-an-email"), null);
});
test("verified first-time account is eligible for reservation review", () => {
  assert.deepEqual(welcomeEligibility(valid), { eligible: true, reason: "eligible_for_atomic_reservation" });
});
test("unverified guest cannot claim the discount", () => {
  assert.equal(welcomeEligibility({ ...valid, verifiedUserId: null }).reason, "guest_email_verification_required");
});
test("verified guest can pass preliminary eligibility", () => {
  assert.equal(welcomeEligibility({ ...valid, verifiedUserId: null, guestEmailOwnershipVerified: true }).eligible, true);
});
test("unknown history fails closed", () => {
  assert.equal(welcomeEligibility({ ...valid, previousPaidOrderCount: undefined }).reason, "paid_order_history_unavailable");
});
test("previous paid order makes welcome coupon ineligible", () => {
  assert.equal(welcomeEligibility({ ...valid, previousPaidOrderCount: 1 }).reason, "not_first_paid_order");
});
test("concurrent reservation must be rejected", () => {
  assert.equal(welcomeEligibility({ ...valid, activeReservationForOtherOrder: true }).reason, "already_reserved");
});
test("no stacking and no ineligible cart", () => {
  assert.equal(welcomeEligibility({ ...valid, otherDiscountApplied: true }).reason, "cannot_stack");
  assert.equal(welcomeEligibility({ ...valid, eligibleSubtotal: 0 }).reason, "no_eligible_merchandise");
});
