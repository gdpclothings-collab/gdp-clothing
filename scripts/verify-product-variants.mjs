import assert from "node:assert/strict";
import {
  findProductVariant,
  isProductOutOfStock,
  isProductVariantAvailable,
  sortApparelSizes,
} from "../src/lib/productVariants.js";

assert.deepEqual(
  sortApparelSizes(["2XL", "S", "3XL", "M", "4XL", "L", "XL", "5XL"]),
  ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]
);
assert.deepEqual(sortApparelSizes(["5T", "2T", "4T", "3T"]), ["2T", "3T", "4T", "5T"]);

const madeToOrder = {
  trackInventory: false,
  variants: [{ id: "variant-1", color: " Charcoal ", size: "M", stock: 0, active: true }],
};
const variant = findProductVariant(madeToOrder, "charcoal", "m");
assert.equal(variant?.id, "variant-1");
assert.equal(isProductVariantAvailable(madeToOrder, variant), true);
assert.equal(isProductVariantAvailable({ ...madeToOrder, trackInventory: true }, variant), false);
assert.equal(isProductVariantAvailable({ ...madeToOrder, trackInventory: true, sellWhenOutOfStock: true }, variant), true);
assert.equal(isProductOutOfStock({ ...madeToOrder, trackInventory: true }), true);
assert.equal(isProductOutOfStock({ ...madeToOrder, trackInventory: true, sellWhenOutOfStock: true }), false);
assert.equal(isProductOutOfStock({ ...madeToOrder, trackInventory: true, variants: [{ ...variant, stock: 2 }] }), false);

console.log("Product variant verification passed.");
