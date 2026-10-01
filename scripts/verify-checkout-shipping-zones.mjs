import assert from "node:assert/strict";
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
const profileRules = fs.readFileSync("supabase/functions/checkout/shipping-profile-rules.mjs", "utf8");
const page = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const api = fs.readFileSync("src/lib/customerApi.js", "utf8");
assert(profileRules.includes('import { selectShippingRate } from "./shipping-zone-rules.mjs";'), "profile engine must preserve the tested zone selector");
assert(edge.includes('import { calculateProfileShipping } from "./shipping-profile-rules.mjs";'), "checkout must use the profile-aware zone selector");
assert(edge.includes('postalCode: body?.postalCode || ""'), "checkoutConfig must accept postal code");
assert(edge.includes('getShippingQuote(service, amount, customer?.province, customer?.postalCode, shippingItems)'), "authoritative checkout must pass destination into profile-aware rate selection");
assert(page.includes("checkoutPostalCode = normalizePostal(form.postalCode)"), "client config key must include normalized postal code");
assert(page.includes("postalCode:checkoutPostalCode"), "client must send postal code to checkoutConfig");
assert(api.includes('postalCode = ""'), "customer API must accept postal code for checkoutConfig");
console.log("PASS checkout shipping zones: destination matching, fallback thresholds, and client/server wiring verified");
