import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateTaxBreakdown } from "../supabase/functions/checkout/tax-rules.mjs";
import {
  checkoutTaxProvince,
  taxableMerchandiseAfterCoupon,
  assertTaxRegistration,
  TaxConfigurationReviewError,
} from "../supabase/functions/checkout/checkout-tax-safeguard.mjs";

const rule = {
  name: "Saskatchewan GST + PST",
  rate: 0.11,
  config: { components: [
    { code: "GST", bucket: "gst_hst", rate: 0.05, tax_shipping: true },
    { code: "PST", bucket: "pst", rate: 0.06, tax_shipping: false },
  ] },
};
const now = new Date("2026-10-27T18:00:00Z");
const registered = [
  { tax_type: "gst_hst", registered: true, account_number: "TEST-GST", effective_from: "2026-10-01" },
  { tax_type: "pst", registered: true, account_number: "TEST-PST", effective_from: "2026-10-02" },
];

assert.equal(checkoutTaxProvince("pickup", "ON"), "SK", "Saskatoon pickup does not inherit billing province");
assert.equal(checkoutTaxProvince("standard", "ON"), "ON", "shipped goods use destination jurisdiction");

const original = calculateTaxBreakdown(rule, "SK", 35.99, 12.99);
assert.equal(original.gstHstTax, 2.45);
assert.equal(original.pstTax, 2.16);
assert.equal(original.tax, 4.61);
assert.equal(original.taxableShippingAmount, undefined);
assert.equal(assertTaxRegistration(registered, original.components, now), true);

const missingRegistration = [
  { tax_type: "gst_hst", registered: false, account_number: null, effective_from: null },
  { tax_type: "pst", registered: false, account_number: null, effective_from: null },
];
assert.throws(() => assertTaxRegistration(missingRegistration, original.components, now), TaxConfigurationReviewError, "unverified tax collection must stop");
assert.throws(() => assertTaxRegistration(registered.slice(0, 1), original.components, now), TaxConfigurationReviewError, "SK PST cannot be silently omitted");
assert.throws(() => assertTaxRegistration([{ ...registered[0], effective_from: "2026-11-01" }, registered[1]], original.components, now), TaxConfigurationReviewError, "future registration not active");
assert.throws(() => assertTaxRegistration([{ ...registered[0], account_number: "" }, registered[1]], original.components, now), TaxConfigurationReviewError, "no account number");
assert.throws(() => assertTaxRegistration([{ ...registered[0], effective_from: "2026-02-31" }, registered[1]], original.components, now), TaxConfigurationReviewError, "impossible effective date rejected");
assert.throws(() => assertTaxRegistration(null, original.components, now), TaxConfigurationReviewError, "missing finance table must fail closed");

const mixed = taxableMerchandiseAfterCoupon([
  { productId: "tee", taxable: true, amount: 35.99 },
  { productId: "exempt", taxable: false, amount: 12.01 },
], 4.80);
assert.equal(mixed.merchandiseAmount, 43.20);
assert.equal(mixed.taxableAmount, 32.40);
assert.equal(mixed.hasNonTaxable, true);
const mixedTax = calculateTaxBreakdown(rule, "SK", mixed.merchandiseAmount, 0, mixed.taxableAmount);
assert.equal(mixedTax.gstHstTax, 1.62);
assert.equal(mixedTax.pstTax, 1.94);
assert.equal(mixedTax.tax, 3.56);

const restricted = taxableMerchandiseAfterCoupon([
  { productId: "tee", taxable: true, amount: 35.99 },
  { productId: "exempt", taxable: false, amount: 12.01 },
], 6, new Set(["tee"]));
assert.equal(restricted.taxableAmount, 29.99);
assert.equal(restricted.merchandiseAmount, 42);
assert.throws(() => taxableMerchandiseAfterCoupon([{ productId: "x", amount: 10 }]), TaxConfigurationReviewError, "unknown taxable classification");
assert.throws(() => taxableMerchandiseAfterCoupon([{ productId: "x", taxable: true, amount: 10 }], 11), TaxConfigurationReviewError, "coupon cannot overrun eligible price");

const zeroRated = calculateTaxBreakdown(rule, "SK", 40, 0, 0);
assert.equal(zeroRated.tax, 0);
assert.equal(assertTaxRegistration([], zeroRated.components, now), true, "genuinely non-taxable merchandise should not require collecting GST/PST");

const edge = fs.readFileSync("supabase/functions/checkout/index.ts", "utf8");
const ui = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const gateway = fs.readFileSync("supabase/functions/checkout-gateway/index.ts", "utf8");
const webhook = fs.readFileSync("supabase/functions/stripe-webhook/index.ts", "utf8");
assert.ok(edge.includes('checkoutTaxProvince(shippingMethod, normalizeProvinceCode(customer?.province))'), "backend must handle pickup jurisdiction");
assert.ok(edge.includes('applyCheckoutTaxPolicy({'), "backend must check the server-side tax policy and registration before an order");
assert.ok(edge.includes('GDP_CHECKOUT_TAX_POLICY'), "small-supplier exception must require explicit server configuration");
assert.ok(edge.indexOf("applyCheckoutTaxPolicy({") < edge.indexOf('.from("orders")\n      .insert('), "tax policy must be checked before order insert");
assert.ok(edge.includes("taxableMerchandiseAfterCoupon(taxLines, couponAmount, couponTargets)"), "backend must allocate coupon by taxability");
assert.ok(edge.includes('throw new TaxConfigurationReviewError();'), "unsupported mixed tax shipping must fail closed");
assert.ok(ui.includes('!activeConfig || Boolean(taxQuoteError)'), "Pay must disable when tax quote unavailable");
assert.ok(ui.includes("if (!activeConfig || taxQuoteError) return setError("), "Pay handler itself must guard unknown tax");
assert.ok(ui.includes('activeConfig ? Number(activeConfig.tax || 0) : 0'), "no client-only tax estimates");
assert.ok(gateway.includes('normalizePaymentMode(data?.payment_mode)'), "do not modify protected payment modes");
assert.ok(webhook.includes('event.type === "payment_intent.succeeded"'), "Stripe verification path remains");
assert.ok(edge.includes('production_status: "not_started"'), "production gate untouched");
assert.ok(edge.includes('originalPixelWidth') && edge.includes('expectedWidthPx'), "300 DPI DTF check untouched");

console.log("GDP tax safeguard: jurisdiction, registration, rounding, mixed taxability, webhook and production checks passed.");
