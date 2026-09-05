import { supabase } from "@/lib/supabaseClient";

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const adminDraftOrdersApi = {
  async list() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "*, order_items(id, product_id, variant_id, name, image, variant, size, color, quantity, unit_price, fulfillment_mode, is_custom)"
      )
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(250);

    if (error) throw error;
    return data || [];
  },

  async catalog() {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, price, images, fulfillment_mode, status, product_variants(id, name, sku, stock, price, color, size, active)"
      )
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(500);

    if (error) throw error;
    return data || [];
  },

  async saveDraft(id, payload) {
    const items = (payload.items || []).filter(
      (item) => Number(item.quantity || 0) > 0
    );

    if (!payload.customerEmail) {
      throw new Error("Customer email is required for a draft order.");
    }
    if (!items.length) {
      throw new Error("Add at least one item to the draft order.");
    }

    const subtotal = roundMoney(
      items.reduce(
        (sum, item) =>
          sum + Number(item.unitPrice || 0) * Number(item.quantity || 0),
        0
      )
    );
    const discount = roundMoney(
      Math.min(subtotal, Math.max(0, Number(payload.discount || 0)))
    );
    const shipping = roundMoney(Math.max(0, Number(payload.shipping || 0)));
    const tax = roundMoney(Math.max(0, Number(payload.tax || 0)));
    const total = roundMoney(Math.max(0, subtotal - discount + shipping + tax));

    let orderId = id;

    if (id) {
      const { error } = await supabase
        .from("orders")
        .update({
          customer_email: payload.customerEmail,
          customer_name: payload.customerName || null,
          customer_phone: payload.customerPhone || null,
          subtotal,
          discount,
          shipping,
          tax,
          total,
          shipping_address: payload.shippingAddress || {},
          billing_address: payload.billingAddress || payload.shippingAddress || {},
          shipping_method: payload.shippingMethod || null,
          notes: payload.notes || null,
          need_by_date: payload.needByDate || null,
          priority: payload.priority || "standard",
          status: "draft",
          fulfillment_status: "draft",
          payment_status: "pending",
        })
        .eq("id", id)
        .eq("status", "draft");

      if (error) throw error;

      const { error: clearError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", id);
      if (clearError) throw clearError;
    } else {
      const { data: settings, error: settingsError } = await supabase
        .from("store_settings")
        .select("order_prefix")
        .eq("id", 1)
        .maybeSingle();

      if (settingsError) throw settingsError;

      const prefix = String(settings?.order_prefix || "GDP")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase() || "GDP";
      const orderNumber =
        `${prefix}-DRAFT-${Date.now().toString().slice(-8)}-${crypto.randomUUID()
          .slice(0, 4)
          .toUpperCase()}`;

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_email: payload.customerEmail,
          customer_name: payload.customerName || null,
          customer_phone: payload.customerPhone || null,
          subtotal,
          discount,
          shipping,
          tax,
          total,
          status: "draft",
          fulfillment_status: "draft",
          payment_status: "pending",
          shipping_address: payload.shippingAddress || {},
          billing_address: payload.billingAddress || payload.shippingAddress || {},
          shipping_method: payload.shippingMethod || null,
          notes: payload.notes || null,
          is_guest: true,
          need_by_date: payload.needByDate || null,
          priority: payload.priority || "standard",
        })
        .select("id")
        .single();

      if (error) throw error;
      orderId = order.id;
    }

    const { error: itemError } = await supabase
      .from("order_items")
      .insert(
        items.map((item) => ({
          order_id: orderId,
          product_id: item.productId || null,
          variant_id: item.variantId || null,
          name: item.name,
          image: item.image || null,
          variant: item.variant || null,
          size: item.size || null,
          color: item.color || null,
          quantity: Number(item.quantity),
          unit_price: roundMoney(item.unitPrice),
          fulfillment_mode: item.fulfillmentMode || "in_house",
          is_custom: false,
        }))
      );

    if (itemError) throw itemError;
    return orderId;
  },

  async convertToPendingPayment(id) {
    const { data, error } = await supabase
      .from("orders")
      .update({
        status: "pending_payment",
        fulfillment_status: "pending_payment",
        payment_status: "pending",
      })
      .eq("id", id)
      .eq("status", "draft")
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async deleteDraft(id) {
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", id)
      .eq("status", "draft");

    if (error) throw error;
  },
};
