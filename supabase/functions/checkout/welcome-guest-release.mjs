// Default-OFF switch for the not-yet-released WELCOME10 guest OTP flow.
// This is independent of public.discounts.active so existing account-based
// WELCOME10 purchases remain unaffected by guest rollout decisions.
export function welcomeGuestOtpReleaseEnabled(value) {
  return value === "true";
}
