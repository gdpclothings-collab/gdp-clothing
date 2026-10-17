// Dedicated MFA test helper. Verify exactly once; the admin UI changes
// Verify -> Verifying… while it awaits Supabase MFA + AAL2 confirmation.
// Never bypass or mock the real authentication in production.
export async function submitMfaCodeAndAwaitAal2(page, totpCode, timeout = 45000) {
  if (!/^\d{6}$/.test(String(totpCode))) {
    throw new Error("Smoke MFA code must have exactly six digits.");
  }
  const input = page.locator("#admin-mfa-code");
  await input.fill(totpCode);
  const submit = input.locator("xpath=ancestor::form[1]").locator('button[type="submit"]');
  await submit.click();
  // Give the UI time to render the disabled Verifying… state before awaiting
  // its completion. No second click is permitted while verification runs.
  await page.waitForTimeout(350);
  await page.waitForFunction(() => {
    const codeField = document.querySelector("#admin-mfa-code");
    if (!codeField) return true;
    const button = codeField.closest("form")?.querySelector('button[type="submit"]');
    return Boolean(button && !/Verifying/i.test(button.textContent || ""));
  }, null, { timeout });
  await page.waitForTimeout(350);
  if (await input.isVisible().catch(() => false)) {
    const notice = await page.locator(".text-red-800").first().innerText().catch(() => "");
    const safeNotice = notice.replace(/\b\d{6}\b/g, "[REDACTED]").slice(0, 180);
    throw new Error(`Admin MFA did not complete AAL2 verification: ${safeNotice || "verify form remains visible"}`);
  }
}
