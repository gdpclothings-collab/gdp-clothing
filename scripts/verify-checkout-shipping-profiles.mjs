import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateProfileShipping, resolveProfileForProduct } from "../supabase/functions/checkout/shipping-profile-rules.mjs";

const general = { id:"general", name:"Canada Standard", active:true, product_scope:"all", product_ids:[], priority:10 };
const custom = { id:"custom", name:"DTF Profile", active:true, product_scope:"selected", product_ids:["dtf"], priority:50 };
const inactive = { id:"inactive", name:"Inactive", active:false, product_scope:"selected", product_ids:["inactive-product"], priority:1 };
const profiles = [general, custom, inactive];
const rates = [
  { profile_id:"general", name:"Standard Shipping", method_code:"standard", price:12.99, min_order:0, max_order:149.99, active:true, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100, min_delivery_days:3, max_delivery_days:7 },
  { profile_id:"general", name:"Free Standard Shipping", method_code:"standard", price:0, min_order:150, max_order:null, active:true, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100, min_delivery_days:3, max_delivery_days:7 },
  { profile_id:"custom", name:"DTF Flat", method_code:"standard", price:6.99, min_order:0, max_order:null, active:true, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100, min_delivery_days:2, max_delivery_days:5 },
  { profile_id:"custom", name:"Saskatoon DTF", method_code:"standard", price:4.99, min_order:0, max_order:null, active:true, country_codes:["CA"], province_codes:["SK"], postal_patterns:["S7*"], priority:90, min_delivery_days:1, max_delivery_days:3 },
];
const destination = { countryCode:"CA", provinceCode:"AB", postalCode:"T2P1J9" };

assert.equal(resolveProfileForProduct(profiles, "plain")?.id, "general", "unassigned products must use General shipping");
assert.equal(resolveProfileForProduct(profiles, "dtf")?.id, "custom", "assigned products must use their active custom profile");
assert.equal(resolveProfileForProduct(profiles, "inactive-product")?.id, "general", "inactive custom profiles must be ignored");

const generalQuote = calculateProfileShipping({ profiles, rates, items:[{productId:"plain",amount:50}], amount:50, destination });
assert.equal(generalQuote.shipping, 12.99, "general profile must preserve the current paid rate");
const customQuote = calculateProfileShipping({ profiles, rates, items:[{productId:"dtf",amount:50}], amount:50, destination });
assert.equal(customQuote.shipping, 6.99, "single custom profile must use its own rate");
const mixedQuote = calculateProfileShipping({ profiles, rates, items:[{productId:"plain",amount:100},{productId:"dtf",amount:100}], amount:200, destination });
assert.equal(mixedQuote.shipping, 19.98, "mixed carts must combine applicable profile charges");
assert.equal(mixedQuote.groups.length, 2, "mixed cart must expose two shipping groups");
const discountedMixed = calculateProfileShipping({ profiles, rates, items:[{productId:"plain",amount:100},{productId:"dtf",amount:100}], amount:160, destination });
assert.equal(discountedMixed.groups.find(g=>g.profileId==="general")?.amount, 80, "discounted order value must be allocated proportionally to profile groups");
assert.equal(discountedMixed.shipping, 19.98, "general free threshold must not incorrectly use the whole mixed-cart amount");
const skQuote = calculateProfileShipping({ profiles, rates, items:[{productId:"dtf",amount:50}], amount:50, destination:{countryCode:"CA",provinceCode:"SK",postalCode:"S7K1J5"} });
assert.equal(skQuote.shipping, 4.99, "custom profiles must still honor province/postal specificity");
const noCustomRate = calculateProfileShipping({ profiles, rates:rates.filter(r=>r.profile_id!=="custom"), items:[{productId:"dtf",amount:50}], amount:50, destination });
assert.equal(noCustomRate.shipping, 12.99, "incomplete custom profiles must fall back safely to General shipping rates");

const edge = fs.readFileSync("supabase/functions/checkout/index.ts", "utf8");
const page = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const api = fs.readFileSync("src/lib/customerApi.js", "utf8");
const adminApi = fs.readFileSync("src/lib/shippingAdminApi.js", "utf8");
const adminUi = fs.readFileSync("src/components/admin/ShippingDeliveryManager.jsx", "utf8");
assert(edge.includes('shipping_profiles'), "authoritative checkout must load active shipping profiles");
assert(edge.includes('shippingItems = normalizedItems'), "authoritative checkout must group server-priced order items");
assert(edge.includes('shippingProfileCount'), "checkout response must expose profile count for diagnostics");
assert(page.includes('checkoutShippingItems'), "checkout preview must key and send product shipping groups");
assert(api.includes('shippingItems = []'), "customer API must accept shipping profile items");
assert(adminApi.includes('product_ids'), "admin API must persist profile product assignments");
assert(adminApi.includes('products:unwrap(products)'), "admin API must load assignable shippable products");
assert(adminUi.includes('Custom product shipping profiles'), "Admin Shipping must expose custom product profiles");
assert(adminUi.includes('Product assignments'), "Admin Shipping must expose product assignment controls");
console.log("PASS product shipping profiles: assignments, mixed-cart combination, discount allocation, zone matching, fallback, and admin wiring verified");
