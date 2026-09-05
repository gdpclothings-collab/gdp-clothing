import { supabase } from "@/lib/supabaseClient";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const adminCustomersApi = {
  async list({ search = "", page = 1, pageSize = 25 } = {}) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, user_id, customer_email, customer_name, customer_phone, total, payment_status, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const customers = new Map();

    for (const order of orders || []) {
      const email = normalizeEmail(order.customer_email);
      if (!email) continue;

      if (!customers.has(email)) {
        customers.set(email, {
          id: email,
          email,
          name: order.customer_name || "Customer",
          phone: order.customer_phone || "",
          userId: order.user_id || null,
          orders: 0,
          paidOrders: 0,
          totalSpent: 0,
          lastOrderAt: order.created_at,
          firstOrderAt: order.created_at,
          orderRows: [],
        });
      }

      const customer = customers.get(email);
      customer.orders += 1;
      customer.orderRows.push(order);

      if (order.payment_status === "paid") {
        customer.paidOrders += 1;
        customer.totalSpent += Number(order.total || 0);
      }

      if (order.customer_name) customer.name = order.customer_name;
      if (order.customer_phone) customer.phone = order.customer_phone;
      if (order.user_id) customer.userId = order.user_id;

      if (order.created_at > customer.lastOrderAt) customer.lastOrderAt = order.created_at;
      if (order.created_at < customer.firstOrderAt) customer.firstOrderAt = order.created_at;
    }

    const term = String(search || "").trim().toLowerCase();
    let rows = [...customers.values()].map((customer) => ({
      ...customer,
      averageOrderValue: customer.paidOrders
        ? customer.totalSpent / customer.paidOrders
        : 0,
      orderRows: customer.orderRows.sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at))
      ),
    }));

    if (term) {
      rows = rows.filter((customer) =>
        [customer.name, customer.email, customer.phone]
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }

    rows.sort((a, b) => b.totalSpent - a.totalSpent);

    const total = rows.length;
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(10, Math.min(100, Number(pageSize) || 25));
    const start = (safePage - 1) * safePageSize;

    return {
      customers: rows.slice(start, start + safePageSize),
      total,
      page: safePage,
      pageSize: safePageSize,
      summary: {
        customers: customers.size,
        repeatCustomers: [...customers.values()].filter((customer) => customer.orders > 1).length,
        registeredCustomers: [...customers.values()].filter((customer) => customer.userId).length,
        totalCustomerRevenue: [...customers.values()].reduce(
          (sum, customer) => sum + Number(customer.totalSpent || 0),
          0
        ),
      },
    };
  },
};
