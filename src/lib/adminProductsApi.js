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
    podSku: variant.pod_sku || "",
    stock: Number(variant.stock || 0),
    price: variant.price === null ? null : Number(variant.price),
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
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(10, Number(pageSize) || 25));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

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

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      products: (data || []).map(mapProduct),
      total: count || 0,
      page: safePage,
      pageSize: safePageSize,
    };
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

  async save(productId, payload) {
    return adminApi.saveProduct(productId || null, payload);
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
