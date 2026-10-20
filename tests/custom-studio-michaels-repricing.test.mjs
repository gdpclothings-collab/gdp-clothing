import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  apparelProductKey,
  getExactBundlePrice,
  getVolumePercent,
  normalizeApparelPricing,
} from "../src/lib/apparelPricing.js";

const expected = [
  { type: "T-Shirt", name: "Unisex Adult Short Sleeve Tee", key: "tshirt", front: 35.99 },
  { type: "Kids", name: "Kids Custom Tee", key: "kidsTshirt", front: 32.99 },
  { type: "Toddler T-Shirt", name: "Toddler Short Sleeve Tee", key: "toddlerTshirt", front: 32.99 },
  { type: "Youth T-Shirt", name: "Youth Unisex Short Sleeve Tee", key: "youthTshirt", front: 32.99 },
  { type: "Long Sleeve", name: "Unisex Adult Long Sleeve Tee", key: "longSleeve", front: 52.99 },
  { type: "Crewneck Sweatshirt", name: "Unisex Adult Crewneck Sweatshirt", key: "crewneck", front: 70.99 },
  { type: "Hoodie", name: "Unisex Adult Pullover Hoodie", key: "hoodie", front: 90.99 },
];

test("all seven garment types have their own matching price matrices", () => {
  const config = normalizeApparelPricing({});
  for (const row of expected) {
    const key = apparelProductKey(row.type, row.name);
    assert.equal(key, row.key);
    assert.equal(getExactBundlePrice(config, key, "front", 1), row.front);
    assert.equal(getExactBundlePrice(config, key, "front_back", 1), Math.round((row.front + 10) * 100) / 100);
    for (const [quantity, pct] of [[2, 0.05], [5, 0.10], [10, 0.15]]) {
      const actual = getExactBundlePrice(config, key, "front", quantity);
      assert.ok(Math.abs(actual - Math.round((row.front * quantity * (1 - pct) + Number.EPSILON) * 100) / 100) <= 0.01);
    }
  }
  assert.equal(Object.keys(config.products).length, 7);
});

test("matrix for long sleeve never inherits the cheaper adult tee price", () => {
  const config = normalizeApparelPricing({});
  const long = getExactBundlePrice(config, "longSleeve", "front", 1);
  const short = getExactBundlePrice(config, "tshirt", "front", 1);
  assert.ok(long > short);
  assert.equal(getExactBundlePrice(config, "youthTshirt", "front", 1), 32.99);
  assert.equal(getExactBundlePrice(config, "toddlerTshirt", "front", 1), 32.99);
  assert.equal(getVolumePercent(config, 20), 20);
  assert.equal(config.allowCouponStacking, true); // live production setting may explicitly disable it
});

test("server matches storefront category pricing and keeps ready-to-wear separate", () => {
  const edge = readFileSync("supabase/functions/checkout/index.ts", "utf8");
  const cart = readFileSync("src/lib/cartPricing.js", "utf8");
  const studio = readFileSync("src/pages/CustomStudioV2.jsx", "utf8");
  for (const row of expected) {
    assert.ok(edge.includes(`${row.key}: { front: { 1: ${row.front.toFixed(2)}`), `missing edge key ${row.key}`);
  }
  assert.ok(edge.includes('if (value.includes("long sleeve")'));
  assert.ok(edge.includes('if (value.includes("toddler")'));
  assert.ok(edge.includes('if (value.includes("youth")'));
  assert.ok(cart.includes('apparelProductKey(item.productType'));
  assert.ok(studio.includes('variant?.price ?? product.price'));
  assert.ok(edge.includes('selling_mode || "").trim().toLowerCase() === "ready_to_wear"'));
});
