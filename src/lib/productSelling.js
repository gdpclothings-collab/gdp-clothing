const SELLING_MODES = new Set(["ready_to_wear", "custom", "service"]);

export const PRODUCT_SELLING_MODES = Object.freeze({
  READY_TO_WEAR: "ready_to_wear",
  CUSTOM: "custom",
  SERVICE: "service",
});

const clean = (value) => String(value || "").trim();
const normalized = (value) => clean(value).toLowerCase();

export function isDtfProduct(product) {
  return product?.slug === "dtf-gang-sheet"
    || product?.themeTemplate === "dtf-gang-sheet"
    || product?.theme_template === "dtf-gang-sheet"
    || product?.metafields?.dtf_gang_sheet === true;
}

export function resolveProductSellingMode(product) {
  const explicit = normalized(product?.sellingMode || product?.selling_mode);
  if (SELLING_MODES.has(explicit)) return explicit;
  if (isDtfProduct(product)) return PRODUCT_SELLING_MODES.SERVICE;
  if (product?.customDesignable === true || product?.custom_designable === true) {
    return PRODUCT_SELLING_MODES.CUSTOM;
  }
  return PRODUCT_SELLING_MODES.READY_TO_WEAR;
}

export function isReadyToWearProduct(product) {
  return resolveProductSellingMode(product) === PRODUCT_SELLING_MODES.READY_TO_WEAR;
}

export function isCustomProduct(product) {
  return resolveProductSellingMode(product) === PRODUCT_SELLING_MODES.CUSTOM;
}

export function isServiceProduct(product) {
  return resolveProductSellingMode(product) === PRODUCT_SELLING_MODES.SERVICE;
}

export function onlineStoreEnabled(product) {
  const channels = product?.salesChannels || product?.sales_channels;
  if (!Array.isArray(channels) || channels.length === 0) return true;
  return channels.includes("online_store");
}

export function activeProductVariants(product) {
  return (product?.variants || product?.product_variants || [])
    .filter((variant) => variant?.active !== false);
}

export function readyToWearReadiness(
  product,
  { requireActive = false, requireSellableStock = false } = {}
) {
  if (!isReadyToWearProduct(product)) {
    return { ready: false, blockers: ["Product selling mode is not Ready to Wear."] };
  }

  const blockers = [];
  const variants = activeProductVariants(product);

  if (requireActive && product?.status !== "active") {
    blockers.push("Set product status to Active.");
  }
  if (!onlineStoreEnabled(product)) {
    blockers.push("Enable the Online Store sales channel.");
  }
  if (!variants.length) {
    blockers.push("Create at least one active variant.");
  }

  const hasSellPrice = Number(product?.price || 0) > 0
    || variants.some((variant) => Number(variant?.price || 0) > 0);
  if (!hasSellPrice) {
    blockers.push("Set a selling price greater than $0.");
  }

  if (requireSellableStock
      && product?.trackInventory !== false && product?.track_inventory !== false
      && product?.sellWhenOutOfStock !== true && product?.sell_when_out_of_stock !== true
      && variants.length
      && !variants.some((variant) => Number(variant?.stock || 0) > 0)) {
    blockers.push("Add stock to at least one variant, or explicitly allow selling when out of stock.");
  }

  const seen = new Set();
  for (const variant of variants) {
    const key = `${normalized(variant?.color)}::${normalized(variant?.size)}`;
    if (seen.has(key)) {
      blockers.push("Remove duplicate colour / size variant combinations.");
      break;
    }
    seen.add(key);
  }

  return { ready: blockers.length === 0, blockers };
}

export function readyToWearStatusLabel(product) {
  const publish = readyToWearReadiness(product, { requireActive: true });
  if (!publish.ready) return "Setup required";

  const sellable = readyToWearReadiness(product, {
    requireActive: true,
    requireSellableStock: true,
  });
  return sellable.ready ? "Ready to sell" : "Out of stock";
}
