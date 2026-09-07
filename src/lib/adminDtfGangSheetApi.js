import { supabase } from "@/lib/supabaseClient";
import { adminSettingsApi } from "@/lib/adminSettingsApi";

const mapDtfItem = async (order, item) => {
  const spec = item.custom_data || {};
  const firstArtwork = Array.isArray(spec.layout) ? spec.layout.find((entry) => entry?.storagePath) : null;
  let artworkUrl = "";

  if (firstArtwork?.storagePath) {
    const { data } = await supabase.storage
      .from("dtf-artwork")
      .createSignedUrl(firstArtwork.storagePath, 3600);
    artworkUrl = data?.signedUrl || "";
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    status: order.status,
    paymentStatus: order.payment_status,
    productionStatus: order.production_status,
    createdAt: order.created_at,
    orderItemId: item.id,
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unit_price || 0),
    spec,
    artworkUrl,
  };
};

export const adminDtfGangSheetApi = {
  async load() {
    const [settings, ordersResult] = await Promise.all([
      adminSettingsApi.loadDtfSettings(),
      supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_email, status, payment_status, production_status, created_at, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

    if (ordersResult.error) throw ordersResult.error;

    const queue = [];
    for (const order of ordersResult.data || []) {
      for (const item of order.order_items || []) {
        if (item?.custom_data?.type !== "dtf_gang_sheet") continue;
        queue.push(await mapDtfItem(order, item));
      }
    }

    return { settings, queue };
  },

  async saveSettings(settings) {
    return adminSettingsApi.saveDtfSettings(settings);
  },
};
