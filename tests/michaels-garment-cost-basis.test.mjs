import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_APPAREL_PRICING,
  DEFAULT_GARMENT_SOURCING,
  getGarmentBaseCost,
  normalizeApparelPricing,
} from "../src/lib/apparelPricing.js";

test("Michaels regular garment price is the temporary default, not a sale price", () => {
  const config = normalizeApparelPricing({});
  assert.equal(config.sourcing.useFallbackRetailAsBasePrice, true);
  assert.equal(getGarmentBaseCost(config.sourcing, "adultTshirt"), 6.99);
  assert.equal(config.sourcing.garments.adultTshirt.fallbackCurrentCost, 4.99);
  assert.equal(getGarmentBaseCost(config.sourcing, "crewneck"), 24.99);
});

test("wholesale can be deliberately restored later without altering supplier references", () => {
  const config = normalizeApparelPricing({
    sourcing: {
      ...DEFAULT_GARMENT_SOURCING,
      useFallbackRetailAsBasePrice: false,
      garments: {
        ...DEFAULT_GARMENT_SOURCING.garments,
        adultTshirt: {
          ...DEFAULT_GARMENT_SOURCING.garments.adultTshirt,
          wholesaleCost: 3.89,
        },
      },
    },
  });
  assert.equal(config.sourcing.useFallbackRetailAsBasePrice, false);
  assert.equal(getGarmentBaseCost(config.sourcing, "adultTshirt"), 3.89);
  assert.equal(config.sourcing.primarySupplierName, "T-Shirt Ideal");
  assert.equal(config.sourcing.fallbackSupplierName, "Michaels");
});

test("the cost reference does not automatically change storefront prices", () => {
  const config = normalizeApparelPricing(DEFAULT_APPAREL_PRICING);
  assert.equal(config.sourcing.automaticPriceAdjustment, false);
  assert.equal(config.products.tshirt.front[1], 34.99);
  assert.equal(config.products.hoodie.front[1], 69.99);
  assert.equal(getGarmentBaseCost(config.sourcing, "not-a-garment"), null);
});
