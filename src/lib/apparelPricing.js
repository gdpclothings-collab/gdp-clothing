export const DEFAULT_GARMENT_SOURCING = {
  strategy: "wholesale_primary_local_fallback",
  primarySupplierName: "T-Shirt Ideal",
  fallbackSupplierName: "Michaels",
  useFallbackRetailAsBasePrice: false,
  automaticPriceAdjustment: false,
  localSourcingFee: 0,
  garments: {
    adultTshirt: {
      label: "Gildan® Short Sleeve Adult T-Shirt",
      productSlug: "gildan-short-sleeve-adult-custom",
      wholesaleCost: null,
      fallbackBrand: "Gildan",
      fallbackItemNumber: "10532473",
      fallbackRegularCost: 6.99,
      fallbackCurrentCost: 4.99,
      observedAt: "2026-10-01",
      supportedSizes: ["S", "M", "L", "XL", "2XL", "3XL"],
      supportedColors: ["Black", "White", "Sport Grey", "Navy", "Red", "Royal", "Safety Pink", "Gold", "Irish Green", "Purple", "Orange", "Sand", "Light Pink", "Light Blue"],
      details: [
        "Classic adult short-sleeve tee available in multiple colours and sizes.",
        "Most solid colours are 100% cotton.",
        "Sport Grey and selected heathers use cotton/polyester blends.",
        "Selected safety colours and heathers use a 50/50 cotton/polyester blend.",
        "Tear-away tag on the referenced Michaels Gildan blank.",
      ],
    },
    longSleeve: {
      label: "Gildan® Long Sleeve Crew Neck Adult T-Shirt",
      productSlug: "gildan-long-sleeve-adult-custom",
      wholesaleCost: null,
      fallbackBrand: "Gildan",
      fallbackItemNumber: "10643769",
      fallbackRegularCost: 16.99,
      fallbackCurrentCost: 16.99,
      observedAt: "2026-10-01",
      supportedSizes: ["S", "M", "L", "XL", "2XL"],
      supportedColors: ["White", "Red", "Royal", "Black", "Sport Grey", "Irish Green"],
      details: [
        "Adult crew-neck tee with long sleeves and elastic cuffs.",
        "Most solid colours are 100% cotton.",
        "Sport Grey is a cotton/polyester blend.",
      ],
    },
    toddlerTshirt: {
      label: "Gildan® Short Sleeve Toddler T-Shirt",
      productSlug: "gildan-short-sleeve-toddler-custom",
      wholesaleCost: null,
      fallbackBrand: "Gildan",
      fallbackItemNumber: "10620900",
      fallbackRegularCost: 6.99,
      fallbackCurrentCost: 4.99,
      observedAt: "2026-10-01",
      supportedSizes: ["2T", "3T", "4T"],
      supportedColors: ["White", "Red", "Royal", "Black", "Gold", "Sport Grey", "Light Pink"],
      details: [
        "Toddler short-sleeve tee available in multiple colours and sizes.",
        "Most solid colours are 100% cotton.",
        "Sport Grey uses a cotton/polyester blend.",
      ],
    },
    youthTshirt: {
      label: "Gildan® Short Sleeve Youth T-Shirt",
      productSlug: "gildan-short-sleeve-youth-custom",
      wholesaleCost: null,
      fallbackBrand: "Gildan",
      fallbackItemNumber: "10267611",
      fallbackRegularCost: 6.99,
      fallbackCurrentCost: 4.99,
      observedAt: "2026-10-01",
      supportedSizes: ["XS", "S", "M", "L", "XL"],
      supportedColors: ["Black", "White", "Sport Grey", "Navy", "Red", "Royal", "Safety Pink", "Irish Green", "Purple", "Maroon", "Gold", "Light Blue", "Orange", "Sand", "Light Pink"],
      details: [
        "Youth short-sleeve tee with a classic fit and ribbed collar.",
        "Most solid colours are 100% cotton.",
        "Sport Grey and safety colours use cotton/polyester blends.",
      ],
    },
    crewneck: {
      label: "Gildan® Crewneck Adult Sweatshirt",
      productSlug: "gildan-adult-crewneck-sweatshirt-custom",
      wholesaleCost: null,
      fallbackBrand: "Gildan",
      fallbackItemNumber: "10619430",
      fallbackRegularCost: 24.99,
      fallbackCurrentCost: 24.99,
      observedAt: "2026-10-01",
      supportedSizes: ["S", "M", "L", "XL"],
      supportedColors: ["Gray", "Red", "Royal", "Irish Green", "White", "Black"],
      details: [
        "Adult crewneck sweatshirt with a soft 50/50 cotton-polyester fleece blend.",
        "Designed for a softer feel with reduced pilling.",
        "Double-needle cuffs and reinforced stitching on the referenced blank.",
      ],
    },
    hoodie: {
      label: "Adult Pullover Hoodie",
      productSlug: "gildan-adult-fleece-hoodie-custom",
      wholesaleCost: null,
      fallbackBrand: "Make Market",
      fallbackItemNumber: "10728168",
      fallbackRegularCost: 34.99,
      fallbackCurrentCost: 34.99,
      observedAt: "2026-10-01",
      supportedSizes: ["S", "M", "L", "XL"],
      supportedColors: ["Gray", "Royal", "Red", "Black", "White", "Light Blue", "Pink", "Cream"],
      requiresSubstitutionApproval: true,
      details: [
        "Adult unisex pullover hoodie with drawstring hood.",
        "The Michaels fallback is a 60/40 cotton-polyester fleece blank.",
        "Because the fallback brand is Make Market rather than Gildan, substitution should be confirmed before fulfillment.",
      ],
    },
  },
};

export const DEFAULT_APPAREL_PRICING = {
  enabled: true,
  currency: "CAD",
  customQuoteMinQty: 50,
  allowCouponStacking: true,
  readyToWear: {
    enabled: false,
    allowSaleStacking: true,
    tiers: [
      { min: 2, max: 2, percent: 10 },
      { min: 3, max: 999, percent: 15 },
    ],
  },
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
  sourcing: DEFAULT_GARMENT_SOURCING,
};

const money = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : fallback;
};

const optionalMoney = (value, fallback = null) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : fallback;
};

const stringList = (value, fallback) => {
  if (!Array.isArray(value)) return fallback;
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
};

export function normalizeGarmentSourcing(raw = {}) {
  const incoming = raw || {};
  const next = {
    ...DEFAULT_GARMENT_SOURCING,
    ...incoming,
    strategy: "wholesale_primary_local_fallback",
    primarySupplierName: String(incoming.primarySupplierName || DEFAULT_GARMENT_SOURCING.primarySupplierName),
    fallbackSupplierName: String(incoming.fallbackSupplierName || DEFAULT_GARMENT_SOURCING.fallbackSupplierName),
    useFallbackRetailAsBasePrice: false,
    automaticPriceAdjustment: incoming.automaticPriceAdjustment === true,
    localSourcingFee: money(incoming.localSourcingFee, 0),
    garments: {},
  };

  for (const [key, fallback] of Object.entries(DEFAULT_GARMENT_SOURCING.garments)) {
    const row = incoming?.garments?.[key] || {};
    next.garments[key] = {
      ...fallback,
      ...row,
      wholesaleCost: optionalMoney(row.wholesaleCost, fallback.wholesaleCost),
      fallbackRegularCost: money(row.fallbackRegularCost, fallback.fallbackRegularCost),
      fallbackCurrentCost: money(row.fallbackCurrentCost, fallback.fallbackCurrentCost),
      supportedSizes: stringList(row.supportedSizes, fallback.supportedSizes),
      supportedColors: stringList(row.supportedColors, fallback.supportedColors),
      details: stringList(row.details, fallback.details),
      requiresSubstitutionApproval: row.requiresSubstitutionApproval === true || fallback.requiresSubstitutionApproval === true,
    };
  }

  return next;
}

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

  const rawReadyToWear = raw?.readyToWear || {};
  const readyToWearTiers = Array.isArray(rawReadyToWear?.tiers) && rawReadyToWear.tiers.length
    ? rawReadyToWear.tiers
    : DEFAULT_APPAREL_PRICING.readyToWear.tiers;
  next.readyToWear = {
    enabled: rawReadyToWear.enabled === true,
    allowSaleStacking: rawReadyToWear.allowSaleStacking !== false,
    tiers: readyToWearTiers
      .map((tier) => {
        const min = Math.max(1, Math.floor(Number(tier?.min || 1)));
        return {
          min,
          max: Math.max(min, Math.floor(Number(tier?.max || tier?.min || min))),
          percent: Math.min(95, Math.max(0, Number(tier?.percent || 0))),
        };
      })
      .sort((a, b) => a.min - b.min),
  };

  next.currency = "CAD";
  next.sourcing = normalizeGarmentSourcing(raw?.sourcing || {});
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

export function getReadyToWearPercent(config, quantity) {
  const normalized = normalizeApparelPricing(config);
  if (!normalized.enabled || !normalized.readyToWear?.enabled) return 0;
  const qty = Math.max(1, Math.floor(Number(quantity || 1)));
  const tier = normalized.readyToWear.tiers.find((row) => qty >= row.min && qty <= row.max);
  return Number(tier?.percent || 0);
}

export function getReadyToWearTiers(config) {
  const normalized = normalizeApparelPricing(config);
  return (normalized.readyToWear?.tiers || []).map((tier) => ({ ...tier }));
}
