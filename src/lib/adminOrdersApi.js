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

const ATTENTION_STATUSES = [
  "payment_failed",
  "artwork_needed",
  "awaiting_approval",
  "revision_requested",
];

const ORDER_SELECT =
  "id, order_number, customer_name, customer_email, customer_phone, is_guest, subtotal, discount, shipping, tax, total, status, design_status, production_status, fulfillment_status, payment_status, tracking_number, carrier, shipping_method, need_by_date, priority, notes, created_at, updated_at, order_items(id, name, image, variant, size, color, quantity, unit_price, fulfillment_mode, is_custom, custom_design_id)";

const cleanIds = (orderIds) =>
  [...new Set((orderIds || []).filter(Boolean).map(String))];

export const adminOrdersApi = {
  async list({
    page = 1,
    pageSize = 25,
    search = "",
    status = "all",
    paymentStatus = "all",
    fulfillmentStatus = "all",
    designStatus = "all",
    productionStatus = "all",
    customerType = "all",
    dateFrom = "",
    dateTo = "",
    attentionOnly = false,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(10, Number(pageSize) || 25));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    let query = supabase
      .from("orders")
      .select(ORDER_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const term = String(search || "").trim();
    if (term) {
      const pattern = `%${term}%`;
      query = query.or(
        `order_number.ilike.${pattern},customer_name.ilike.${pattern},customer_email.ilike.${pattern},tracking_number.ilike.${pattern}`
      );
    }

    if (status === "custom") {
      query = query.in("design_status", [
        "artwork_needed",
        "design_in_progress",
        "proof_ready",
        "awaiting_approval",
        "revision_requested",
        "approved",
      ]);
    } else if (status === "production") {
      query = query.in("production_status", [
        "queued",
        "printing",
        "quality_control",
        "packing",
        "ready",
      ]);
    } else if (status !== "all") {
      const group = ORDER_STATUS_GROUPS[status];
      if (group) query = query.in("status", group);
      else query = query.eq("status", status);
    }

    if (paymentStatus !== "all") query = query.eq("payment_status", paymentStatus);
    if (fulfillmentStatus !== "all") query = query.eq("fulfillment_status", fulfillmentStatus);
    if (designStatus !== "all") query = query.eq("design_status", designStatus);
    if (productionStatus !== "all") query = query.eq("production_status", productionStatus);
    if (customerType === "guest") query = query.eq("is_guest", true);
    if (customerType === "account") query = query.eq("is_guest", false);

    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999`);

    if (attentionOnly) {
      query = query.or(
        `status.in.(${ATTENTION_STATUSES.join(",")}),priority.eq.due_soon`
      );
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

    const [all, open, custom, production, completed, attention] = await Promise.all([
      count(),
      count((q) => q.in("status", ORDER_STATUS_GROUPS.open)),
      count((q) =>
        q.in("design_status", [
          "artwork_needed",
          "design_in_progress",
          "proof_ready",
          "awaiting_approval",
          "revision_requested",
          "approved",
        ])
      ),
      count((q) =>
        q.in("production_status", [
          "queued",
          "printing",
          "quality_control",
          "packing",
          "ready",
        ])
      ),
      count((q) => q.in("status", ORDER_STATUS_GROUPS.completed)),
      count((q) =>
        q.or(`status.in.(${ATTENTION_STATUSES.join(",")}),priority.eq.due_soon`)
      ),
    ]);

    return { all, open, custom, production, completed, attention };
  },

  async updateStatus(orderId, status) {
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId)
      .select("id, status, updated_at")
      .single();

    if (error) throw error;
    return data;
  },

  async updateFulfillment(orderId, fulfillmentStatus) {
    const { data, error } = await supabase
      .from("orders")
      .update({ fulfillment_status: fulfillmentStatus })
      .eq("id", orderId)
      .select("id, fulfillment_status, updated_at")
      .single();

    if (error) throw error;
    return data;
  },

  async updateDesignStatus(orderId, designStatus) {
    const { data, error } = await supabase
      .from("orders")
      .update({ design_status: designStatus })
      .eq("id", orderId)
      .select("id, design_status, updated_at")
      .single();

    if (error) throw error;
    return data;
  },

  async updateProductionStatus(orderId, productionStatus) {
    const { data, error } = await supabase
      .from("orders")
      .update({ production_status: productionStatus })
      .eq("id", orderId)
      .select("id, production_status, updated_at")
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

  async updateNotes(orderId, notes) {
    const { data, error } = await supabase
      .from("orders")
      .update({ notes: notes || null })
      .eq("id", orderId)
      .select("id, notes, updated_at")
      .single();

    if (error) throw error;
    return data;
  },

  async bulkUpdateStatus(orderIds, status) {
    const ids = cleanIds(orderIds);
    if (!ids.length) return [];

    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .in("id", ids)
      .select("id, status, updated_at");

    if (error) throw error;
    return data || [];
  },

  async bulkUpdateFulfillment(orderIds, fulfillmentStatus) {
    const ids = cleanIds(orderIds);
    if (!ids.length) return [];

    const { data, error } = await supabase
      .from("orders")
      .update({ fulfillment_status: fulfillmentStatus })
      .in("id", ids)
      .select("id, fulfillment_status, updated_at");

    if (error) throw error;
    return data || [];
  },

  async activity(orderId) {
    const { data, error } = await supabase
      .from("order_activity_events")
      .select(
        "id, order_id, actor_user_id, activity_type, field_name, from_value, to_value, note, metadata, created_at"
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  },
};
