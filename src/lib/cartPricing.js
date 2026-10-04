import {
  DEFAULT_APPAREL_PRICING,
  apparelPlacementKey,
  apparelProductKey,
  getExactBundlePrice,
  getVolumePercent,
  normalizeApparelPricing,
} from "./apparelPricing.js";

const CACHE_KEY = "gdp_apparel_pricing_v1";
let cachedPricing = normalizeApparelPricing(DEFAULT_APPAREL_PRICING);

if (typeof window !== "undefined") {
  try {
    const stored = window.localStorage.getItem(CACHE_KEY);
    if (stored) cachedPricing = normalizeApparelPricing(JSON.parse(stored));
  } catch { /* use defaults */ }

  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && anonKey) {
    fetch(`${supabaseUrl}/rest/v1/store_settings?id=eq.1&select=apparel_pricing`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("pricing config unavailable")))
      .then((rows) => {
        const raw = Array.isArray(rows) ? rows[0]?.apparel_pricing : null;
        if (!raw) return;
        const next = normalizeApparelPricing(raw);
        const previous = JSON.stringify(cachedPricing);
        const serialized = JSON.stringify(next);
        cachedPricing = next;
        try { window.localStorage.setItem(CACHE_KEY, serialized); } catch { /* ignore */ }

        if (previous !== serialized && /^\/(cart|checkout)/.test(window.location.pathname)) {
          const guard = `gdp_pricing_reload_${serialized.length}_${next.customQuoteMinQty}`;
          if (window.sessionStorage.getItem(guard) !== "1") {
            window.sessionStorage.setItem(guard, "1");
            window.location.reload();
          }
        }
      })
      .catch(() => {});
  }
}

export function calculateCartQuantityDiscount(items = []) {
  const config = cachedPricing;
  let subtotal = 0;
  let afterDiscount = 0;
  let eligibleSubtotal = 0;
  let exemptSubtotal = 0;
  let eligibleCount = 0;
  let requiresQuote = false;
  let readyToWearDiscount = 0;
  const readyToWearPercents = new Set();
  const readyToWearQuantityByProduct = new Map();

  if (config.enabled && config.readyToWear?.enabled) {
    for (const item of items) {
      if (item.discountExempt) continue;
      const isCustom = Boolean(item.isCustom || item.customDesignId);
      const isReadyToWear = item.sellingMode === "ready_to_wear" && !isCustom && !item.isDtf;
      if (!isReadyToWear) continue;

      const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
      const rawUnitPrice = Math.max(0, Number(item.price || 0));
      const compareAtPrice = Number(item.compareAtPrice || 0);
      const saleActive = Number.isFinite(compareAtPrice) && compareAtPrice > rawUnitPrice;
      const canStackWithSale = config.readyToWear.allowSaleStacking !== false || !saleActive;
      const productId = String(item.productId || "").trim();
      if (!canStackWithSale || !productId) continue;

      readyToWearQuantityByProduct.set(
        productId,
        Number(readyToWearQuantityByProduct.get(productId) || 0) + quantity,
      );
    }
  }

  for (const item of items) {
    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
    const rawUnitPrice = Math.max(0, Number(item.price || 0));

    if (item.discountExempt) {
      const line = rawUnitPrice * quantity;
      subtotal += line;
      afterDiscount += line;
      exemptSubtotal += line;
      continue;
    }

    const isCustom = Boolean(item.isCustom || item.customDesignId);
    const isReadyToWear = item.sellingMode === "ready_to_wear" && !isCustom && !item.isDtf;
    const productKey = isCustom
      ? apparelProductKey(item.productType || item.variant || "", item.name || "")
      : null;
    const placement = apparelPlacementKey(item.placement || "front");

    if (config.enabled && isReadyToWear && config.readyToWear?.enabled) {
      const line = rawUnitPrice * quantity;
      const compareAtPrice = Number(item.compareAtPrice || 0);
      const saleActive = Number.isFinite(compareAtPrice) && compareAtPrice > rawUnitPrice;
      const canStackWithSale = config.readyToWear.allowSaleStacking !== false || !saleActive;
      const productId = String(item.productId || "").trim();
      const tierQuantity = canStackWithSale && productId
        ? Number(readyToWearQuantityByProduct.get(productId) || quantity)
        : quantity;
      const readyToWearTier = (config.readyToWear.tiers || []).find((tier) => tierQuantity >= Number(tier?.min || 0) && tierQuantity <= Number(tier?.max || 0));
      const percent = canStackWithSale ? Number(readyToWearTier?.percent || 0) : 0;
      const discountedLine = line * (1 - percent / 100);
      subtotal += line;
      afterDiscount += discountedLine;
      eligibleSubtotal += line;
      eligibleCount += quantity;
      if (percent > 0) {
        readyToWearDiscount += Math.max(0, line - discountedLine);
        readyToWearPercents.add(percent);
      }
      continue;
    }

    if (!config.enabled || !productKey) {
      const line = rawUnitPrice * quantity;
      subtotal += line;
      afterDiscount += line;
      eligibleSubtotal += line;
      eligibleCount += quantity;
      continue;
    }

    const onePrice = Number(config.products?.[productKey]?.[placement]?.[1] ?? rawUnitPrice);
    const surcharge = Math.max(0, rawUnitPrice - onePrice);
    const regularLine = onePrice * quantity + surcharge * quantity;
    subtotal += regularLine;
    eligibleSubtotal += regularLine;
    eligibleCount += quantity;

    if (quantity >= Number(config.customQuoteMinQty || 50)) {
      requiresQuote = true;
      afterDiscount += regularLine;
      continue;
    }

    const exact = [2, 5, 10].includes(quantity)
      ? getExactBundlePrice(config, productKey, placement, quantity)
      : null;
    if (exact != null) {
      afterDiscount += Number(exact) + surcharge * quantity;
      continue;
    }

    const percent = getVolumePercent(config, quantity);
    afterDiscount += onePrice * quantity * (1 - percent / 100) + surcharge * quantity;
  }

  const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  subtotal = round(subtotal);
  afterDiscount = round(afterDiscount);
  const discount = round(Math.max(0, subtotal - afterDiscount));
  const factor = eligibleSubtotal > 0
    ? afterDiscount / Math.max(eligibleSubtotal + exemptSubtotal, 0.01)
    : 1;
  readyToWearDiscount = round(readyToWearDiscount);
  const readyToWearOnly = readyToWearDiscount > 0 && readyToWearDiscount === discount;
  const sortedReadyToWearPercents = [...readyToWearPercents].sort((a, b) => a - b);
  const label = discount <= 0
    ? ""
    : readyToWearOnly
      ? "Ready-to-wear Buy More & Save applied" + (sortedReadyToWearPercents.length === 1 ? " · " + sortedReadyToWearPercents[0] + "% off" : "")
      : readyToWearDiscount > 0
        ? "GDP quantity savings applied"
        : "GDP bundle / volume pricing applied";

  return {
    subtotal,
    afterDiscount,
    discount,
    eligibleSubtotal: round(eligibleSubtotal),
    exemptSubtotal: round(exemptSubtotal),
    eligibleCount,
    factor,
    requiresQuote,
    customQuoteMinQty: Number(config.customQuoteMinQty || 50),
    readyToWearDiscount,
    readyToWearPercents: sortedReadyToWearPercents,
    label,
  };
}
