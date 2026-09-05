import { supabase } from "@/lib/supabaseClient";

export const adminFinanceApi = {
  async load(limit = 250) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_email, subtotal, discount, shipping, tax, total, payment_status, status, stripe_payment_intent_id, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(Math.max(25, Math.min(1000, Number(limit) || 250)));

    if (error) throw error;
    const orders = data || [];

    const paid = orders.filter((order) => order.payment_status === "paid");
    const refunded = orders.filter((order) =>
      ["refunded", "partially_refunded"].includes(order.payment_status) ||
      ["refunded", "partially_refunded"].includes(order.status)
    );

    return {
      metrics: {
        grossSales: paid.reduce((sum, order) => sum + Number(order.subtotal || 0), 0),
        discounts: paid.reduce((sum, order) => sum + Number(order.discount || 0), 0),
        shippingCollected: paid.reduce((sum, order) => sum + Number(order.shipping || 0), 0),
        taxCollected: paid.reduce((sum, order) => sum + Number(order.tax || 0), 0),
        paidRevenue: paid.reduce((sum, order) => sum + Number(order.total || 0), 0),
        paidOrders: paid.length,
        refundOrders: refunded.length,
      },
      transactions: orders,
    };
  },
};
