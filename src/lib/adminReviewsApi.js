import { supabase } from "@/lib/supabaseClient";
import { adminApi } from "@/lib/adminApi";

export const adminReviewsApi = {
  async list({ status = "all", search = "" } = {}) {
    let query = supabase
      .from("reviews")
      .select("id, product_id, product_name, customer_name, customer_email, rating, title, body, images, verified, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (status !== "all") query = query.eq("status", status);

    const term = String(search || "").trim();
    if (term) {
      const pattern = `%${term}%`;
      query = query.or(
        `product_name.ilike.${pattern},customer_name.ilike.${pattern},customer_email.ilike.${pattern},title.ilike.${pattern},body.ilike.${pattern}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async setStatus(id, status) {
    await adminApi.updateReview(id, status);
  },

  async setVerified(id, verified) {
    const { error } = await supabase
      .from("reviews")
      .update({ verified: Boolean(verified) })
      .eq("id", id);

    if (error) throw error;
  },
};
