import { supabase } from "@/lib/supabaseClient";

const throwIfError = ({ data, error, count }) => {
  if (error) throw error;
  return { data, count };
};

const ORDER_STATUS_GROUPS = {
  open: [
    "draft",
    "pending_payment",
    "paid",
    "payment_failed",
    "artwork_needed",
    "design_in_progress",
    "proof_ready",
    "awaiting_approval",
    "revision_requested",
    "approved",
    "production_queue",
    "printing",
    "quality_control",
    "packing",
    "ready_for_pickup",
    "shipped",
    "out_for_delivery",
  ],
  completed: ["delivered", "completed"],
  cancelled: ["cancelled"],
  refunded: ["refunded", "partially_refunded"],
};

export const adminOrdersApi = {
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
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_email, customer_phone, subtotal, discount, shipping, tax, total, status, fulfillment_status, payment_status, tracking_number, carrier, shipping_method, need_by_date, priority, created_at, updated_at, order_items(id, name, image, variant, size, color, quantity, unit_price, fulfillment_mode, is_custom, custom_design_id)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    const term = String(search || "").trim();
    if (term) {
      const pattern = `%${term}%`;
      query = query.or(
        `order_number.ilike.${pattern},customer_name.ilike.${pattern},customer_email.ilike.${pattern},tracking_number.ilike.${pattern}`
      );
    }

    if (status !== "all") {
      const group = ORDER_STATUS_GROUPS[status];
      if (group) query = query.in("status", group);
      else query = query.eq("status", status);
    }

    const result = throwIfError(await query);

    return {
      orders: result.data || [],
      total: result.count || 0,
      page: safePage,
      pageSize: safePageSize,
    };
  },

  async summary() {
    const count = async (configure) => {
      let query = supabase.from("orders").select("*", { count: "exact", head: true });
      if (configure) query = configure(query);
      const { count: result, error } = await query;
      if (error) throw error;
      return result || 0;
    };

    const [all, open, custom, production, completed] = await Promise.all([
      count(),
      count((q) => q.in("status", ORDER_STATUS_GROUPS.open)),
      count((q) =>
        q.in("status", [
          "artwork_needed",
          "design_in_progress",
          "proof_ready",
          "awaiting_approval",
          "revision_requested",
          "approved",
        ])
      ),
      count((q) =>
        q.in("status", [
          "production_queue",
          "printing",
          "quality_control",
          "packing",
          "ready_for_pickup",
        ])
      ),
      count((q) => q.in("status", ORDER_STATUS_GROUPS.completed)),
    ]);

    return { all, open, custom, production, completed };
  },

  async updateStatus(orderId, status) {
    const { data, error } = await supabase
      .from("orders")
      .update({ status, fulfillment_status: status })
      .eq("id", orderId)
      .select("id, status, fulfillment_status, updated_at")
      .single();

    if (error) throw error;
    return data;
  },

  async updateTracking(orderId, { trackingNumber, carrier }) {
    const { data, error } = await supabase
      .from("orders")
      .update({
        tracking_number: trackingNumber || null,
        carrier: carrier || null,
      })
      .eq("id", orderId)
      .select("id, tracking_number, carrier, updated_at")
      .single();

    if (error) throw error;
    return data;
  },
};
