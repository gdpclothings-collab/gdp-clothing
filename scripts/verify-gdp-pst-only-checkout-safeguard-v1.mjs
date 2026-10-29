import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateTaxBreakdown } from "../supabase/functions/checkout/tax-rules.mjs";
import {
  applyCheckoutTaxPolicy,
  checkoutTaxProvince,
  taxableMerchandiseAfterCoupon,
  TaxConfigurationReviewError,
} from "../supabase/functions/checkout/checkout-tax-safeguard.mjs";

const now = new Date("2026-10-29T18:00:00Z");
const skRule = { name: "Saskatchewan GST + PST", config: { components: [
  { code: "GST", bucket: "gst_hst", rate: 0.05, tax_shipping: true },
  { code: "PST", bucket: "pst", rate: 0.06, tax_shipping: false },
] } };
const original = calculateTaxBreakdown(skRule, "SK", 35.99, 12.99);
const gstUnregistered = { tax_type: "gst_hst", registered: false, account_number: null, effective_from: null };
const pstRegistered = { tax_type: "pst", registered: true, account_number: "TEST-PST", effective_from: "2026-10-01" };
const registrations = [gstUnregistered, pstRegistered];
const policy = { mode: "sk_pst_only_small_supplier", reviewedOn: "2026-10-29", expiresOn: "2026-12-31" };
const skInput = { breakdown: original, registrations, province: "SK", merchandiseAmount: 35.99, shippingAmount: 12.99, policy, now };

const result = applyCheckoutTaxPolicy(skInput);
assert.equal(result.taxName, "Saskatchewan PST (6%)");
assert.equal(result.tax, 2.16);
assert.equal(result.gstHstTax, 0);
assert.equal(result.pstTax, 2.16);
assert.deepEqual(result.components.map((component) => component.code), ["PST"]);
assert.equal(result.policy, "gst_small_supplier_pst_only");
assert.equal(Math.round((35.99 + 12.99 + result.tax) * 100), 5114, "Stripe/order total uses PST only");
assert.ok(Math.abs((35.99 + 12.99) * result.effectiveRate - result.tax) < 0.000001);

const pickup = checkoutTaxProvince("pickup", "ON");
assert.equal(pickup, "SK");
const pickupTax = applyCheckoutTaxPolicy({ ...skInput, province: pickup,
  breakdown: calculateTaxBreakdown(skRule, pickup, 50, 0), merchandiseAmount: 50, shippingAmount: 0 });
assert.equal(pickupTax.tax, 3);
assert.equal(pickupTax.gstHstTax, 0);

const coupon = taxableMerchandiseAfterCoupon([
  { productId: "tee", taxable: true, amount: 35.99 },
  { productId: "exempt", taxable: false, amount: 12.01 },
], 6, new Set(["tee"]));
const discountedTax = applyCheckoutTaxPolicy({ ...skInput, breakdown: calculateTaxBreakdown(
  skRule, "SK", coupon.merchandiseAmount, 0, coupon.taxableAmount,
), merchandiseAmount: coupon.merchandiseAmount, shippingAmount: 0 });
assert.equal(coupon.taxableAmount, 29.99);
assert.equal(discountedTax.tax, 1.80);

assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, policy: {} }), TaxConfigurationReviewError,
  "unregistered GST must fail closed without explicit small-supplier policy");
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, policy: { ...policy, mode: "unknown" } }), TaxConfigurationReviewError);
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, province: "ON" }), TaxConfigurationReviewError,
  "out-of-province obligations require separate review");
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, registrations: [gstUnregistered, { ...pstRegistered, registered: false }] }), TaxConfigurationReviewError);
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, registrations: [gstUnregistered, { ...pstRegistered, account_number: null }] }), TaxConfigurationReviewError);
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, registrations: [gstUnregistered, { ...pstRegistered, effective_from: "2026-11-01" }] }), TaxConfigurationReviewError);
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, registrations: [{ ...gstUnregistered, registered: true }, pstRegistered] }), TaxConfigurationReviewError,
  "small-supplier mode cannot override a registered GST account");
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, registrations: [{ ...gstUnregistered, account_number: "unexpected" }, pstRegistered] }), TaxConfigurationReviewError);
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, registrations: [gstUnregistered] }), TaxConfigurationReviewError);
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, policy: { ...policy, reviewedOn: "2026-11-01" } }), TaxConfigurationReviewError);
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, policy: { ...policy, reviewedOn: "2026-02-31" } }), TaxConfigurationReviewError);
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, policy: { ...policy, expiresOn: "2026-10-28" } }), TaxConfigurationReviewError);
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, policy: { ...policy, expiresOn: "2027-03-01" } }), TaxConfigurationReviewError,
  "reviews cannot authorize indefinite non-collection");
assert.throws(() => applyCheckoutTaxPolicy({ ...skInput, breakdown: calculateTaxBreakdown({
  config: { components: [
    { code: "GST", bucket: "gst_hst", rate: 0.05, tax_shipping: true },
    { code: "PST", bucket: "pst", rate: 0.07, tax_shipping: false },
  ] },
}, "SK", 35.99, 12.99) }), TaxConfigurationReviewError, "unexpected PST rate must stop checkout");

const registeredGst = { tax_type: "gst_hst", registered: true, account_number: "TEST-GST", effective_from: "2026-10-01" };
const ordinary = applyCheckoutTaxPolicy({ ...skInput, registrations: [registeredGst, pstRegistered], policy: {} });
assert.equal(ordinary.tax, original.tax);
assert.equal(ordinary.gstHstTax, 2.45);
assert.equal(ordinary.pstTax, 2.16);

const edge = fs.readFileSync("supabase/functions/checkout/index.ts", "utf8");
const ui = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
assert.ok(edge.includes('mode: Deno.env.get("GDP_CHECKOUT_TAX_POLICY")'), "policy is server-controlled");
assert.ok(edge.includes('reviewedOn: Deno.env.get("GDP_GST_SMALL_SUPPLIER_REVIEWED_ON")'), "review expiry requires backend configuration");
assert.ok(edge.includes("gst_hst_tax: checkoutRules.gstHstTax"), "GST zero persists with order");
assert.ok(edge.includes("pst_tax: checkoutRules.pstTax"), "PST persists with order");
assert.ok(edge.includes("tax_breakdown: checkoutRules.taxBreakdown"), "tax policy persists with order");
assert.ok(edge.includes("const total = roundMoney(afterCoupon + shipping + tax)"), "Stripe total derives from server tax");
assert.ok(edge.indexOf("applyCheckoutTaxPolicy({") < edge.indexOf('.from("orders")\n      .insert('), "tax gate before order insert");
assert.ok(ui.includes('!activeConfig || Boolean(taxQuoteError)'), "client cannot pay without verified quote");
assert.ok(edge.includes('originalPixelWidth') && edge.includes('expectedWidthPx'), "300-DPI source remains present");
console.log("GDP PST-only checkout safeguard: GST unregistered, SK shipping/pickup, coupons, expiry, fail-closed and order authority passed.");
