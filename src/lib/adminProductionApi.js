import { supabase } from "@/lib/supabaseClient";
import { adminApi } from "@/lib/adminApi";

export const PRODUCTION_STATUSES = [
  "production_queue",
  "printing",
  "quality_control",
  "packing",
  "ready_for_pickup",
  "shipped",
  "out_for_delivery",
  "delivered",
  "completed",
];

export const PRODUCTION_CHECKS = [
  ["customerChecked", "Customer details checked"],
  ["garmentChecked", "Garment checked"],
  ["sizeColorQtyChecked", "Size, color & quantity checked"],
  ["spellingChecked", "Spelling checked"],
  ["proofVersionChecked", "Approved proof version checked"],
  ["placementChecked", "Print placement checked"],
  ["approvalCaptured", "Customer approval captured"],
  ["printFileAttached", "Production print file attached"],
];

export const adminProductionApi = {
  async list() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_email, total, status, production_status, fulfillment_status, priority, need_by_date, production_checklist, tracking_number, carrier, created_at, order_items(id, name, image, variant, size, color, quantity, is_custom, custom_design_id)"
      )
      .in("status", PRODUCTION_STATUSES)
      .order("need_by_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(250);

    if (error) throw error;
    return data || [];
  },

  async updateChecklist(orderId, checklist) {
    await adminApi.updateOrder(orderId, { productionChecklist: checklist });
  },

  async setStatus(orderId, status) {
    const productionStatus =
      status === "production_queue"
        ? "queued"
        : status === "printing"
          ? "printing"
          : status === "quality_control"
            ? "quality_control"
            : status === "packing"
              ? "packing"
              : ["ready_for_pickup", "shipped", "out_for_delivery", "delivered", "completed"].includes(status)
                ? "completed"
                : "not_started";

    const fulfillmentStatus =
      status === "ready_for_pickup"
        ? "ready_for_pickup"
        : status === "shipped"
          ? "shipped"
          : status === "out_for_delivery"
            ? "out_for_delivery"
            : status === "delivered"
              ? "delivered"
              : undefined;

    await adminApi.updateOrder(orderId, {
      status,
      productionStatus,
      ...(fulfillmentStatus ? { fulfillmentStatus } : {}),
    });
  },

  async updateTracking(orderId, trackingNumber, carrier) {
    await adminApi.updateOrder(orderId, { trackingNumber, carrier });
  },
};
