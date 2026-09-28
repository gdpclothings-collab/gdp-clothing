export const DEFAULT_APPAREL_PRICING = {
  enabled: true,
  currency: "CAD",
  customQuoteMinQty: 50,
  allowCouponStacking: true,
  products: {
    tshirt: {
      front: { 1: 34.99, 2: 64.99, 5: 149.99, 10: 279.99 },
      front_back: { 1: 44.99, 2: 84.99, 5: 199.99, 10: 369.99 },
    },
    crewneck: {
      front: { 1: 59.99, 2: 109.99, 5: 259.99, 10: 489.99 },
      front_back: { 1: 69.99, 2: 129.99, 5: 309.99, 10: 579.99 },
    },
    hoodie: {
      front: { 1: 69.99, 2: 129.99, 5: 309.99, 10: 579.99 },
      front_back: { 1: 79.99, 2: 149.99, 5: 359.99, 10: 669.99 },
    },
  },
  tiers: [
    { min: 3, max: 5, percent: 5 },
    { min: 6, max: 9, percent: 10 },
    { min: 10, max: 19, percent: 15 },
    { min: 20, max: 49, percent: 20 },
  ],
};

const money = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : fallback;
};

export function normalizeApparelPricing(raw = {}) {
  const next = {
    ...DEFAULT_APPAREL_PRICING,
    ...(raw || {}),
    products: {},
  };

  for (const productKey of ["tshirt", "crewneck", "hoodie"]) {
    const incomingProduct = raw?.products?.[productKey] || {};
    const fallbackProduct = DEFAULT_APPAREL_PRICING.products[productKey];
    next.products[productKey] = {};
    for (const placement of ["front", "front_back"]) {
      const incomingPlacement = incomingProduct?.[placement] || {};
      next.products[productKey][placement] = {};
      for (const qty of [1, 2, 5, 10]) {
        next.products[productKey][placement][qty] = money(
          incomingPlacement?.[qty],
          fallbackProduct[placement][qty],
        );
      }
    }
  }

  const incomingTiers = Array.isArray(raw?.tiers) && raw.tiers.length
    ? raw.tiers
    : DEFAULT_APPAREL_PRICING.tiers;
  next.tiers = incomingTiers
    .map((tier) => ({
      min: Math.max(1, Math.floor(Number(tier?.min || 1))),
      max: Math.max(1, Math.floor(Number(tier?.max || tier?.min || 1))),
      percent: Math.min(95, Math.max(0, Number(tier?.percent || 0))),
    }))
    .sort((a, b) => a.min - b.min);
  next.customQuoteMinQty = Math.max(1, Math.floor(Number(raw?.customQuoteMinQty || 50)));
  next.enabled = raw?.enabled !== false;
  next.allowCouponStacking = raw?.allowCouponStacking !== false;
  next.currency = "CAD";
  return next;
}

export function apparelProductKey(type = "", name = "") {
  const value = `${type} ${name}`.toLowerCase();
  if (value.includes("hoodie")) return "hoodie";
  if (value.includes("crewneck") || value.includes("sweatshirt")) return "crewneck";
  if (value.includes("t-shirt") || value.includes("tshirt") || value.includes("tee")) return "tshirt";
  return null;
}

export function apparelPlacementKey(placement = "") {
  return placement === "front_back" ? "front_back" : "front";
}

export function getExactBundlePrice(config, productKey, placement, quantity) {
  const normalized = normalizeApparelPricing(config);
  const qty = Math.floor(Number(quantity || 1));
  const value = normalized.products?.[productKey]?.[placement]?.[qty];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function getVolumePercent(config, quantity) {
  const normalized = normalizeApparelPricing(config);
  const qty = Math.floor(Number(quantity || 1));
  const tier = normalized.tiers.find((row) => qty >= row.min && qty <= row.max);
  return Number(tier?.percent || 0);
}
