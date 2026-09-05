import { supabase } from "@/lib/supabaseClient";

export const adminInventoryApi = {
  async list({
    page = 1,
    pageSize = 50,
    search = "",
    stock = "all",
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(10, Number(pageSize) || 50));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    const settingsResult = await supabase
      .from("store_settings")
      .select("low_stock_threshold")
      .eq("id", 1)
      .maybeSingle();

    if (settingsResult.error) throw settingsResult.error;
    const threshold = Number(settingsResult.data?.low_stock_threshold ?? 5);

    let query = supabase
      .from("product_variants")
      .select(
        "id, product_id, name, sku, pod_sku, stock, price, color, size, active, updated_at, products!inner(id, name, images, status, track_inventory, vendor, category)",
        { count: "exact" }
      )
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .range(from, to);

    const term = String(search || "").trim();
    if (term) {
      const pattern = `%${term}%`;
      query = query.or(
        `sku.ilike.${pattern},pod_sku.ilike.${pattern},name.ilike.${pattern},color.ilike.${pattern},size.ilike.${pattern}`
      );
    }

    if (stock === "out") query = query.eq("stock", 0);
    if (stock === "low") query = query.gt("stock", 0).lte("stock", threshold);
    if (stock === "healthy") query = query.gt("stock", threshold);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      rows: data || [],
      total: count || 0,
      threshold,
      page: safePage,
      pageSize: safePageSize,
    };
  },

  async summary() {
    const settingsResult = await supabase
      .from("store_settings")
      .select("low_stock_threshold")
      .eq("id", 1)
      .maybeSingle();

    if (settingsResult.error) throw settingsResult.error;
    const threshold = Number(settingsResult.data?.low_stock_threshold ?? 5);

    const [variantsResult, productsWithoutVariantsResult] = await Promise.all([
      supabase
        .from("product_variants")
        .select("id, product_id, stock, active")
        .eq("active", true),
      supabase
        .from("products")
        .select("id, name, product_variants(id)")
        .neq("status", "archived"),
    ]);

    if (variantsResult.error) throw variantsResult.error;
    if (productsWithoutVariantsResult.error) throw productsWithoutVariantsResult.error;

    const variants = variantsResult.data || [];
    const totalUnits = variants.reduce((sum, row) => sum + Number(row.stock || 0), 0);
    const lowStock = variants.filter((row) => Number(row.stock || 0) > 0 && Number(row.stock || 0) <= threshold).length;
    const outOfStock = variants.filter((row) => Number(row.stock || 0) === 0).length;
    const missingVariants = (productsWithoutVariantsResult.data || []).filter(
      (product) => !(product.product_variants || []).length
    ).length;

    return {
      totalUnits,
      variants: variants.length,
      lowStock,
      outOfStock,
      missingVariants,
      threshold,
    };
  },

  async setStock(variantId, stock) {
    const nextStock = Math.max(0, Number(stock || 0));
    const { data, error } = await supabase
      .from("product_variants")
      .update({ stock: nextStock })
      .eq("id", variantId)
      .select("id, stock, updated_at")
      .single();

    if (error) throw error;
    return data;
  },
};
