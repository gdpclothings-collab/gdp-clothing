import { supabase } from "@/lib/supabaseClient";
import { adminApi } from "@/lib/adminApi";

const mapDiscount = (row) => ({
  id: row.id,
  code: row.code,
  type: row.type,
  value: Number(row.value || 0),
  appliesTo: row.applies_to || "all",
  appliesToId: row.applies_to_id || "",
  minPurchase: row.min_purchase,
  active: row.active !== false,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  usageCount: Number(row.usage_count || 0),
  usageLimit: row.usage_limit,
  qtyTier2: Number(row.qty_tier_2 || 0),
  qtyTier3: Number(row.qty_tier_3 || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const adminDiscountsApi = {
  async list() {
    const { data, error } = await supabase
      .from("discounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDiscount);
  },

  async references() {
    const [productsResult, collectionsResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, status")
        .neq("status", "archived")
        .order("name", { ascending: true })
        .limit(500),
      supabase
        .from("collections")
        .select("id, name, status")
        .neq("status", "archived")
        .order("name", { ascending: true })
        .limit(250),
    ]);

    if (productsResult.error) throw productsResult.error;
    if (collectionsResult.error) throw collectionsResult.error;

    return {
      products: productsResult.data || [],
      collections: collectionsResult.data || [],
    };
  },

  async save(id, data) {
    await adminApi.saveDiscount(id || null, data);
  },

  async setActive(id, active) {
    const { error } = await supabase
      .from("discounts")
      .update({ active: Boolean(active) })
      .eq("id", id);

    if (error) throw error;
  },
};
