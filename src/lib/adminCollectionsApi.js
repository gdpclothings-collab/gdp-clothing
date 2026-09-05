import { supabase } from "@/lib/supabaseClient";
import { adminApi } from "@/lib/adminApi";

const mapCollection = (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description || "",
  image: row.image || "",
  tagline: row.tagline || "",
  seasonal: Boolean(row.seasonal),
  sortOrder: row.sort_order || "manual",
  status: row.status || "active",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  products: (row.collection_products || [])
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((link) => link.products)
    .filter(Boolean),
});

export const adminCollectionsApi = {
  async list() {
    const { data, error } = await supabase
      .from("collections")
      .select("*, collection_products(position, products(id, name, slug, status, price, images))")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapCollection);
  },

  async products() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, status, price, images")
      .neq("status", "archived")
      .order("name", { ascending: true })
      .limit(500);

    if (error) throw error;
    return data || [];
  },

  async save(id, data) {
    await adminApi.saveCollection(id || null, data);

    const { data: saved, error: savedError } = await supabase
      .from("collections")
      .select("id")
      .eq("slug", data.slug)
      .single();

    if (savedError) throw savedError;

    const collectionId = id || saved.id;

    const clear = await supabase
      .from("collection_products")
      .delete()
      .eq("collection_id", collectionId);

    if (clear.error) throw clear.error;

    if ((data.productIds || []).length) {
      const insert = await supabase
        .from("collection_products")
        .insert(
          data.productIds.map((productId, position) => ({
            collection_id: collectionId,
            product_id: productId,
            position,
          }))
        );

      if (insert.error) throw insert.error;
    }

    return collectionId;
  },

  async setStatus(id, status) {
    const { error } = await supabase
      .from("collections")
      .update({ status })
      .eq("id", id);

    if (error) throw error;
  },
};
