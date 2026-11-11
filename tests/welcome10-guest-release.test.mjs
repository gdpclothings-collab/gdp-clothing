import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { welcomeGuestOtpReleaseEnabled } from "../supabase/functions/checkout/welcome-guest-release.mjs";

test("guest OTP release flag is fail-closed by default", () => {
  for (const val of [undefined, null, "", "false", "TRUE", "1", "enabled", "true "]) {
    assert.equal(welcomeGuestOtpReleaseEnabled(val), false);
  }
  assert.equal(welcomeGuestOtpReleaseEnabled("true"), true);
});

test("guest release guard is separate from existing verified-account WELCOME10", () => {
  const server = readFileSync("supabase/functions/checkout/index.ts", "utf8");
  const accountFirst = server.indexOf("if (account) {", server.indexOf("async function welcomeVerifiedIdentity("));
  const guestFlag = server.indexOf("if (!welcomeGuestOtpReleased()) return null;", accountFirst);
  const guestToken = server.indexOf("const token = req.headers.get(WELCOME_GUEST_HEADER);", guestFlag);
  assert.ok(accountFirst >= 0 && guestFlag > accountFirst && guestToken > guestFlag);
  assert.match(server, /Deno\.env\.get\("GDP_WELCOME10_GUEST_OTP_ENABLED"\)/);
  assert.match(server, /guestOtpEnabled: Boolean\(campaign\) && welcomeGuestOtpReleased\(\)/);
});

test("guest UI does not send OTP or enter guest verification while flag is OFF", () => {
  const customer = readFileSync("src/lib/customerApi.js", "utf8");
  const checkout = readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
  assert.match(customer, /guestOtpEnabled: data\?\.guestOtpEnabled === true/);
  assert.match(checkout, /if \(!status\.guestOtpEnabled\) return setError/);
  assert.match(checkout, /if \(!status\.guestOtpEnabled\) throw new Error/);
  assert.match(checkout, /if \(!status\.enabled \|\| !status\.guestOtpEnabled\) throw new Error/);
});
