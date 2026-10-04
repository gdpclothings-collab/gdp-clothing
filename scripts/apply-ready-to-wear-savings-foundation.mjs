import fs from "node:fs";

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, "utf8");
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected one match, found ${count}`);
  }
  fs.writeFileSync(path, source.replace(before, after));
}

// Shared pricing contract: add an explicitly disabled Ready-to-Wear promotion block.
replaceOnce(
  "src/lib/apparelPricing.js",
  `  allowCouponStacking: true,\n  products: {`,
  `  allowCouponStacking: true,\n  readyToWear: {\n    enabled: false,\n    allowSaleStacking: true,\n    tiers: [\n      { min: 2, max: 2, percent: 10 },\n      { min: 3, max: 999, percent: 15 },\n    ],\n  },\n  products: {`,
);

replaceOnce(
  "src/lib/apparelPricing.js",
  `  next.customQuoteMinQty = Math.max(1, Math.floor(Number(raw?.customQuoteMinQty || 50)));\n  next.enabled = raw?.enabled !== false;\n  next.allowCouponStacking = raw?.allowCouponStacking !== false;\n  next.currency = "CAD";\n  next.sourcing = normalizeGarmentSourcing(raw?.sourcing || {});\n  return next;\n}`,
  `  next.customQuoteMinQty = Math.max(1, Math.floor(Number(raw?.customQuoteMinQty || 50)));\n  next.enabled = raw?.enabled !== false;\n  next.allowCouponStacking = raw?.allowCouponStacking !== false;\n\n  const rawReadyToWear = raw?.readyToWear || {};\n  const readyToWearTiers = Array.isArray(rawReadyToWear?.tiers) && rawReadyToWear.tiers.length\n    ? rawReadyToWear.tiers\n    : DEFAULT_APPAREL_PRICING.readyToWear.tiers;\n  next.readyToWear = {\n    enabled: rawReadyToWear.enabled === true,\n    allowSaleStacking: rawReadyToWear.allowSaleStacking !== false,\n    tiers: readyToWearTiers\n      .map((tier) => {\n        const min = Math.max(1, Math.floor(Number(tier?.min || 1)));\n        return {\n          min,\n          max: Math.max(min, Math.floor(Number(tier?.max || tier?.min || min))),\n          percent: Math.min(95, Math.max(0, Number(tier?.percent || 0))),\n        };\n      })\n      .sort((a, b) => a.min - b.min),\n  };\n\n  next.currency = "CAD";\n  next.sourcing = normalizeGarmentSourcing(raw?.sourcing || {});\n  return next;\n}`,
);

replaceOnce(
  "src/lib/apparelPricing.js",
  `export function getVolumePercent(config, quantity) {\n  const normalized = normalizeApparelPricing(config);\n  const qty = Math.floor(Number(quantity || 1));\n  const tier = normalized.tiers.find((row) => qty >= row.min && qty <= row.max);\n  return Number(tier?.percent || 0);\n}\n`,
  `export function getVolumePercent(config, quantity) {\n  const normalized = normalizeApparelPricing(config);\n  const qty = Math.floor(Number(quantity || 1));\n  const tier = normalized.tiers.find((row) => qty >= row.min && qty <= row.max);\n  return Number(tier?.percent || 0);\n}\n\nexport function getReadyToWearPercent(config, quantity) {\n  const normalized = normalizeApparelPricing(config);\n  if (!normalized.enabled || !normalized.readyToWear?.enabled) return 0;\n  const qty = Math.max(1, Math.floor(Number(quantity || 1)));\n  const tier = normalized.readyToWear.tiers.find((row) => qty >= row.min && qty <= row.max);\n  return Number(tier?.percent || 0);\n}\n\nexport function getReadyToWearTiers(config) {\n  const normalized = normalizeApparelPricing(config);\n  return (normalized.readyToWear?.tiers || []).map((tier) => ({ ...tier }));\n}\n`,
);

// Cart pricing: reuse the same contract for Ready-to-Wear and remove hard-coded discount messaging.
replaceOnce(
  "src/lib/cartPricing.js",
  `  getExactBundlePrice,\n  getVolumePercent,\n  normalizeApparelPricing,`,
  `  getExactBundlePrice,\n  getReadyToWearPercent,\n  getVolumePercent,\n  normalizeApparelPricing,`,
);

replaceOnce(
  "src/lib/cartPricing.js",
  `  let eligibleCount = 0;\n  let requiresQuote = false;`,
  `  let eligibleCount = 0;\n  let requiresQuote = false;\n  let readyToWearDiscount = 0;\n  const readyToWearPercents = new Set();`,
);

replaceOnce(
  "src/lib/cartPricing.js",
  `    const isCustom = Boolean(item.isCustom || item.customDesignId);\n    const productKey = isCustom\n      ? apparelProductKey(item.productType || item.variant || "", item.name || "")\n      : null;\n    const placement = apparelPlacementKey(item.placement || "front");\n\n    if (!config.enabled || !productKey) {\n      const line = rawUnitPrice * quantity;\n      subtotal += line;\n      afterDiscount += line;\n      eligibleSubtotal += line;\n      eligibleCount += quantity;\n      continue;\n    }`,
  `    const isCustom = Boolean(item.isCustom || item.customDesignId);\n    const isReadyToWear = item.sellingMode === "ready_to_wear" && !isCustom && !item.isDtf;\n    const productKey = isCustom\n      ? apparelProductKey(item.productType || item.variant || "", item.name || "")\n      : null;\n    const placement = apparelPlacementKey(item.placement || "front");\n\n    if (config.enabled && isReadyToWear && config.readyToWear?.enabled) {\n      const line = rawUnitPrice * quantity;\n      const compareAtPrice = Number(item.compareAtPrice || 0);\n      const saleActive = Number.isFinite(compareAtPrice) && compareAtPrice > rawUnitPrice;\n      const canStackWithSale = config.readyToWear.allowSaleStacking !== false || !saleActive;\n      const percent = canStackWithSale ? getReadyToWearPercent(config, quantity) : 0;\n      const discountedLine = line * (1 - percent / 100);\n      subtotal += line;\n      afterDiscount += discountedLine;\n      eligibleSubtotal += line;\n      eligibleCount += quantity;\n      if (percent > 0) {\n        readyToWearDiscount += Math.max(0, line - discountedLine);\n        readyToWearPercents.add(percent);\n      }\n      continue;\n    }\n\n    if (!config.enabled || !productKey) {\n      const line = rawUnitPrice * quantity;\n      subtotal += line;\n      afterDiscount += line;\n      eligibleSubtotal += line;\n      eligibleCount += quantity;\n      continue;\n    }`,
);

replaceOnce(
  "src/lib/cartPricing.js",
  `  const factor = eligibleSubtotal > 0\n    ? afterDiscount / Math.max(eligibleSubtotal + exemptSubtotal, 0.01)\n    : 1;\n\n  return {`,
  `  const factor = eligibleSubtotal > 0\n    ? afterDiscount / Math.max(eligibleSubtotal + exemptSubtotal, 0.01)\n    : 1;\n  readyToWearDiscount = round(readyToWearDiscount);\n  const readyToWearOnly = readyToWearDiscount > 0 && readyToWearDiscount === discount;\n  const sortedReadyToWearPercents = [...readyToWearPercents].sort((a, b) => a - b);\n  const label = discount <= 0\n    ? ""\n    : readyToWearOnly\n      ? `Ready-to-wear Buy More & Save applied${sortedReadyToWearPercents.length === 1 ? ` · ${sortedReadyToWearPercents[0]}% off` : ""}`\n      : readyToWearDiscount > 0\n        ? "GDP quantity savings applied"\n        : "GDP bundle / volume pricing applied";\n\n  return {`,
);

replaceOnce(
  "src/lib/cartPricing.js",
  `    customQuoteMinQty: Number(config.customQuoteMinQty || 50),\n    label: discount > 0 ? "GDP bundle / volume pricing applied" : "",`,
  `    customQuoteMinQty: Number(config.customQuoteMinQty || 50),\n    readyToWearDiscount,\n    readyToWearPercents: sortedReadyToWearPercents,\n    label,`,
);

// Product page: read the shared pricing config, show Buy More & Save when enabled, and keep base price authoritative.
replaceOnce(
  "src/pages/ProductDetail.jsx",
  `import { PRODUCT_SELLING_MODES, onlineStoreEnabled, resolveProductSellingMode } from "@/lib/productSelling";`,
  `import { PRODUCT_SELLING_MODES, onlineStoreEnabled, resolveProductSellingMode } from "@/lib/productSelling";\nimport { getReadyToWearPercent, getReadyToWearTiers, normalizeApparelPricing } from "@/lib/apparelPricing";`,
);

replaceOnce(
  "src/pages/ProductDetail.jsx",
  `  const [reviews, setReviews] = useState([]);\n  const [activeImageIndex, setActiveImageIndex] = useState(0);`,
  `  const [reviews, setReviews] = useState([]);\n  const [apparelPricing, setApparelPricing] = useState(() => normalizeApparelPricing({}));\n  const [activeImageIndex, setActiveImageIndex] = useState(0);`,
);

replaceOnce(
  "src/pages/ProductDetail.jsx",
  `  useEffect(() => {\n    if (product?.slug === "dtf-gang-sheet") {`,
  `  useEffect(() => {\n    let active = true;\n    supabase\n      .from("store_settings")\n      .select("apparel_pricing")\n      .eq("id", 1)\n      .maybeSingle()\n      .then(({ data }) => {\n        if (active && data?.apparel_pricing) setApparelPricing(normalizeApparelPricing(data.apparel_pricing));\n      })\n      .catch(() => {});\n    return () => { active = false; };\n  }, []);\n\n  useEffect(() => {\n    if (product?.slug === "dtf-gang-sheet") {`,
);

replaceOnce(
  "src/pages/ProductDetail.jsx",
  `  const isReadyToWear = sellingMode === PRODUCT_SELLING_MODES.READY_TO_WEAR;\n  const isCustom = sellingMode === PRODUCT_SELLING_MODES.CUSTOM;`,
  `  const isReadyToWear = sellingMode === PRODUCT_SELLING_MODES.READY_TO_WEAR;\n  const isCustom = sellingMode === PRODUCT_SELLING_MODES.CUSTOM;\n  const readyToWearPricing = apparelPricing.readyToWear || {};\n  const readyToWearOfferEnabled = Boolean(isReadyToWear && apparelPricing.enabled && readyToWearPricing.enabled);\n  const readyToWearTiers = readyToWearOfferEnabled ? getReadyToWearTiers(apparelPricing) : [];\n  const readyToWearCanStackWithSale = !hasSale || readyToWearPricing.allowSaleStacking !== false;\n  const readyToWearPercent = readyToWearOfferEnabled && readyToWearCanStackWithSale\n    ? getReadyToWearPercent(apparelPricing, qty)\n    : 0;\n  const quantityRegularTotal = displayPrice * qty;\n  const quantityDiscountedTotal = quantityRegularTotal * (1 - readyToWearPercent / 100);\n  const quantitySavings = Math.max(0, quantityRegularTotal - quantityDiscountedTotal);`,
);

replaceOnce(
  "src/pages/ProductDetail.jsx",
  `      price: displayPrice,\n      fulfillmentMode: product.fulfillmentMode,`,
  `      price: displayPrice,\n      compareAtPrice: compareAtPrice || null,\n      fulfillmentMode: product.fulfillmentMode,`,
);

replaceOnce(
  "src/pages/ProductDetail.jsx",
  `          ? "Out of stock"\n          : \`Add to bag · \${formatCad(displayPrice)}\`;`,
  `          ? "Out of stock"\n          : \`Add to bag · \${formatCad(qty > 1 ? quantityDiscountedTotal : displayPrice)}\`;`,
);

replaceOnce(
  "src/pages/ProductDetail.jsx",
  `            {product.metafields?.short_description && <p className="mt-5 text-sm font-semibold leading-6 text-black/72">{product.metafields.short_description}</p>}`,
  `            {readyToWearOfferEnabled && readyToWearTiers.length > 0 && (\n              <div className="mt-5 border border-black/15 bg-white/55 p-4">\n                <div className="flex flex-wrap items-center justify-between gap-2">\n                  <div className="font-mono text-[9px] font-black uppercase tracking-[0.14em]">Buy more & save</div>\n                  <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Automatic in cart</div>\n                </div>\n                <div className="mt-3 grid gap-2 sm:grid-cols-2">\n                  {readyToWearTiers.map((tier) => {\n                    const active = qty >= tier.min && qty <= tier.max && readyToWearCanStackWithSale;\n                    const quantityLabel = tier.max >= 999 || tier.max > tier.min ? \`Buy \${tier.min}+\` : \`Buy \${tier.min}\`;\n                    return <div key={\`\${tier.min}-\${tier.max}-\${tier.percent}\`} className={\`border px-3 py-2.5 \${active ? "border-black bg-black text-white" : "border-black/10 bg-[#f7f6f1]"}\`}><div className="font-mono text-[8px] font-black uppercase tracking-[0.12em]">{quantityLabel}</div><div className="mt-1 text-sm font-black">Save {tier.percent}%</div></div>;\n                  })}\n                </div>\n                {readyToWearPercent > 0 && (\n                  <div className="mt-3 border-t border-black/10 pt-3 text-xs font-semibold">\n                    {qty} × {formatCad(displayPrice)} = {formatCad(quantityDiscountedTotal)} <span className="text-[#b51222]">· You save {formatCad(quantitySavings)}</span>\n                  </div>\n                )}\n                {!readyToWearCanStackWithSale && <div className="mt-3 text-xs text-black/50">Buy More & Save does not stack with this product's current sale price.</div>}\n              </div>\n            )}\n\n            {product.metafields?.short_description && <p className="mt-5 text-sm font-semibold leading-6 text-black/72">{product.metafields.short_description}</p>}`,
);

// Cart summary: never claim a hard-coded percentage that differs from the actual engine result.
replaceOnce(
  "src/pages/Cart.jsx",
  `{pricing.discount > 0 && <div className="mt-4 bg-accent/10 px-3 py-2 text-xs font-bold text-accent">{pricing.eligibleCount >= 3 ? "25% apparel quantity discount applied" : "20% apparel quantity discount applied"}</div>}`,
  `{pricing.discount > 0 && pricing.label && <div className="mt-4 bg-accent/10 px-3 py-2 text-xs font-bold text-accent">{pricing.label}</div>}`,
);

// Admin Pricing: expose Ready-to-Wear tiers but keep them OFF until GDP explicitly activates them.
replaceOnce(
  "src/pages/AdminPricing.jsx",
  `  const setTier = (index, field, value) => {\n    setMessage(""); setError("");\n    setPricing((current) => ({\n      ...current,\n      tiers: current.tiers.map((tier, i) => i === index ? { ...tier, [field]: Number(value || 0) } : tier),\n    }));\n  };`,
  `  const setTier = (index, field, value) => {\n    setMessage(""); setError("");\n    setPricing((current) => ({\n      ...current,\n      tiers: current.tiers.map((tier, i) => i === index ? { ...tier, [field]: Number(value || 0) } : tier),\n    }));\n  };\n\n  const setReadyToWearTier = (index, field, value) => {\n    setMessage(""); setError("");\n    setPricing((current) => ({\n      ...current,\n      readyToWear: {\n        ...current.readyToWear,\n        tiers: current.readyToWear.tiers.map((tier, i) => i === index ? { ...tier, [field]: Number(value || 0) } : tier),\n      },\n    }));\n  };`,
);

replaceOnce(
  "src/pages/AdminPricing.jsx",
  `        <section className="mt-6 rounded-2xl border border-[#dedfe3] bg-white p-5 shadow-sm">\n          <div className="mb-5"><h2 className="text-lg font-bold">Automatic quantity discounts</h2><p className="mt-1 text-sm text-[#666b73]">Used when an exact 2, 5 or 10-piece bundle price does not apply.</p></div>`,
  `        <section className="mt-6 rounded-2xl border border-[#dedfe3] bg-white p-5 shadow-sm">\n          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e5e6e8] pb-5">\n            <div>\n              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a70f2d]">Ready-to-Wear</div>\n              <h2 className="mt-1 text-lg font-bold">Buy More & Save</h2>\n              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#666b73]">System-wide quantity savings for Ready-to-Wear. When enabled, the same tiers are used on the product page, cart, checkout and authoritative server order totals.</p>\n            </div>\n            <label className="flex items-center gap-3 rounded-xl border border-[#d8dade] bg-[#fafafa] px-4 py-3">\n              <div><div className="text-sm font-bold">Promotion enabled</div><div className="mt-0.5 text-xs text-[#6c7078]">OFF by default for safe deployment.</div></div>\n              <input type="checkbox" checked={pricing.readyToWear?.enabled === true} onChange={(e) => setPricing((current) => ({ ...current, readyToWear: { ...current.readyToWear, enabled: e.target.checked } }))} className="h-5 w-5"/>\n            </label>\n          </div>\n          <div className="mt-5 grid gap-4 md:grid-cols-2">\n            {(pricing.readyToWear?.tiers || []).map((tier, index) => (\n              <div key={\`rtw-\${tier.min}-\${tier.max}-\${index}\`} className="rounded-xl border border-[#e1e3e6] bg-[#fafafa] p-4">\n                <div className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[#6c7078]">Tier {index + 1}</div>\n                <div className="grid grid-cols-3 gap-2">\n                  <MoneylessInput label="Min qty" value={tier.min} onChange={(value) => setReadyToWearTier(index, "min", value)}/>\n                  <MoneylessInput label="Max qty" value={tier.max} onChange={(value) => setReadyToWearTier(index, "max", value)}/>\n                  <MoneylessInput label="% off" value={tier.percent} onChange={(value) => setReadyToWearTier(index, "percent", value)}/>\n                </div>\n              </div>\n            ))}\n          </div>\n          <label className="mt-4 flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[#d8dade] px-4">\n            <div><div className="text-sm font-semibold">Allow Buy More & Save on already discounted products</div><div className="mt-0.5 text-xs text-[#6c7078]">When off, compare-at sale products keep their sale price without an extra quantity discount.</div></div>\n            <input type="checkbox" checked={pricing.readyToWear?.allowSaleStacking !== false} onChange={(e) => setPricing((current) => ({ ...current, readyToWear: { ...current.readyToWear, allowSaleStacking: e.target.checked } }))} className="h-5 w-5"/>\n          </label>\n          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">Recommended starter values are staged as Buy 2 = 10% off and Buy 3+ = 15% off, but no Ready-to-Wear discount is activated until you turn this section on and save.</div>\n        </section>\n\n        <section className="mt-6 rounded-2xl border border-[#dedfe3] bg-white p-5 shadow-sm">\n          <div className="mb-5"><h2 className="text-lg font-bold">Custom apparel automatic quantity discounts</h2><p className="mt-1 text-sm text-[#666b73]">Used when an exact 2, 5 or 10-piece custom-apparel bundle price does not apply.</p></div>`,
);

replaceOnce(
  "src/pages/AdminPricing.jsx",
  `<div><div className="text-sm font-semibold">Allow coupon codes after volume pricing</div><div className="mt-0.5 text-xs text-[#6c7078]">Keep enabled for current checkout behavior.</div></div>`,
  `<div><div className="text-sm font-semibold">Allow coupon codes after quantity pricing</div><div className="mt-0.5 text-xs text-[#6c7078]">System-wide stacking policy for Custom Apparel and Ready-to-Wear quantity savings.</div></div>`,
);

// Authoritative checkout: mirror the same disabled-by-default Ready-to-Wear contract server-side.
replaceOnce(
  "supabase/functions/checkout/index.ts",
  `  allowCouponStacking: true,\n  products: {`,
  `  allowCouponStacking: true,\n  readyToWear: {\n    enabled: false,\n    allowSaleStacking: true,\n    tiers: [\n      { min: 2, max: 2, percent: 10 },\n      { min: 3, max: 999, percent: 15 },\n    ],\n  },\n  products: {`,
);

replaceOnce(
  "supabase/functions/checkout/index.ts",
  `  next.customQuoteMinQty = Math.max(1, Math.floor(Number(raw?.customQuoteMinQty || 50)));\n  next.enabled = raw?.enabled !== false;\n  next.allowCouponStacking = raw?.allowCouponStacking !== false;\n  return next;\n}`,
  `  next.customQuoteMinQty = Math.max(1, Math.floor(Number(raw?.customQuoteMinQty || 50)));\n  next.enabled = raw?.enabled !== false;\n  next.allowCouponStacking = raw?.allowCouponStacking !== false;\n  const rawReadyToWear = raw?.readyToWear || {};\n  const readyToWearTiers = Array.isArray(rawReadyToWear?.tiers) && rawReadyToWear.tiers.length\n    ? rawReadyToWear.tiers\n    : defaultApparelPricing.readyToWear.tiers;\n  next.readyToWear = {\n    enabled: rawReadyToWear.enabled === true,\n    allowSaleStacking: rawReadyToWear.allowSaleStacking !== false,\n    tiers: readyToWearTiers\n      .map((tier: any) => {\n        const min = Math.max(1, Math.floor(Number(tier?.min || 1)));\n        return {\n          min,\n          max: Math.max(min, Math.floor(Number(tier?.max || tier?.min || min))),\n          percent: Math.min(95, Math.max(0, Number(tier?.percent || 0))),\n        };\n      })\n      .sort((a: any, b: any) => a.min - b.min),\n  };\n  return next;\n}`,
);

replaceOnce(
  "supabase/functions/checkout/index.ts",
  `function apparelVolumePercent(settings: any, quantity: number) {\n  const tier = (settings?.tiers || []).find((row: any) => quantity >= Number(row?.min || 0) && quantity <= Number(row?.max || 0));\n  return Math.min(95, Math.max(0, Number(tier?.percent || 0)));\n}`,
  `function apparelVolumePercent(settings: any, quantity: number) {\n  const tier = (settings?.tiers || []).find((row: any) => quantity >= Number(row?.min || 0) && quantity <= Number(row?.max || 0));\n  return Math.min(95, Math.max(0, Number(tier?.percent || 0)));\n}\n\nfunction readyToWearVolumePercent(settings: any, quantity: number) {\n  if (settings?.enabled !== true || settings?.readyToWear?.enabled !== true) return 0;\n  const tier = (settings.readyToWear.tiers || []).find((row: any) => quantity >= Number(row?.min || 0) && quantity <= Number(row?.max || 0));\n  return Math.min(95, Math.max(0, Number(tier?.percent || 0)));\n}`,
);

replaceOnce(
  "supabase/functions/checkout/index.ts",
  `        }\n      }\n\n      unitPrice = roundMoney(unitPrice);`,
  `        }\n      } else if (apparelPricing.enabled && apparelPricing.readyToWear?.enabled && product.custom_designable !== true) {\n        const compareAtPrice = Number(product.compare_at_price || 0);\n        const saleActive = Number.isFinite(compareAtPrice) && compareAtPrice > unitPrice;\n        if (!saleActive || apparelPricing.readyToWear.allowSaleStacking !== false) {\n          customData = { ...customData, readyToWearPricingEligible: true };\n        }\n      }\n\n      unitPrice = roundMoney(unitPrice);`,
);

replaceOnce(
  "supabase/functions/checkout/index.ts",
  `      const apparelKey = String((item.customData as any)?.apparelPricingKey || "");\n      if (!apparelKey) {\n        eligibleDiscounted += Number(item.unitPrice || 0) * Number(item.quantity || 1);\n        continue;\n      }`,
  `      const readyToWearEligible = (item.customData as any)?.readyToWearPricingEligible === true;\n      if (readyToWearEligible) {\n        const quantity = Number(item.quantity || 1);\n        const percent = readyToWearVolumePercent(apparelPricing, quantity);\n        eligibleDiscounted += Number(item.unitPrice || 0) * quantity * (1 - percent / 100);\n        continue;\n      }\n\n      const apparelKey = String((item.customData as any)?.apparelPricingKey || "");\n      if (!apparelKey) {\n        eligibleDiscounted += Number(item.unitPrice || 0) * Number(item.quantity || 1);\n        continue;\n      }`,
);

console.log("Ready-to-Wear savings foundation patch applied successfully.");
