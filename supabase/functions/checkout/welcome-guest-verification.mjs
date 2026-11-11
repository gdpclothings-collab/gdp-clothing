import { normalizeWelcomeEmail } from "./welcome-policy.mjs";

// This header carries an ephemeral Supabase Auth session obtained by email OTP.
// The server verifies it with Auth; neither a claimed email nor a JWT payload
// decoded by the browser is evidence of ownership on its own.
export const WELCOME_GUEST_HEADER = "x-gdp-welcome-guest-authorization";

export function validGuestProofToken(value) {
  const token = String(value || "");
  return token.length >= 64 && token.length <= 8192 && /^[A-Za-z0-9._-]+$/.test(token)
    ? token
    : null;
}

export function verifiedGuestEmailFromAuth(user, customerEmail) {
  const requested = normalizeWelcomeEmail(customerEmail);
  const verified = normalizeWelcomeEmail(user?.email);
  if (!requested || !verified || requested !== verified || !user?.id ||
      !user?.email_confirmed_at || user?.is_anonymous === true) return null;
  return { email: verified, userId: String(user.id) };
}

export async function verifyGuestWelcomeIdentity(token, customerEmail, getUser) {
  if (!validGuestProofToken(token) || typeof getUser !== "function") return null;
  try {
    const { data, error } = await getUser(token);
    if (error) return null;
    return verifiedGuestEmailFromAuth(data?.user, customerEmail);
  } catch {
    return null;
  }
}
