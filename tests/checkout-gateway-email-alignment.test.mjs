import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkout = readFileSync("supabase/functions/checkout/index.ts", "utf8");
const gateway = readFileSync("supabase/functions/checkout-gateway/index.ts", "utf8");
const claimMigration = readFileSync(
  "supabase/migrations/20261001220358_enforce_checkout_gateway_claim_on_order_insert.sql",
  "utf8"
);

test("signed-in orders preserve the normalized checkout contact email", () => {
  assert.match(checkout, /customer\.email\s*=\s*customerEmail\.toLowerCase\(\)/);
  assert.match(checkout, /customer_email:\s*customer\.email,/);
  assert.doesNotMatch(checkout, /customer_email:\s*user\?\.email\s*\|\|\s*customer\.email/);
  assert.match(checkout, /user_id:\s*user\?\.id\s*\|\|\s*null/);
});

test("Stripe receipt and consent records use the same contact email", () => {
  assert.match(checkout, /form\.set\("customer_email",\s*customer\.email\)/);
  assert.match(checkout, /email:\s*customer\.email,\s*order_id:\s*order\.id,\s*policy_key:\s*"terms_conditions"/);
  assert.match(checkout, /email:\s*customer\.email,\s*order_id:\s*order\.id,\s*policy_key:\s*"privacy_policy"/);
  assert.match(checkout, /marketing_consents"\)\.insert\(\{[\s\S]*?email:\s*customer\.email/);
});

test("gateway claims still bind tracked email and account identity", () => {
  assert.match(gateway, /customer_email:\s*String\(customer\.email\s*\|\|\s*user\?\.email\s*\|\|\s*""\)\.trim\(\)/);
  assert.match(gateway, /rpc\("claim_checkout_session"/);
  assert.match(claimMigration, /lower\(trim\(coalesce\(s\.customer_email,\s*''\)\)\)\s*=\s*lower\(trim\(coalesce\(new\.customer_email,\s*''\)\)\)/);
  assert.match(claimMigration, /s\.user_id is null or new\.user_id is null or s\.user_id = new\.user_id/);
  assert.match(claimMigration, /CHECKOUT_GATEWAY_REQUIRED/);
});

test("verified-account coupon restriction remains intact", () => {
  assert.match(checkout, /welcomeRequested && !verifiedWelcomeAccount\(user, customer\.email\)/);
});
