// Pure, side-effect-free decision logic shared by the admin MFA gate and regression tests.
// A verified factor always takes precedence over an onboarding grace record.
export function decideAdminMfaGate({ currentLevel, totpFactors = [], graceActive = false }) {
  if (currentLevel === "aal2") return "allow";
  if (totpFactors.some((factor) => factor?.status === "verified")) return "challenge";
  return graceActive ? "grace" : "enroll";
}
