import assert from "node:assert/strict";
import { calculateTaxBreakdown } from "../supabase/functions/checkout/tax-rules.mjs";

const skRule = {
  rate: 0.11,
  tax_shipping: true,
  config: {
    components: [
      { code: "GST", bucket: "gst_hst", rate: 0.05, tax_shipping: true },
      { code: "PST", bucket: "pst", rate: 0.06, tax_shipping: false },
    ],
  },
};

const skShipping = calculateTaxBreakdown(skRule, "SK", 100, 12.99);
assert.equal(skShipping.gstHstTax, 5.65, "SK GST must include separately stated shipping");
assert.equal(skShipping.pstTax, 6, "SK PST must exclude Saskatchewan-origin separately stated shipping");
assert.equal(skShipping.tax, 11.65, "SK total tax must be the sum of GST and PST components");

const skPickup = calculateTaxBreakdown(skRule, "SK", 100, 0);
assert.equal(skPickup.gstHstTax, 5);
assert.equal(skPickup.pstTax, 6);
assert.equal(skPickup.tax, 11);

const onRule = {
  rate: 0.13,
  tax_shipping: true,
  config: { components: [{ code: "HST", bucket: "gst_hst", rate: 0.13, tax_shipping: true }] },
};
const ontario = calculateTaxBreakdown(onRule, "ON", 100, 12.99);
assert.equal(ontario.gstHstTax, 14.69);
assert.equal(ontario.pstTax, 0);
assert.equal(ontario.tax, 14.69);

console.log("Tax breakdown verification PASS", { skShipping, skPickup, ontario });
