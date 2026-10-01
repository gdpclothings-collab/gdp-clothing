import assert from "node:assert/strict";
import fs from "node:fs";
import { selectShippingRate } from "../supabase/functions/checkout/shipping-zone-rules.mjs";
import { calculateProfileShipping } from "../supabase/functions/checkout/shipping-profile-rules.mjs";

const general = { id:"general", name:"Canada Standard", product_scope:"all", product_ids:[], active:true, priority:10 };
const baseRates = [
  { id:"default", profile_id:"general", name:"Standard Shipping", method_code:"standard", price:12.99, min_order:0, max_order:149.99, active:true, priority:100, country_codes:["CA"] },
  { id:"free", profile_id:"general", name:"Free Standard Shipping", method_code:"standard", price:0, min_order:150, max_order:null, active:true, priority:100, country_codes:["CA"] },
];
const weightedRates = [
  ...baseRates,
  { id:"light", profile_id:"general", name:"Light parcel", method_code:"standard", price:8.99, min_order:0, max_order:149.99, min_weight_grams:0, max_weight_grams:999, active:true, priority:100, country_codes:["CA"] },
  { id:"heavy", profile_id:"general", name:"Heavy parcel", method_code:"standard", price:18.99, min_order:0, max_order:149.99, min_weight_grams:1000, max_weight_grams:null, active:true, priority:100, country_codes:["CA"] },
];
const destination = { countryCode:"CA", provinceCode:"SK", postalCode:"S7K1J5" };

assert.equal(selectShippingRate(weightedRates, { ...destination, amount:100, weightKnown:false, weightGrams:null })?.id, "default", "unknown weight must ignore weight-restricted rates");
assert.equal(selectShippingRate(weightedRates, { ...destination, amount:100, weightKnown:true, weightGrams:650 })?.id, "light", "matching weight band must outrank unrestricted rate");
assert.equal(selectShippingRate(weightedRates, { ...destination, amount:100, weightKnown:true, weightGrams:1250 })?.id, "heavy", "heavy weight band must match");

let quote = calculateProfileShipping({ profiles:[general], rates:weightedRates, items:[{productId:"tee", amount:100, weightKnown:true, weightGrams:600}], amount:100, destination, packageWeightGrams:30 });
assert.equal(quote.shipping, 8.99);
assert.equal(quote.shippingWeightGrams, 630, "default package weight must be added once per shipment group");
assert.equal(quote.groups[0].weightGrams, 630);

quote = calculateProfileShipping({ profiles:[general], rates:weightedRates, items:[{productId:"tee", amount:100, weightKnown:false, weightGrams:null}], amount:100, destination, packageWeightGrams:30 });
assert.equal(quote.shipping, 12.99, "missing product weight must preserve unrestricted general shipping");
assert.equal(quote.shippingWeightGrams, null);

const custom = { id:"hoodie", name:"Hoodies", product_scope:"selected", product_ids:["hoodie-1"], active:true, priority:20 };
const mixedRates = [
  ...baseRates,
  { id:"hoodie-default", profile_id:"hoodie", name:"Hoodie standard", method_code:"standard", price:14.99, min_order:0, max_order:null, active:true, priority:100, country_codes:["CA"] },
  { id:"hoodie-heavy", profile_id:"hoodie", name:"Hoodie heavy", method_code:"standard", price:19.99, min_order:0, max_order:null, min_weight_grams:1000, max_weight_grams:null, active:true, priority:100, country_codes:["CA"] },
];
quote = calculateProfileShipping({ profiles:[general,custom], rates:mixedRates, items:[{productId:"tee",amount:40,weightKnown:true,weightGrams:180},{productId:"hoodie-1",amount:80,weightKnown:true,weightGrams:1100}], amount:120, destination, packageWeightGrams:30 });
assert.equal(quote.shipping, 32.98, "mixed profiles must apply weight rules independently and combine shipping");
assert.equal(quote.groups.length, 2);
assert.equal(quote.groups.find(g=>g.profileId==="hoodie")?.weightGrams, 1130);

const checkout = fs.readFileSync("supabase/functions/checkout/index.ts", "utf8");
assert.match(checkout, /select\("id,weight,weight_unit"\)/, "checkout must resolve product weights server-side");
assert.match(checkout, /shipping_packages/, "checkout must include default package weight");
assert.match(checkout, /min_weight_grams,max_weight_grams/, "checkout rate query must include weight limits");
assert.match(checkout, /quantity: Math\.max\(1/, "checkout quote items must preserve quantity");
const adminApi = fs.readFileSync("src/lib/shippingAdminApi.js", "utf8");
assert.match(adminApi, /saveProductWeight/, "Admin API must save product shipping weights");
assert.match(adminApi, /weight_unit:\"g\"/, "Admin weight saves must normalize to grams");
const admin = fs.readFileSync("src/components/admin/ShippingDeliveryManager.jsx", "utf8");
assert.match(admin, /Product shipping weights/, "Shipping Admin must expose product weight management");
assert.match(admin, /Weight per item \(g\)/, "Shipping Admin must label weight units clearly");
console.log("PASS checkout weight-based shipping regression");
