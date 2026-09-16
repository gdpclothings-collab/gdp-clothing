import { resolveProductSellingMode } from "@/lib/productSelling";

const SUPABASE_PRODUCT_IMAGE_PREFIX = "/storage/v1/object/public/product-images/";
const SUPABASE_PRODUCT_RENDER_PREFIX = "/storage/v1/render/image/public/product-images/";
const STOREFRONT_DEFAULT_IMAGE_WIDTH = 1600;
const STOREFRONT_DEFAULT_IMAGE_QUALITY = 85;

/**
 * Product images are display media, not production artwork. A few storefront
 * surfaces intentionally use a plain <img> instead of the shared responsive
 * Image component (for example Home cards and the Custom Studio garment
 * picker). Give those consumers a bounded Supabase render URL instead of a
 * multi-megabyte legacy PNG. The shared Image component recognizes this render
 * URL and can still refine it to the actual card/detail dimensions.
 */
export function storefrontProductImageUrl(source) {
  const src = String(source || "").trim();
  if (!src) return src;

  try {
    const url = new URL(src);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !url.hostname.endsWith(".supabase.co") ||
      !url.pathname.startsWith(SUPABASE_PRODUCT_IMAGE_PREFIX)
    ) {
      return src;
    }

    const objectPath = url.pathname.slice(SUPABASE_PRODUCT_IMAGE_PREFIX.length);
    if (!objectPath || /\.svg$/i.test(objectPath)) return src;

    const params = new URLSearchParams({
      width: String(STOREFRONT_DEFAULT_IMAGE_WIDTH),
      resize: "contain",
      quality: String(STOREFRONT_DEFAULT_IMAGE_QUALITY),
    });
    return `${url.origin}${SUPABASE_PRODUCT_RENDER_PREFIX}${objectPath}?${params.toString()}`;
  } catch {
    return src;
  }
}

export function normalizeProduct(row) {
  if (!row) return null;
  const normalized = {
    ...row,
    images: Array.isArray(row.images)
      ? row.images.map(storefrontProductImageUrl)
      : row.images,
    compareAtPrice: row.compare_at_price,
    costPerItem: row.cost_per_item,
    trackInventory: row.track_inventory,
    sellWhenOutOfStock: row.sell_when_out_of_stock,
    requiresShipping: row.requires_shipping,
    weightUnit: row.weight_unit,
    fulfillmentMode: row.fulfillment_mode,
    podProvider: row.pod_provider,
    bestSeller: row.best_seller,
    newArrival: row.new_arrival,
    customDesignable: row.custom_designable,
    variants: (row.product_variants || []).filter((variant) => variant.active !== false).map((variant) => ({
      id: variant.id,
      name: variant.name || "Default",
      sku: variant.sku || "",
      podSku: variant.pod_sku || "",
      stock: Number(variant.stock || 0),
      price: variant.price == null ? null : Number(variant.price),
      costPerItem: variant.cost_per_item == null ? null : Number(variant.cost_per_item),
      color: variant.color || "",
      size: variant.size || "",
      active: variant.active !== false,
    })),
    createdDate: row.created_at,
    updatedDate: row.updated_at,
  };

  normalized.sellingMode = resolveProductSellingMode(normalized);
  return normalized;
}

export function normalizeReview(row) {
  if (!row) return null;
  return {
    ...row,
    productId: row.product_id,
    productName: row.product_name,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
  };
}
