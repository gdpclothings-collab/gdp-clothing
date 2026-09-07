import { supabase } from "@/lib/supabaseClient";
import { normalizeProduct } from "@/lib/supabaseMappers";

export const storefrontDiscoveryApi = {
  async getCollections() {
    const { data, error } = await supabase
      .from("collections")
      .select("id,name,slug,description,image,tagline,seasonal,sort_order,status,collection_products(product_id,position)")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const collections = data || [];
    const productIds = [...new Set(collections.flatMap((collection) =>
      (collection.collection_products || []).map((item) => item.product_id)
    ))];

    let productsById = {};
    if (productIds.length) {
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds)
        .eq("status", "active");

      if (productError) throw productError;
      productsById = Object.fromEntries((products || []).map((product) => {
        const normalized = normalizeProduct(product);
        return [normalized.id, normalized];
      }));
    }

    return collections.map((collection) => ({
      ...collection,
      products: (collection.collection_products || [])
        .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
        .map((item) => productsById[item.product_id])
        .filter(Boolean)
        .filter((product) =>
          !(product.tags || []).some((tag) => String(tag).toLowerCase() === "custom-studio-only")
        ),
    }));
  },

  async getApprovedReviews(limit = 6) {
    const { data, error } = await supabase
      .from("reviews")
      .select("id,product_id,product_name,customer_name,rating,title,body,images,verified,created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(12, Number(limit || 6))));

    if (error) throw error;
    return data || [];
  },
};
