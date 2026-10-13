// Supabase Auth intentionally uses non-identifying responses for repeat signups.
// Never infer from a success result that an account was newly created or an
// email was actually sent. This message must be identical for new and existing
// addresses, including administrator addresses.
export const REGISTRATION_REQUEST_TITLE = "Check your account";
export const REGISTRATION_REQUEST_SUBTITLE =
  "Verification instructions are sent only if your email needs confirmation.";
export const REGISTRATION_REQUEST_DESCRIPTION =
  "If this email address needs verification, a confirmation link may arrive shortly. Check your inbox and spam folder.";
export const REGISTRATION_EXISTING_ACCOUNT_HINT =
  "Already registered? Sign in with your existing password, or use Forgot password. Registering again does not change your password.";
export const VERIFICATION_RESEND_FEEDBACK =
  "If this address still needs verification, check your inbox and spam folder. No email? Sign in or reset your password, or try again later.";

// Some Auth configurations return a generic user-shaped response for an
// existing account; others return user_already_exists. Treat those alike.
// Other actual signup errors still surface so people can fix the problem.
export function registrationNextStep({ data, error }) {
  if (error) {
    const code = String(error.code || "").toLowerCase();
    const message = String(error.message || "").toLowerCase();
    if (
      code === "user_already_exists" ||
      /\b(user already registered|email already registered|already been registered)\b/.test(message)
    ) {
      return "check-account";
    }
    throw error;
  }
  return data?.session ? "signed-in" : "check-account";
}
