import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabasePublishableKey } from "@/lib/supabaseClient";

// Isolated in-memory client: OTP verification never signs the storefront's
// main AuthContext in, and tokens are never persisted in browser storage.
const otpClient = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let guestProof = null;
const emailKey = (value) => String(value || "").trim().toLowerCase();

export function clearWelcomeGuestProof() {
  guestProof = null;
}

export function welcomeGuestTokenFor(email) {
  if (!guestProof || guestProof.email !== emailKey(email) ||
      guestProof.expiresAt <= Date.now() + 30_000) return null;
  return guestProof.token;
}

export async function sendWelcomeGuestOtp(email) {
  clearWelcomeGuestProof();
  const normalized = emailKey(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid email address first.");
  }
  // Supabase's existing email OTP transport is reused; no third-party email
  // provider is added. For a new email, Supabase creates a passwordless Auth
  // identity. The user is told this explicitly in the checkout UI.
  const { error } = await otpClient.auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyWelcomeGuestOtp(email, code) {
  clearWelcomeGuestProof();
  const normalized = emailKey(email);
  if (!/^\d{6,8}$/.test(String(code || "").trim())) {
    throw new Error("Enter the verification code from your email.");
  }
  const { data, error } = await otpClient.auth.verifyOtp({
    email: normalized, token: String(code).trim(), type: "email",
  });
  if (error) throw error;
  if (!data?.session?.access_token || !data?.user?.email_confirmed_at ||
      emailKey(data.user.email) !== normalized) {
    throw new Error("The verified email did not match your checkout email.");
  }
  guestProof = {
    email: normalized,
    token: data.session.access_token,
    expiresAt: Date.now() + Math.max(0, Number(data.session.expires_in || 0)) * 1000,
  };
  return true;
}
