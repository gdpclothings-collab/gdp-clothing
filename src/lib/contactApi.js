import { supabase } from "@/lib/supabaseClient";

export const CONTACT_TOPICS = [
  { value: "order_support", label: "Order support" },
  { value: "custom_order", label: "Custom design / custom order" },
  { value: "product_question", label: "Product or sizing question" },
  { value: "return_exchange", label: "Return or exchange" },
  { value: "shipping", label: "Shipping or delivery" },
  { value: "general", label: "General question" },
];

const TOPIC_LABELS = Object.fromEntries(
  CONTACT_TOPICS.map((topic) => [topic.value, topic.label])
);

function clean(value, maxLength = 5000) {
  return String(value || "").trim().slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isMissingContactColumn(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "42703" ||
    /category|customer_phone|order_number|source/i.test(message) &&
      /column|schema cache/i.test(message)
  );
}

export const contactApi = {
  async getStoreContact() {
    const { data, error } = await supabase
      .from("store_settings")
      .select("store_name, contact_email, phone, address, instagram, facebook, tiktok")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    return {
      storeName: data?.store_name || "GDP Clothing",
      email: data?.contact_email || "hello@gdpclothing.ca",
      phone: data?.phone || "3068363345",
      address: data?.address || "Saskatoon, Saskatchewan, Canada",
      instagram: data?.instagram || "",
      facebook: data?.facebook || "",
      tiktok: data?.tiktok || "",
    };
  },

  async submitTicket({
    userId,
    name,
    email,
    phone,
    topic,
    orderNumber,
    message,
  }) {
    const customerName = clean(name, 120);
    const customerEmail = clean(email, 200).toLowerCase();
    const customerPhone = clean(phone, 60);
    const category = CONTACT_TOPICS.some((item) => item.value === topic)
      ? topic
      : "general";
    const order = clean(orderNumber, 80);
    const body = clean(message, 6000);

    if (customerName.length < 2) {
      throw new Error("Please enter your name.");
    }
    if (!isEmail(customerEmail)) {
      throw new Error("Please enter a valid email address.");
    }
    if (body.length < 10) {
      throw new Error("Please add a little more detail so we can help.");
    }

    const topicLabel = TOPIC_LABELS[category] || "General question";
    const subject = order ? `${topicLabel} · ${order}` : topicLabel;

    const baseRow = {
      user_id: userId || null,
      subject,
      message: body,
      customer_email: customerEmail,
      customer_name: customerName,
      status: "open",
      priority: "normal",
    };

    const structuredRow = {
      ...baseRow,
      category,
      customer_phone: customerPhone || null,
      order_number: order || null,
      source: "contact_page",
    };

    let { error } = await supabase.from("support_tickets").insert(structuredRow);

    // Keep the form operational while an additive contact migration is still
    // rolling out to a Supabase environment.
    if (error && isMissingContactColumn(error)) {
      ({ error } = await supabase.from("support_tickets").insert(baseRow));
    }

    if (error) throw error;

    return { ok: true };
  },
};
