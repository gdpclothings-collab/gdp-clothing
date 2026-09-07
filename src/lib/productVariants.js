const SIZE_ORDER = [
  "NB", "0-3M", "3-6M", "6-9M", "6-12M", "9-12M", "12-18M", "18-24M",
  "2T", "3T", "4T", "5T", "YXS", "YS", "YM", "YL", "YXL",
  "XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL",
];

export function normalizeVariantValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizedSizeToken(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^XXL$/, "2XL")
    .replace(/^XXXL$/, "3XL")
    .replace(/^XXXXL$/, "4XL")
    .replace(/^XXXXXL$/, "5XL")
    .replace(/^YOUTH/, "Y");
}

export function sortApparelSizes(values = []) {
  const unique = [...new Map(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .map((value) => [normalizedSizeToken(value), value])
  ).values()];

  return unique.sort((left, right) => {
    const leftToken = normalizedSizeToken(left);
    const rightToken = normalizedSizeToken(right);
    const leftRank = SIZE_ORDER.indexOf(leftToken);
    const rightRank = SIZE_ORDER.indexOf(rightToken);
    const safeLeftRank = leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank;
    const safeRightRank = rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank;
    return safeLeftRank - safeRightRank || left.localeCompare(right, undefined, { numeric: true });
  });
}

export function findProductVariant(product, color, size) {
  const variants = (product?.variants || []).filter((variant) => variant?.active !== false);
  const wantedColor = normalizeVariantValue(color);
  const wantedSize = normalizeVariantValue(size);

  return variants.find((variant) => {
    const variantColor = normalizeVariantValue(variant.color);
    const variantSize = normalizeVariantValue(variant.size);
    return (!variantColor || variantColor === wantedColor) && (!variantSize || variantSize === wantedSize);
  }) || null;
}

export function isProductVariantAvailable(product, variant) {
  if (!product?.variants?.length) return true;
  if (!variant || variant.active === false) return false;
  if (product.trackInventory === false || product.sellWhenOutOfStock === true) return true;
  return Number(variant.stock || 0) > 0;
}
