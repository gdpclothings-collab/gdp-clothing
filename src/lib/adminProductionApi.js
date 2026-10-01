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

async function signedStorageUrl(bucket, path, expiresIn = 3600) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) return "";
  return data?.signedUrl || "";
}

function requiredProductionSides(placement) {
  if (placement === "front_back") return ["front", "back"];
  if (placement === "back" || placement === "large_back") return ["back"];
  return ["front"];
}

async function mapProductionDesign(row) {
  const productionFiles = {};
  await Promise.all(
    ["front", "back"].map(async (side) => {
      const file = row.production_files?.[side];
      if (!file?.path) return;
      productionFiles[side] = {
        ...file,
        downloadUrl: await signedStorageUrl("customer-uploads", file.path),
      };
    })
  );

  const mockupPath = row.customer_mockup_path || row.preview_url || "";
  return {
    id: row.id,
    placement: row.placement || "front",
    renderStatus: row.render_status || "draft",
    lockedHash: row.locked_hash || "",
    customerApprovedAt: row.customer_approved_at || null,
    preflight: row.preflight || {},
    productionFiles,
    requiredSides: requiredProductionSides(row.placement),
    mockupUrl: await signedStorageUrl("customer-uploads", mockupPath),
  };
}

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

    const orders = data || [];
    const customDesignIds = [
      ...new Set(
        orders
          .flatMap((order) => order.order_items || [])
          .filter((item) => item.is_custom && item.custom_design_id)
          .map((item) => item.custom_design_id)
      ),
    ];

    if (!customDesignIds.length) return orders;

    const { data: designRows, error: designError } = await supabase
      .from("custom_designs")
      .select(
        "id, placement, preview_url, customer_mockup_path, render_status, locked_hash, customer_approved_at, preflight, production_files"
      )
      .in("id", customDesignIds);

    if (designError) throw designError;

    const mappedDesigns = await Promise.all((designRows || []).map(mapProductionDesign));
    const designById = new Map(mappedDesigns.map((design) => [design.id, design]));

    return orders.map((order) => ({
      ...order,
      order_items: (order.order_items || []).map((item) => ({
        ...item,
        production_design: item.custom_design_id
          ? designById.get(item.custom_design_id) || null
          : null,
      })),
    }));
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
