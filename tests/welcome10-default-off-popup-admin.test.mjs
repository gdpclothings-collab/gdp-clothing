import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("WELCOME10 popup does not promise guest OTP when its release flag is off", () => {
  const popup = readFileSync("src/components/storefront/Welcome10Popup.jsx", "utf8");
  assert.match(popup, /guestOtpEnabled: guestAvailable/);
  assert.match(popup, /setGuestOtpEnabled\(guestAvailable === true\)/);
  assert.match(popup, /guestOtpEnabled \? "Sign in or verify your email as a guest/);
  assert.match(popup, /"Sign in with your verified GDP Clothing account/);
});

test("existing active WELCOME10 can still be edited; disabled campaign cannot be silently enabled", () => {
  const admin = readFileSync("src/lib/adminDiscountsApi.js", "utf8");
  assert.match(admin, /if \(!id\) throw new Error\("WELCOME10 requires final release approval before activation\."\)/);
  assert.match(admin, /\.from\("discounts"\)\.select\("code, active"\)\.eq\("id", id\)\.maybeSingle\(\)/);
  assert.match(admin, /existing\.active !== true/);
  assert.match(admin, /if \(active && String\(code \|\| ""\)\.trim\(\)\.toUpperCase\(\) === "WELCOME10"\)/);
});
