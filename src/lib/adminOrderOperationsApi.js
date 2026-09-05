import { supabase } from "@/lib/supabaseClient";

const staleCutoffIso = () => new Date(Date.now() - 30 * 60 * 1000).toISOString();

export const adminOrderOperationsApi = {
  async listCheckoutSessions({ status = "all", search = "" } = {}) {
    const now = new Date().toISOString();

    // Keep lifecycle state useful without requiring a background worker.
    await supabase
      .from("checkout_sessions")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("expires_at", now);

    await supabase
      .from("checkout_sessions")
      .update({ status: "abandoned" })
      .eq("status", "active")
      .lt("last_activity_at", staleCutoffIso());

    let query = supabase
      .from("checkout_sessions")
      .select("*")
      .order("last_activity_at", { ascending: false })
      .limit(500);

    if (status !== "all") query = query.eq("status", status);

    const term = String(search || "").trim();
    if (term) {
      const pattern = `%${term}%`;
      query = query.or(
        `customer_email.ilike.${pattern},customer_name.ilike.${pattern}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async setCheckoutStatus(id, status) {
    const { error } = await supabase
      .from("checkout_sessions")
      .update({ status })
      .eq("id", id);

    if (error) throw error;
  },

  async listReturns() {
    const { data, error } = await supabase
      .from("returns")
      .select(
        "*, orders(id, order_number, customer_name, customer_email, total, payment_status, status, created_at), return_items(id, quantity, reason, item_condition, restock, order_items(id, name, image, size, color, variant, quantity, unit_price))"
      )
      .order("requested_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return data || [];
  },

  async eligibleOrders(search = "") {
    let query = supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_email, total, status, payment_status, created_at, order_items(id, name, image, size, color, variant, quantity, unit_price)")
      .in("status", ["shipped", "out_for_delivery", "delivered", "completed"])
      .order("created_at", { ascending: false })
      .limit(100);

    const term = String(search || "").trim();
    if (term) {
      const pattern = `%${term}%`;
      query = query.or(
        `order_number.ilike.${pattern},customer_name.ilike.${pattern},customer_email.ilike.${pattern}`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createReturn({ orderId, reason, resolution, notes, items }) {
    const returnNumber = `RTN-${Date.now().toString().slice(-8)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const { data: created, error } = await supabase
      .from("returns")
      .insert({
        return_number: returnNumber,
        order_id: orderId,
        reason: reason || null,
        resolution: resolution || "refund",
        customer_notes: notes || null,
        status: "requested",
      })
      .select("*")
      .single();

    if (error) throw error;

    const selectedItems = (items || []).filter(
      (item) => Number(item.quantity || 0) > 0
    );

    if (selectedItems.length) {
      const { error: itemError } = await supabase
        .from("return_items")
        .insert(
          selectedItems.map((item) => ({
            return_id: created.id,
            order_item_id: item.orderItemId,
            quantity: Number(item.quantity),
            reason: item.reason || reason || null,
            item_condition: item.itemCondition || null,
            restock: item.restock !== false,
          }))
        );

      if (itemError) {
        await supabase.from("returns").delete().eq("id", created.id);
        throw itemError;
      }
    }

    return created;
  },

  async updateReturn(id, patch) {
    const payload = {};
    if ("status" in patch) payload.status = patch.status;
    if ("resolution" in patch) payload.resolution = patch.resolution;
    if ("adminNotes" in patch) payload.admin_notes = patch.adminNotes || null;
    if ("refundAmount" in patch) payload.refund_amount = Number(patch.refundAmount || 0);
    if ("restock" in patch) payload.restock = Boolean(patch.restock);

    if (patch.status === "approved") payload.approved_at = new Date().toISOString();
    if (patch.status === "received") payload.received_at = new Date().toISOString();
    if (patch.status === "completed") payload.completed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("returns")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async createRefundRecord({ orderId, returnId, amount, reason }) {
    const { data, error } = await supabase
      .from("refunds")
      .insert({
        order_id: orderId,
        return_id: returnId || null,
        amount: Number(amount || 0),
        reason: reason || null,
        status: "pending",
        provider: "stripe",
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async listRefunds() {
    const { data, error } = await supabase
      .from("refunds")
      .select("*, orders(order_number, customer_name, customer_email)")
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) throw error;
    return data || [];
  },
};
