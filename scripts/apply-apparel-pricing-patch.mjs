import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Patch anchor missing: ${label}`);
  return source.replace(search, replacement);
}

// 1) Make custom cart items self-describing so cart pricing can classify them safely.
{
  const path = "src/pages/CustomStudioV2.jsx";
  let source = read(path);
  source = replaceOnce(
    source,
    "        name: product.name,\n        image: customerMockupUpload.file_url,\n        price,\n        quantity,",
    "        name: product.name,\n        productType: product.type || '',\n        placement: bothSides ? 'front_back' : firstSide,\n        image: customerMockupUpload.file_url,\n        price,\n        quantity,",
    "CustomStudioV2 cart metadata",
  );
  write(path, source);
}

// 2) Replace the old 20%/25% cart-wide rule with admin-managed custom-apparel pricing.
{
  const path = "src/lib/cartPricing.js";
  write(path, `import { supabase } from "@/lib/supabaseClient";\nimport {\n  DEFAULT_APPAREL_PRICING,\n  apparelPlacementKey,\n  apparelProductKey,\n  getExactBundlePrice,\n  getVolumePercent,\n  normalizeApparelPricing,\n} from "@/lib/apparelPricing";\n\nconst CACHE_KEY = "gdp_apparel_pricing_v1";\nlet cachedPricing = normalizeApparelPricing(DEFAULT_APPAREL_PRICING);\n\nif (typeof window !== "undefined") {\n  try {\n    const stored = window.localStorage.getItem(CACHE_KEY);\n    if (stored) cachedPricing = normalizeApparelPricing(JSON.parse(stored));\n  } catch { /* use defaults */ }\n\n  Promise.resolve(\n    supabase.from("store_settings").select("apparel_pricing").eq("id", 1).maybeSingle()\n  ).then(({ data, error }) => {\n    if (error || !data?.apparel_pricing) return;\n    const next = normalizeApparelPricing(data.apparel_pricing);\n    const previous = JSON.stringify(cachedPricing);\n    const serialized = JSON.stringify(next);\n    cachedPricing = next;\n    try { window.localStorage.setItem(CACHE_KEY, serialized); } catch { /* ignore */ }\n\n    // A direct visit to Cart/Checkout can render before the settings request finishes.\n    // Reload once only when the server configuration actually changed.\n    if (previous !== serialized && /^\\/(cart|checkout)/.test(window.location.pathname)) {\n      const guard = \`gdp_pricing_reload_\${serialized.length}_\${next.customQuoteMinQty}\`;\n      if (window.sessionStorage.getItem(guard) !== "1") {\n        window.sessionStorage.setItem(guard, "1");\n        window.location.reload();\n      }\n    }\n  }).catch(() => {});\n}\n\nexport function calculateCartQuantityDiscount(items = []) {\n  const config = cachedPricing;\n  let subtotal = 0;\n  let afterDiscount = 0;\n  let eligibleSubtotal = 0;\n  let exemptSubtotal = 0;\n  let eligibleCount = 0;\n  let requiresQuote = false;\n\n  for (const item of items) {\n    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));\n    const rawUnitPrice = Math.max(0, Number(item.price || 0));\n\n    if (item.discountExempt) {\n      const line = rawUnitPrice * quantity;\n      subtotal += line; afterDiscount += line; exemptSubtotal += line;\n      continue;\n    }\n\n    const isCustom = Boolean(item.isCustom || item.customDesignId);\n    const productKey = isCustom ? apparelProductKey(item.productType || item.variant || "", item.name || "") : null;\n    const placement = apparelPlacementKey(item.placement || "front");\n\n    if (!config.enabled || !productKey) {\n      const line = rawUnitPrice * quantity;\n      subtotal += line; afterDiscount += line; eligibleSubtotal += line; eligibleCount += quantity;\n      continue;\n    }\n\n    const onePrice = Number(config.products?.[productKey]?.[placement]?.[1] ?? rawUnitPrice);\n    const surcharge = Math.max(0, rawUnitPrice - onePrice);\n    const regularLine = onePrice * quantity + surcharge * quantity;\n    subtotal += regularLine; eligibleSubtotal += regularLine; eligibleCount += quantity;\n\n    if (quantity >= Number(config.customQuoteMinQty || 50)) {\n      requiresQuote = true;\n      afterDiscount += regularLine;\n      continue;\n    }\n\n    const exact = [2, 5, 10].includes(quantity)\n      ? getExactBundlePrice(config, productKey, placement, quantity)\n      : null;\n    if (exact != null) {\n      afterDiscount += Number(exact) + surcharge * quantity;\n      continue;\n    }\n\n    const percent = getVolumePercent(config, quantity);\n    afterDiscount += onePrice * quantity * (1 - percent / 100) + surcharge * quantity;\n  }\n\n  const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;\n  subtotal = round(subtotal);\n  afterDiscount = round(afterDiscount);\n  const discount = round(Math.max(0, subtotal - afterDiscount));\n  const factor = eligibleSubtotal > 0 ? afterDiscount / Math.max(eligibleSubtotal + exemptSubtotal, 0.01) : 1;\n\n  return {\n    subtotal, afterDiscount, discount, eligibleSubtotal: round(eligibleSubtotal),\n    exemptSubtotal: round(exemptSubtotal), eligibleCount, factor, requiresQuote,\n    customQuoteMinQty: Number(config.customQuoteMinQty || 50),\n    label: discount > 0 ? "GDP bundle / volume pricing applied" : "",\n  };\n}\n`);
}

// 3) Update cart wording so it no longer advertises the retired 20% / 25% rule.
{
  const path = "src/pages/CartV2.jsx";
  let source = read(path);
  source = source.replaceAll("25% apparel quantity discount applied", "GDP bundle / volume pricing applied");
  source = source.replaceAll("20% apparel quantity discount applied", "GDP bundle / volume pricing applied");
  write(path, source);
}

// 4) Server-authoritative checkout pricing. This is the security boundary: browser totals are never trusted.
{
  const path = "supabase/functions/checkout/index.ts";
  let source = read(path);

  const helperAnchor = "function numberOr(value: unknown, fallback: number) {";
  const helpers = `const defaultApparelPricing = {\n  enabled: true,\n  currency: "CAD",\n  customQuoteMinQty: 50,\n  allowCouponStacking: true,\n  products: {\n    tshirt: { front: { 1: 34.99, 2: 64.99, 5: 149.99, 10: 279.99 }, front_back: { 1: 44.99, 2: 84.99, 5: 199.99, 10: 369.99 } },\n    crewneck: { front: { 1: 59.99, 2: 109.99, 5: 259.99, 10: 489.99 }, front_back: { 1: 69.99, 2: 129.99, 5: 309.99, 10: 579.99 } },\n    hoodie: { front: { 1: 69.99, 2: 129.99, 5: 309.99, 10: 579.99 }, front_back: { 1: 79.99, 2: 149.99, 5: 359.99, 10: 669.99 } },\n  },\n  tiers: [\n    { min: 3, max: 5, percent: 5 },\n    { min: 6, max: 9, percent: 10 },\n    { min: 10, max: 19, percent: 15 },\n    { min: 20, max: 49, percent: 20 },\n  ],\n};\n\nfunction normalizeApparelPricing(raw: any = {}) {\n  const next: any = { ...defaultApparelPricing, ...(raw || {}) };\n  next.products = { ...defaultApparelPricing.products, ...(raw?.products || {}) };\n  next.tiers = Array.isArray(raw?.tiers) && raw.tiers.length ? raw.tiers : defaultApparelPricing.tiers;\n  next.customQuoteMinQty = Math.max(1, Math.floor(Number(raw?.customQuoteMinQty || 50)));\n  next.enabled = raw?.enabled !== false;\n  next.allowCouponStacking = raw?.allowCouponStacking !== false;\n  return next;\n}\n\nfunction apparelProductKey(product: any) {\n  const value = \`\${String(product?.type || "")} \${String(product?.name || "")}\`.toLowerCase();\n  if (value.includes("hoodie")) return "hoodie";\n  if (value.includes("crewneck") || value.includes("sweatshirt")) return "crewneck";\n  if (value.includes("t-shirt") || value.includes("tshirt") || value.includes("tee")) return "tshirt";\n  return null;\n}\n\nfunction apparelPlacementKey(design: any) {\n  return design?.placement === "front_back" ? "front_back" : "front";\n}\n\nfunction apparelVolumePercent(settings: any, quantity: number) {\n  const tier = (settings?.tiers || []).find((row: any) => quantity >= Number(row?.min || 0) && quantity <= Number(row?.max || 0));\n  return Math.min(95, Math.max(0, Number(tier?.percent || 0)));\n}\n\n`;
  source = replaceOnce(source, helperAnchor, helpers + helperAnchor, "checkout apparel helpers");

  source = replaceOnce(
    source,
    '.select("order_prefix,dtf_settings,payment_mode,test_inventory_workflow")',
    '.select("order_prefix,dtf_settings,payment_mode,test_inventory_workflow,apparel_pricing")',
    "checkout store settings select",
  );

  source = replaceOnce(
    source,
    '    const paymentMode = storeSettings?.payment_mode === "test" ? "test" : "live";\n',
    '    const paymentMode = storeSettings?.payment_mode === "test" ? "test" : "live";\n    const apparelPricing = normalizeApparelPricing(storeSettings?.apparel_pricing || {});\n',
    "checkout apparel settings init",
  );

  const designBlock = `      } else if (design) {\n        const cfg = product.customization || {};\n        if (design.placement === "front_back") unitPrice += Number(cfg.frontBackFee ?? 10);\n        if (design.priority === "rush") {\n          unitPrice += Number(cfg.rushDesignFee ?? 10) + Number(cfg.rushProductionFee ?? 15);\n        }\n      }`;
  const designReplacement = `      } else if (design) {\n        const cfg = product.customization || {};\n        if (design.placement === "front_back") unitPrice += Number(cfg.frontBackFee ?? 10);\n        if (design.priority === "rush") {\n          unitPrice += Number(cfg.rushDesignFee ?? 10) + Number(cfg.rushProductionFee ?? 15);\n        }\n\n        const apparelKey = apparelProductKey(product);\n        if (apparelPricing.enabled && apparelKey) {\n          const placementKey = apparelPlacementKey(design);\n          const productBase = Number(product.price || 0) + (placementKey === "front_back" ? Number(cfg.frontBackFee ?? 10) : 0);\n          const surcharge = roundMoney(Math.max(0, unitPrice - productBase));\n          const configuredOne = Number(apparelPricing.products?.[apparelKey]?.[placementKey]?.[1]);\n          if (Number.isFinite(configuredOne) && configuredOne >= 0) {\n            unitPrice = configuredOne + surcharge;\n            customData = {\n              ...customData,\n              apparelPricingKey: apparelKey,\n              apparelPlacement: placementKey,\n              apparelSurcharge: surcharge,\n            };\n          }\n        }\n      }`;
  source = replaceOnce(source, designBlock, designReplacement, "checkout custom design pricing");

  const oldDiscount = `    subtotal = roundMoney(subtotal);\n    eligibleSubtotal = roundMoney(eligibleSubtotal);\n    exemptSubtotal = roundMoney(exemptSubtotal);\n    const quantityFactor = eligibleItemCount >= 3 ? 0.75 : eligibleItemCount >= 2 ? 0.80 : 1;\n    const eligibleDiscounted = roundMoney(eligibleSubtotal * quantityFactor);\n    const discounted = roundMoney(eligibleDiscounted + exemptSubtotal);\n    const quantityDiscount = roundMoney(eligibleSubtotal - eligibleDiscounted);`;
  const newDiscount = `    subtotal = roundMoney(subtotal);\n    eligibleSubtotal = roundMoney(eligibleSubtotal);\n    exemptSubtotal = roundMoney(exemptSubtotal);\n\n    let eligibleDiscounted = 0;\n    for (const item of normalizedItems) {\n      if (item.discountExempt) continue;\n      const apparelKey = String((item.customData as any)?.apparelPricingKey || "");\n      if (!apparelKey) {\n        eligibleDiscounted += Number(item.unitPrice || 0) * Number(item.quantity || 1);\n        continue;\n      }\n\n      const quantity = Number(item.quantity || 1);\n      if (quantity >= Number(apparelPricing.customQuoteMinQty || 50)) {\n        return respond(req, {\n          error: true,\n          message: \`Orders of \${apparelPricing.customQuoteMinQty}+ custom apparel pieces require a custom quote. Please contact GDP Clothing.\`,\n          requiresQuote: true,\n        }, 409);\n      }\n\n      const placementKey = String((item.customData as any)?.apparelPlacement || "front");\n      const surcharge = Math.max(0, Number((item.customData as any)?.apparelSurcharge || 0));\n      const matrix = apparelPricing.products?.[apparelKey]?.[placementKey] || {};\n      const exact = [2, 5, 10].includes(quantity) ? Number(matrix?.[quantity]) : NaN;\n      if (Number.isFinite(exact) && exact >= 0) {\n        eligibleDiscounted += exact + surcharge * quantity;\n      } else {\n        const onePrice = Math.max(0, Number(matrix?.[1] ?? (Number(item.unitPrice || 0) - surcharge)));\n        const percent = apparelVolumePercent(apparelPricing, quantity);\n        eligibleDiscounted += onePrice * quantity * (1 - percent / 100) + surcharge * quantity;\n      }\n    }\n\n    eligibleDiscounted = roundMoney(eligibleDiscounted);\n    const discounted = roundMoney(eligibleDiscounted + exemptSubtotal);\n    const quantityDiscount = roundMoney(Math.max(0, eligibleSubtotal - eligibleDiscounted));`;
  source = replaceOnce(source, oldDiscount, newDiscount, "checkout quantity discount engine");

  source = replaceOnce(
    source,
    '    const coupon = await getCoupon(service, couponCode, discounted);',
    '    const coupon = (apparelPricing.allowCouponStacking || quantityDiscount <= 0) ? await getCoupon(service, couponCode, discounted) : null;',
    "checkout coupon stacking policy",
  );

  write(path, source);
}

console.log("GDP apparel pricing patch applied successfully.");
