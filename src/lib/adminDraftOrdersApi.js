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
    const gstHstTax = roundMoney(Math.max(0, Number(payload.gstHstTax || 0)));
    const pstTax = roundMoney(Math.max(0, Number(payload.pstTax || 0)));
    if (Math.abs(gstHstTax + pstTax - tax) > 0.009) {
      throw new Error("GST/HST and PST must add up to the combined tax before saving.");
    }
    const total = roundMoney(Math.max(0, subtotal - discount + shipping + tax));

    const { data, error } = await supabase.rpc("save_admin_draft_atomic", {
      p_id: id || null,
      p_order: {
        customer_email: payload.customerEmail,
        customer_name: payload.customerName || null,
        customer_phone: payload.customerPhone || null,
        subtotal, discount, shipping, tax, gst_hst_tax: gstHstTax, pst_tax: pstTax, total,
        shipping_address: payload.shippingAddress || {},
        billing_address: payload.billingAddress || payload.shippingAddress || {},
        shipping_method: payload.shippingMethod || null,
        notes: payload.notes || null,
        invoice_due_date: payload.invoiceDueDate || null,
        invoice_payment_terms: payload.invoicePaymentTerms || null,
        need_by_date: payload.needByDate || null,
        priority: payload.priority || "standard",
      },
      p_items: items.map(item => ({
        product_id: item.productId || null,
        variant_id: item.variantId || null,
        name: item.name, image: item.image || null,
        variant: item.variant || null, size: item.size || null, color: item.color || null,
        quantity: Number(item.quantity), unit_price: roundMoney(item.unitPrice),
        fulfillment_mode: item.fulfillmentMode || "in_house",
      })),
    });
    if (error) throw error;
    return data;
  },

  async convertToPendingPayment(id) {
    const { data, error } = await supabase.rpc("activate_admin_draft_atomic", { p_id: id });
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
