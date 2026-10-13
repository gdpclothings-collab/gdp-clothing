import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { couponAmountForBase, couponIsUsable } from "../supabase/functions/checkout/discount-rules.mjs";

const welcome = { code: "WELCOME10", type: "percentage", value: 10, active: true };
test("WELCOME10 discount never exceeds CAD 15", () => {
  for (const [subtotal, expected] of [[0, 0], [50, 5], [100, 10], [150, 15], [200, 15], [1000, 15]]) {
    assert.equal(couponAmountForBase(welcome, subtotal), expected);
  }
});
test("WELCOME10 is not eligible before redemption hardening", () => {
  assert.equal(couponIsUsable(welcome, 100), false);
});
test("other valid coupons retain original percentage behavior", () => {
  const ordinary = { code: "OTHER10", type: "percentage", value: 10, active: true };
  assert.equal(couponAmountForBase(ordinary, 200), 20);
  assert.equal(couponIsUsable(ordinary, 200), true);
});
test("fixed coupons retain their original behavior", () => {
  assert.equal(couponAmountForBase({ code: "FIXED", type: "fixed", value: 25 }, 20), 20);
});

test("checkout rejects WELCOME10 while atomic redemption is unfinished", () => {
  const checkout = readFileSync(new URL("../supabase/functions/checkout/index.ts", import.meta.url), "utf8");
  assert.match(checkout, /if \(couponCode === "WELCOME10"\)/);
  assert.match(checkout, /WELCOME10 is not available yet/);
  assert.match(checkout, /if \(code === "WELCOME10"\).*promotion_not_enabled/);
});
