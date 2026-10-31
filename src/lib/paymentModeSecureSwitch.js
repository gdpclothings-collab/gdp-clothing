// The browser never directly updates the restricted store_settings.payment_mode column.
// The database RPC independently verifies admin identity and a real AAL2 session.
export async function requestAdminPaymentModeSwitch(client, expectedMode, nextMode) {
  const validModes = ["test", "live"];
  if (!validModes.includes(expectedMode) || !validModes.includes(nextMode) || expectedMode === nextMode) {
    throw new Error("Invalid payment-mode change. Reload store settings.");
  }

  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw assuranceError;
  if (assurance?.currentLevel !== "aal2") {
    throw new Error("Verify admin MFA (AAL2) before changing payment mode.");
  }

  const { data, error } = await client.rpc("set_admin_payment_mode", {
    p_expected_mode: expectedMode,
    p_next_mode: nextMode,
  });

  if (error) {
    if (error.code === "42501") {
      throw new Error("An authorized admin session with verified MFA (AAL2) is required.");
    }
    if (error.code === "22023") {
      throw new Error("Invalid payment-mode change. Reload store settings.");
    }
    if (error.code === "P0001") {
      throw new Error("Payment mode changed in another session. Reload settings and try again.");
    }
    if (error.code === "P0002") {
      throw new Error("Store settings are missing. Contact the administrator before retrying.");
    }
    throw new Error("Payment mode could not be saved. Please retry after verifying the admin connection.");
  }

  if (data !== nextMode) {
    throw new Error("Payment mode update could not be verified. Reload settings before retrying.");
  }
  return data;
}
