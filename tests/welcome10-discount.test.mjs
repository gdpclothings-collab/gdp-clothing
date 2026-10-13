import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { couponAmountForBase, couponIsUsable } from "../supabase/functions/checkout/discount-rules.mjs";

const welcome = { code: "WELCOME10", type: "percentage", value: 10, active: true };
test("WELCOME10 discount never exceeds CAD 15", () => {
  for (const [subtotal, expected] of [[0,0],[50,5],[100,10],[150,15],[200,15],[1000,15]]) {
    assert.equal(couponAmountForBase(welcome,subtotal),expected);
  }
});
test("generic coupon validation remains fail-closed for WELCOME10", () => {
  assert.equal(couponIsUsable(welcome,100),false);
});
test("ordinary percentage coupons unchanged", () => {
  const other = {code:"OTHER10",type:"percentage",value:10,active:true};
  assert.equal(couponAmountForBase(other,200),20);
  assert.equal(couponIsUsable(other,200),true);
});
test("fixed coupon behavior unchanged", () => {
  assert.equal(couponAmountForBase({code:"FIXED",type:"fixed",value:25},20),20);
});
test("WELCOME10 checkout and popup are server-gated with excluded DTF items", () => {
  const checkout = readFileSync(new URL("../supabase/functions/checkout/index.ts",import.meta.url),"utf8");
  const popup = readFileSync(new URL("../src/components/storefront/Welcome10Popup.jsx",import.meta.url),"utf8");
  assert.match(checkout,/getWelcomeCampaign\(service\)/);
  assert.match(checkout,/verifiedWelcomeAccount\(user, customer\.email\)/);
  assert.match(checkout,/normalizedItems\.filter\(\(item\) => !item\.discountExempt\)/);
  assert.match(checkout,/reserve_welcome10_coupon/);
  assert.match(popup,/getWelcome10Status/);
});
