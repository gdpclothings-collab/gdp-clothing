import { supabase } from "@/lib/supabaseClient";

const unwrap = ({ data, error, count }) => {
  if (error) throw error;
  return { data, count };
};

async function countRows(table, configure) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (configure) query = configure(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export const adminDashboardApi = {
  async loadHome() {
    const [
      recentOrdersResult,
      activeProducts,
      totalProducts,
      pendingOrders,
      productionOrders,
      pendingProofs,
      openTickets,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_email, total, status, payment_status, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      countRows("products", (q) => q.eq("status", "active")),
      countRows("products"),
      countRows("orders", (q) => q.in("status", ["draft", "pending_payment", "payment_failed"])),
      countRows("orders", (q) =>
        q.in("status", ["production_queue", "printing", "quality_control", "packing", "ready_for_pickup"])
      ),
      countRows("design_proofs", (q) =>
        q.in("status", ["pending", "in_progress", "ready", "sent", "awaiting_approval", "revision_requested", "revised"])
      ),
      countRows("support_tickets", (q) => q.in("status", ["open", "in_progress"])),
      // The store_settings table is intentionally SELECT-revoked for browser
      // roles. Read through the existing step-up-authorized admin RPC instead.
      supabase.rpc("get_admin_store_settings"),
    ]);

    const recentOrders = unwrap(recentOrdersResult).data || [];
    const authorizedSettings = unwrap(settingsResult).data;
    if (!authorizedSettings || typeof authorizedSettings !== "object" || Array.isArray(authorizedSettings)) {
      throw new Error("Admin store settings response is unavailable or invalid.");
    }
    // The protected RPC returns the admin settings record. Retain only the
    // dashboard fields rather than propagating private configuration values.
    const settings = {
      store_name: authorizedSettings.store_name,
      currency: authorizedSettings.currency,
      timezone: authorizedSettings.timezone,
      low_stock_threshold: authorizedSettings.low_stock_threshold,
    };

    const paidRevenue = recentOrders
      .filter((order) => order.payment_status === "paid")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    return {
      recentOrders,
      metrics: {
        activeProducts,
        totalProducts,
        pendingOrders,
        productionOrders,
        pendingProofs,
        openTickets,
        recentPaidRevenue: paidRevenue,
      },
      settings,
    };
  },

  async globalSearch(term) {
    const query = String(term || "").trim();
    if (!query) return { orders: [], products: [] };

    const pattern = `%${query}%`;

    const [ordersResult, productsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_email, status, total, created_at")
        .or(`order_number.ilike.${pattern},customer_name.ilike.${pattern},customer_email.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("products")
        .select("id, name, slug, category, status, price")
        .or(`name.ilike.${pattern},slug.ilike.${pattern},category.ilike.${pattern}`)
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);

    return {
      orders: unwrap(ordersResult).data || [],
      products: unwrap(productsResult).data || [],
    };
  },
};
