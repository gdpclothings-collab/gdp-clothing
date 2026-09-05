import { supabase } from "@/lib/supabaseClient";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export const adminAnalyticsApi = {
  async load(days = 30) {
    const safeDays = Math.max(7, Math.min(365, Number(days) || 30));
    const since = new Date(Date.now() - (safeDays - 1) * DAY_MS);
    since.setHours(0, 0, 0, 0);

    const [ordersResult, productsResult] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, customer_email, total, discount, shipping, tax, payment_status, status, created_at, order_items(name, quantity, unit_price, is_custom)"
        )
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true })
        .limit(2000),
      supabase
        .from("products")
        .select("id, name, status, custom_designable", { count: "exact" })
        .neq("status", "archived"),
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (productsResult.error) throw productsResult.error;

    const orders = ordersResult.data || [];
    const paidOrders = orders.filter((order) => order.payment_status === "paid");
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const customers = new Set(orders.map((order) => String(order.customer_email || "").toLowerCase()).filter(Boolean));
    const customOrders = orders.filter((order) =>
      (order.order_items || []).some((item) => item.is_custom)
    );

    const seriesMap = new Map();
    for (let i = 0; i < safeDays; i += 1) {
      const date = new Date(since.getTime() + i * DAY_MS);
      seriesMap.set(dayKey(date), { date: dayKey(date), revenue: 0, orders: 0, paidOrders: 0 });
    }

    for (const order of orders) {
      const key = dayKey(order.created_at);
      if (!seriesMap.has(key)) continue;
      const row = seriesMap.get(key);
      row.orders += 1;
      if (order.payment_status === "paid") {
        row.paidOrders += 1;
        row.revenue += Number(order.total || 0);
      }
    }

    const productMap = new Map();
    for (const order of paidOrders) {
      for (const item of order.order_items || []) {
        const key = item.name || "Unknown product";
        if (!productMap.has(key)) {
          productMap.set(key, { name: key, units: 0, revenue: 0, customUnits: 0 });
        }
        const row = productMap.get(key);
        const quantity = Number(item.quantity || 0);
        row.units += quantity;
        row.revenue += quantity * Number(item.unit_price || 0);
        if (item.is_custom) row.customUnits += quantity;
      }
    }

    const statusMap = new Map();
    for (const order of orders) {
      statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
    }

    return {
      days: safeDays,
      metrics: {
        revenue,
        orders: orders.length,
        paidOrders: paidOrders.length,
        averageOrderValue: paidOrders.length ? revenue / paidOrders.length : 0,
        customers: customers.size,
        customOrders: customOrders.length,
        customOrderShare: orders.length ? (customOrders.length / orders.length) * 100 : 0,
        activeProducts: (productsResult.data || []).filter((product) => product.status === "active").length,
      },
      series: [...seriesMap.values()],
      topProducts: [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      statuses: [...statusMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
};
