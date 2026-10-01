import { supabase } from "@/lib/supabaseClient";
import { calculateDtfPrice, normalizeDtfSettings } from "@/lib/dtfGangSheet";

const mapDtfItem = async (order, item) => {
  const spec = item.custom_data || {};
  const layout = Array.isArray(spec.layout) ? spec.layout : [];
  const paths = layout.map((entry) => entry?.storagePath).filter(Boolean);
  const signed = paths.length
    ? await supabase.storage.from("dtf-artwork").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlByPath = new Map((signed.data || []).map((entry, index) => [paths[index], entry?.signedUrl || ""]));
  const exportLayout = layout.map((entry) => ({ ...entry, exportUrl: urlByPath.get(entry.storagePath) || "" }));

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
    spec: { ...spec, layout: exportLayout },
    artworkUrl: exportLayout.find((entry) => entry.exportUrl)?.exportUrl || "",
  };
};

export const adminDtfGangSheetApi = {
  async load() {
    const [settingsResult, ordersResult] = await Promise.all([
      supabase.rpc("get_dtf_settings"),
      supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_email, status, payment_status, production_status, created_at, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (ordersResult.error) throw ordersResult.error;

    const settings = normalizeDtfSettings({
      adminPreviewBypassEnabled: false,
      adminProductionExportEnabled: false,
      ...(settingsResult.data || {}),
    });
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
    const normalized = normalizeDtfSettings(settings);
    const startingLength = normalized.popularLengths?.[0] || normalized.minLength;
    const startingPrice = calculateDtfPrice(
      normalized.defaultWidth,
      startingLength,
      normalized
    ).price;

    const [settingsResult, productResult] = await Promise.all([
      supabase.rpc("save_admin_dtf_settings", { p_settings: normalized }),
      supabase
        .from("products")
        .update({
          price: startingPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", "dtf-gang-sheet"),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (productResult.error) throw productResult.error;
    return normalizeDtfSettings(settingsResult.data || normalized);
  },
};
