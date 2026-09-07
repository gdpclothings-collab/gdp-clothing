import { supabase } from "@/lib/supabaseClient";

async function invoke(action) {
  const { data, error } = await supabase.functions.invoke("admin-mfa-security", {
    body: { action },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.message || "Admin MFA security operation failed.");
  return data?.data ?? null;
}

export const adminMfaSecurityApi = {
  getState() {
    return invoke("get_state");
  },
  clearUnverifiedTotp() {
    return invoke("clear_unverified_totp");
  },
  recordVerified() {
    return invoke("record_verified");
  },
};
