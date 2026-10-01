from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:90]!r}")
    p.write_text(text.replace(old, new, 1))


checkout = "supabase/functions/checkout/index.ts"
replace_once(
    checkout,
    'import { createClient } from "npm:@supabase/supabase-js@2";\n',
    'import { createClient } from "npm:@supabase/supabase-js@2";\nimport { selectShippingRate } from "./shipping-zone-rules.mjs";\n',
)

old_shipping = '''async function getShippingRule(service: any, amount: number) {
  const safeAmount = Math.max(0, roundMoney(amount));
  const { data, error } = await service
    .from("shipping_rates")
    .select("name,method_code,price,min_order,max_order,min_delivery_days,max_delivery_days")
    .eq("active", true)
    .eq("method_code", "standard")
    .lte("min_order", safeAmount)
    .or(`max_order.is.null,max_order.gte.${safeAmount}`)
    .order("min_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  return safeAmount >= 150
    ? {
        name: "Free Standard Shipping",
        method_code: "standard",
        price: 0,
        min_order: 150,
        max_order: null,
        min_delivery_days: 3,
        max_delivery_days: 7,
      }
    : {
        name: "Standard Shipping",
        method_code: "standard",
        price: 12.99,
        min_order: 0,
        max_order: 149.99,
        min_delivery_days: 3,
        max_delivery_days: 7,
      };
}'''
new_shipping = '''async function getShippingRule(service: any, amount: number, province: unknown, postalCode: unknown) {
  const safeAmount = Math.max(0, roundMoney(amount));
  const { data, error } = await service
    .from("shipping_rates")
    .select("id,name,method_code,price,min_order,max_order,min_delivery_days,max_delivery_days,zone_name,country_codes,province_codes,postal_patterns,priority")
    .eq("active", true)
    .eq("method_code", "standard");

  if (error) throw error;
  const matched = selectShippingRate(data || [], {
    amount: safeAmount,
    countryCode: "CA",
    provinceCode: normalizeProvinceCode(province),
    postalCode: normalizeCanadianPostalCode(postalCode),
  });
  if (matched) return matched;

  return safeAmount >= 150
    ? {
        name: "Free Standard Shipping",
        method_code: "standard",
        price: 0,
        min_order: 150,
        max_order: null,
        min_delivery_days: 3,
        max_delivery_days: 7,
      }
    : {
        name: "Standard Shipping",
        method_code: "standard",
        price: 12.99,
        min_order: 0,
        max_order: 149.99,
        min_delivery_days: 3,
        max_delivery_days: 7,
      };
}'''
replace_once(checkout, old_shipping, new_shipping)
replace_once(
    checkout,
    "  const shippingRule = await getShippingRule(service, amount);",
    "  const shippingRule = await getShippingRule(service, amount, customer?.province, customer?.postalCode);",
)
replace_once(
    checkout,
    '        province: body?.province || "Saskatchewan",\n        shippingMethod: body?.shippingMethod || "standard",',
    '        province: body?.province || "Saskatchewan",\n        postalCode: body?.postalCode || "",\n        shippingMethod: body?.shippingMethod || "standard",',
)

customer_api = "src/lib/customerApi.js"
replace_once(
    customer_api,
    "  async getCheckoutConfig({ amount, province, shippingMethod, freeShipping = false }) {",
    '  async getCheckoutConfig({ amount, province, postalCode = "", shippingMethod, freeShipping = false }) {',
)
replace_once(
    customer_api,
    "        amount,\n        province,\n        shippingMethod,",
    "        amount,\n        province,\n        postalCode,\n        shippingMethod,",
)

checkout_page = "src/pages/CheckoutTwoStep.jsx"
replace_once(
    checkout_page,
    'const afterCoupon = Math.max(0, discounted - coupon); const checkoutConfigKey = `${afterCoupon.toFixed(2)}|${form.province}|${form.shippingMethod}|${appliedDiscount?.type === "free_shipping" ? 1 : 0}`;',
    'const afterCoupon = Math.max(0, discounted - coupon); const checkoutPostalCode = normalizePostal(form.postalCode); const checkoutConfigKey = `${afterCoupon.toFixed(2)}|${form.province}|${checkoutPostalCode}|${form.shippingMethod}|${appliedDiscount?.type === "free_shipping" ? 1 : 0}`;',
)
replace_once(
    checkout_page,
    'customerApi.getCheckoutConfig({ amount:afterCoupon, province:form.province, shippingMethod:form.shippingMethod, freeShipping:appliedDiscount?.type === "free_shipping" })',
    'customerApi.getCheckoutConfig({ amount:afterCoupon, province:form.province, postalCode:checkoutPostalCode, shippingMethod:form.shippingMethod, freeShipping:appliedDiscount?.type === "free_shipping" })',
)

build_workflow = ".github/workflows/build-verification.yml"
replace_once(
    build_workflow,
    "          node scripts/verify-cart-pricing.mjs\n",
    "          node scripts/verify-cart-pricing.mjs\n          node scripts/verify-checkout-shipping-zones.mjs\n",
)

Path("supabase/functions/checkout/shipping-zone-rules.mjs").write_text(r'''const asList = (value) => Array.isArray(value) ? value : [];
const compact = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
const numberOr = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function postalPatternMatches(pattern, postalCode) {
  const normalizedPattern = compact(pattern).replace(/[^A-Z0-9*]/g, "");
  const normalizedPostal = compact(postalCode).replace(/[^A-Z0-9]/g, "");
  if (!normalizedPattern || !normalizedPostal) return false;
  const escaped = normalizedPattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(normalizedPostal);
}

export function shippingRateMatchesDestination(rate, destination = {}) {
  const countryCode = compact(destination.countryCode || "CA");
  const provinceCode = compact(destination.provinceCode);
  const postalCode = compact(destination.postalCode);
  const countryCodes = asList(rate?.country_codes).map(compact).filter(Boolean);
  const provinceCodes = asList(rate?.province_codes).map(compact).filter(Boolean);
  const postalPatterns = asList(rate?.postal_patterns).map((value) => String(value || "").trim()).filter(Boolean);

  if (countryCodes.length && !countryCodes.includes(countryCode)) return false;
  if (provinceCodes.length && (!provinceCode || !provinceCodes.includes(provinceCode))) return false;
  if (postalPatterns.length && (!postalCode || !postalPatterns.some((pattern) => postalPatternMatches(pattern, postalCode)))) return false;
  return true;
}

function specificity(rate) {
  if (asList(rate?.postal_patterns).length) return 2;
  if (asList(rate?.province_codes).length) return 1;
  return 0;
}

export function selectShippingRate(rates, destination = {}) {
  const amount = Math.max(0, numberOr(destination.amount, 0));
  return (Array.isArray(rates) ? rates : [])
    .filter((rate) => {
      const min = rate?.min_order == null ? 0 : numberOr(rate.min_order, 0);
      const max = rate?.max_order == null ? Number.POSITIVE_INFINITY : numberOr(rate.max_order, Number.NEGATIVE_INFINITY);
      return amount >= min && amount <= max && shippingRateMatchesDestination(rate, destination);
    })
    .sort((a, b) => {
      const specificityDelta = specificity(b) - specificity(a);
      if (specificityDelta) return specificityDelta;
      const priorityDelta = numberOr(a?.priority, 100) - numberOr(b?.priority, 100);
      if (priorityDelta) return priorityDelta;
      const minOrderDelta = numberOr(b?.min_order, 0) - numberOr(a?.min_order, 0);
      if (minOrderDelta) return minOrderDelta;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    })[0] || null;
}
''')

Path("scripts/verify-checkout-shipping-zones.mjs").write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import { postalPatternMatches, selectShippingRate } from "../supabase/functions/checkout/shipping-zone-rules.mjs";

const generalPaid = { name:"Standard", price:12.99, min_order:0, max_order:149.99, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100 };
const generalFree = { name:"Free", price:0, min_order:150, max_order:null, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100 };
const skPaid = { name:"SK", price:10.99, min_order:0, max_order:149.99, country_codes:["CA"], province_codes:["SK"], postal_patterns:[], priority:100 };
const s7Paid = { name:"Saskatoon", price:8.99, min_order:0, max_order:149.99, country_codes:["CA"], province_codes:["SK"], postal_patterns:["S7*"], priority:100 };
const rates = [generalPaid, generalFree, skPaid, s7Paid];

assert.equal(selectShippingRate(rates, { amount:50, countryCode:"CA", provinceCode:"AB", postalCode:"T2P 1J9" })?.price, 12.99, "Canada-wide fallback rate must remain available");
assert.equal(selectShippingRate(rates, { amount:160, countryCode:"CA", provinceCode:"AB", postalCode:"T2P 1J9" })?.price, 0, "$150+ free-shipping threshold must remain available");
assert.equal(selectShippingRate(rates, { amount:50, countryCode:"CA", provinceCode:"SK", postalCode:"S4P 3Y2" })?.price, 10.99, "province zone must outrank a Canada-wide rate");
assert.equal(selectShippingRate(rates, { amount:50, countryCode:"CA", provinceCode:"SK", postalCode:"S7K 1J5" })?.price, 8.99, "postal zone must outrank a province-wide rate");
assert.equal(selectShippingRate(rates, { amount:160, countryCode:"CA", provinceCode:"SK", postalCode:"S7K 1J5" })?.price, 0, "expired price range must fall through to the matching higher threshold");
assert.equal(postalPatternMatches("S7*", "s7k 1j5"), true, "postal wildcard matching must be case/space insensitive");
assert.equal(postalPatternMatches("S7*", "S4P 3Y2"), false, "postal wildcard must not match another region");

const edge = fs.readFileSync("supabase/functions/checkout/index.ts", "utf8");
const page = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const api = fs.readFileSync("src/lib/customerApi.js", "utf8");
assert(edge.includes('import { selectShippingRate } from "./shipping-zone-rules.mjs";'), "checkout must use the tested zone selector");
assert(edge.includes('postalCode: body?.postalCode || ""'), "checkoutConfig must accept postal code");
assert(edge.includes('getShippingRule(service, amount, customer?.province, customer?.postalCode)'), "authoritative checkout must pass destination into rate selection");
assert(page.includes("checkoutPostalCode = normalizePostal(form.postalCode)"), "client config key must include normalized postal code");
assert(page.includes("postalCode:checkoutPostalCode"), "client must send postal code to checkoutConfig");
assert(api.includes('postalCode = ""'), "customer API must accept postal code for checkoutConfig");
console.log("PASS checkout shipping zones: destination matching, fallback thresholds, and client/server wiring verified");
''')
