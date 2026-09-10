import assert from "node:assert/strict";
import {
  findProductVariant,
  isProductOutOfStock,
  isProductVariantAvailable,
  sortApparelSizes,
} from "../src/lib/productVariants.js";
import {
  PRODUCT_SELLING_MODES,
  readyToWearReadiness,
  resolveProductSellingMode,
} from "../src/lib/productSelling.js";

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

assert.equal(resolveProductSellingMode({ customDesignable: false }), PRODUCT_SELLING_MODES.READY_TO_WEAR);
assert.equal(resolveProductSellingMode({ customDesignable: true }), PRODUCT_SELLING_MODES.CUSTOM);
assert.equal(resolveProductSellingMode({ slug: "dtf-gang-sheet" }), PRODUCT_SELLING_MODES.SERVICE);

const readyProduct = {
  name: "GDP Ready Tee",
  status: "active",
  sellingMode: "ready_to_wear",
  customDesignable: false,
  price: 34,
  trackInventory: true,
  sellWhenOutOfStock: false,
  salesChannels: ["online_store"],
  variants: [
    { id: "black-m", color: "Black", size: "M", stock: 3, active: true },
    { id: "black-l", color: "Black", size: "L", stock: 2, active: true },
  ],
};
assert.equal(readyToWearReadiness(readyProduct, { requireActive: true }).ready, true);

const outOfStockProduct = {
  ...readyProduct,
  variants: readyProduct.variants.map((item) => ({ ...item, stock: 0 })),
};
assert.equal(
  readyToWearReadiness(outOfStockProduct, { requireActive: true }).ready,
  true,
  "An active out-of-stock product is still a valid published catalog product."
);
const noStock = readyToWearReadiness(outOfStockProduct, {
  requireActive: true,
  requireSellableStock: true,
});
assert.equal(noStock.ready, false);
assert.equal(noStock.blockers.some((message) => message.includes("stock")), true);

const customProduct = readyToWearReadiness({ ...readyProduct, sellingMode: "custom", customDesignable: true });
assert.equal(customProduct.ready, false);

console.log("Product variant and ready-to-wear verification passed.");
