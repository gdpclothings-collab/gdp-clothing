import { supabase } from "@/lib/supabaseClient";
import { adminApi } from "@/lib/adminApi";

const mapProduct = (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description || "",
  type: row.type || "",
  category: row.category || "",
  vendor: row.vendor || "GDP Clothing",
  barcode: row.barcode || "",
  costPerItem: row.cost_per_item,
  trackInventory: row.track_inventory !== false,
  requiresShipping: row.requires_shipping !== false,
  taxable: row.taxable !== false,
  weight: row.weight,
  weightUnit: row.weight_unit || "g",
  salesChannels: row.sales_channels || ["online_store"],
  sellWhenOutOfStock: Boolean(row.sell_when_out_of_stock),
  shippingPackage: row.shipping_package || {},
  countryOfOrigin: row.country_of_origin || "",
  hsCode: row.hs_code || "",
  themeTemplate: row.theme_template || "default",
  metafields: row.metafields || {},
  unitPrice: row.unit_price || {},
  price: Number(row.price || 0),
  compareAtPrice: row.compare_at_price,
  images: row.images || [],
  colors: row.colors || [],
  sizes: row.sizes || [],
  tags: row.tags || [],
  fulfillmentMode: row.fulfillment_mode || "in_house",
  podProvider: row.pod_provider || "",
  status: row.status || "draft",
  featured: Boolean(row.featured),
  bestSeller: Boolean(row.best_seller),
  newArrival: Boolean(row.new_arrival),
  customDesignable: Boolean(row.custom_designable),
  customization: row.customization || {},
  material: row.material || "",
  seo: row.seo || {},
  variants: (row.product_variants || []).filter((variant) => variant.active !== false).map((variant) => ({
    id: variant.id,
    name: variant.name || "Default",
    sku: variant.sku || "",
    barcode: variant.barcode || "",
    podSku: variant.pod_sku || "",
    stock: Number(variant.stock || 0),
    price: variant.price === null ? null : Number(variant.price),
    costPerItem: variant.cost_per_item == null ? null : Number(variant.cost_per_item),
    color: variant.color || "",
    size: variant.size || "",
    active: variant.active !== false,
  })),
  collectionIds: (row.collection_products || []).map((link) => link.collection_id),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const adminProductsApi = {
  async list({
    page = 1,
    pageSize = 25,
    search = "",
    status = "all",
    inventory = "all",
    category = "",
    vendor = "",
    minPrice = "",
    maxPrice = "",
    updatedWithinDays = "all",
    lowStockThreshold = 5,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(10, Number(pageSize) || 25));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    let inventoryProductIds = null;
    if (inventory !== "all" && inventory !== "not_tracked") {
      const { data: variantRows, error: variantError } = await supabase
        .from("product_variants")
        .select("product_id, stock, active")
        .eq("active", true);

      if (variantError) throw variantError;

      const byProduct = new Map();
      for (const variant of variantRows || []) {
        const productId = variant.product_id;
        if (!productId) continue;
        const current = byProduct.get(productId) || { total: 0, hasLow: false };
        const stock = Number(variant.stock || 0);
        current.total += stock;
        if (stock <= Number(lowStockThreshold || 0)) current.hasLow = true;
        byProduct.set(productId, current);
      }

      inventoryProductIds = [];
      for (const [productId, stockState] of byProduct.entries()) {
        const matches =
          inventory === "in_stock"
            ? stockState.total > 0
            : inventory === "low_stock"
              ? stockState.hasLow
              : inventory === "out_of_stock"
                ? stockState.total <= 0
                : true;
        if (matches) inventoryProductIds.push(productId);
      }

      if (inventory === "out_of_stock") {
        const { data: trackedProducts, error: trackedError } = await supabase
          .from("products")
          .select("id")
          .eq("track_inventory", true);
        if (trackedError) throw trackedError;
        const known = new Set(inventoryProductIds);
        for (const product of trackedProducts || []) {
          if (!byProduct.has(product.id) && !known.has(product.id)) {
            inventoryProductIds.push(product.id);
          }
        }
      }

      if (inventoryProductIds.length === 0) {
        return {
          products: [],
          total: 0,
          page: safePage,
          pageSize: safePageSize,
        };
      }
    }

    let query = supabase
      .from("products")
      .select(
        "*, product_variants(*), collection_products(collection_id)",
        { count: "exact" }
      )
      .order("updated_at", { ascending: false })
      .range(from, to);

    const term = String(search || "").trim();
    if (term) {
      const pattern = `%${term}%`;
      query = query.or(
        `name.ilike.${pattern},slug.ilike.${pattern},category.ilike.${pattern},vendor.ilike.${pattern}`
      );
    }

    if (status !== "all") query = query.eq("status", status);
    if (category) query = query.eq("category", category);
    if (vendor) query = query.eq("vendor", vendor);

    const parsedMinPrice = Number(minPrice);
    if (String(minPrice).trim() !== "" && Number.isFinite(parsedMinPrice)) {
      query = query.gte("price", parsedMinPrice);
    }

    const parsedMaxPrice = Number(maxPrice);
    if (String(maxPrice).trim() !== "" && Number.isFinite(parsedMaxPrice)) {
      query = query.lte("price", parsedMaxPrice);
    }

    const parsedDays = Number(updatedWithinDays);
    if (updatedWithinDays !== "all" && Number.isFinite(parsedDays) && parsedDays > 0) {
      const cutoff = new Date(Date.now() - parsedDays * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("updated_at", cutoff);
    }

    if (inventory === "not_tracked") {
      query = query.eq("track_inventory", false);
    } else if (inventoryProductIds) {
      query = query.eq("track_inventory", true).in("id", inventoryProductIds);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      products: (data || []).map(mapProduct),
      total: count || 0,
      page: safePage,
      pageSize: safePageSize,
    };
  },

  async filterOptions() {
    const { data, error } = await supabase
      .from("products")
      .select("category, vendor");

    if (error) throw error;

    const categories = Array.from(
      new Set((data || []).map((row) => String(row.category || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const vendors = Array.from(
      new Set((data || []).map((row) => String(row.vendor || "GDP Clothing").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    return { categories, vendors };
  },

  async summary(lowStockThreshold = 5) {
    const [
      allResult,
      activeResult,
      draftResult,
      archivedResult,
      variantsResult,
    ] = await Promise.all([
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "archived"),
      supabase.from("product_variants").select("id, stock, active").eq("active", true),
    ]);

    for (const result of [allResult, activeResult, draftResult, archivedResult, variantsResult]) {
      if (result.error) throw result.error;
    }

    return {
      all: allResult.count || 0,
      active: activeResult.count || 0,
      draft: draftResult.count || 0,
      archived: archivedResult.count || 0,
      lowStock: (variantsResult.data || []).filter(
        (variant) => Number(variant.stock || 0) <= Number(lowStockThreshold || 0)
      ).length,
    };
  },

  async collections() {
    const { data, error } = await supabase
      .from("collections")
      .select("id, name, slug, status")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async settings() {
    const { data, error } = await supabase
      .from("store_settings")
      .select("low_stock_threshold, currency")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    return data || { low_stock_threshold: 5, currency: "CAD" };
  },

  async uploadMedia(file) {
    if (!file) throw new Error("Choose an image to upload.");
    if (!String(file.type || "").startsWith("image/")) {
      throw new Error("Product media currently supports image files.");
    }

    const safeName = String(file.name || "product-image")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const unique = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const path = `products/${Date.now()}-${unique}-${safeName || "image"}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: false, cacheControl: "3600" });

    if (error) throw error;

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Could not create a public product image URL.");
    return data.publicUrl;
  },

  async get(productId) {
    const { data, error } = await supabase
      .from("products")
      .select("*, product_variants(*), collection_products(collection_id)")
      .eq("id", productId)
      .single();

    if (error) throw error;
    return mapProduct(data);
  },

  async save(productId, payload) {
    const savedId = await adminApi.saveProduct(productId || null, payload);
    const { data, error } = await supabase
      .from("products")
      .select("*, product_variants(*), collection_products(collection_id)")
      .eq("id", savedId)
      .single();

    if (error) throw error;
    return mapProduct(data);
  },

  async setStatus(productId, status) {
    const { data, error } = await supabase
      .from("products")
      .update({ status })
      .eq("id", productId)
      .select("id, status, updated_at")
      .single();

    if (error) throw error;
    return data;
  },
};
