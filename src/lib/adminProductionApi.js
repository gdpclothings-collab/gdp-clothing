import { supabase } from "@/lib/supabaseClient";
import { adminApi } from "@/lib/adminApi";
import { SEASONAL_BUCKET } from "@/lib/seasonalArtwork";

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

function systemManagedDesignRow(row) {
  return Boolean(
    row && (row.render_status === "locked" || Boolean(row.seasonal_artwork_id))
  );
}

function hasProductionSide(row, side) {
  if (row?.production_files?.[side]?.path) return true;
  return Boolean(
    side === "front" &&
      row?.seasonal_artwork_id &&
      row?.seasonal_configuration?.production_path
  );
}

export async function assertProductionEntryReady(orderId) {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, production_status, production_checklist, order_items(is_custom, custom_design_id)"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) throw new Error("Production order could not be found.");

  // Preserve established in-progress and legacy orders. This guard only closes
  // the boundary where an order first leaves not-started/queue production.
  if (!["not_started", "queued"].includes(order.production_status)) return;

  const missingCheck = PRODUCTION_CHECKS.find(
    ([key]) => !order.production_checklist?.[key]
  );
  if (missingCheck) {
    throw new Error(
      `Complete the pre-production checklist before moving this order forward. Missing: ${missingCheck[1]}.`
    );
  }

  const customDesignIds = [
    ...new Set(
      (order.order_items || [])
        .filter((item) => item.is_custom && item.custom_design_id)
        .map((item) => item.custom_design_id)
    ),
  ];

  if (!customDesignIds.length) return;

  const { data: designRows, error: designError } = await supabase
    .from("custom_designs")
    .select(
      "id, placement, render_status, production_files, seasonal_artwork_id, seasonal_configuration"
    )
    .in("id", customDesignIds);

  if (designError) throw designError;

  const designById = new Map((designRows || []).map((row) => [row.id, row]));

  for (const item of order.order_items || []) {
    if (!item.is_custom || !item.custom_design_id) continue;
    const design = designById.get(item.custom_design_id);

    // Manual-proof custom work intentionally keeps its existing human-verified
    // checklist path. Only canonical locked/seasonal files are deterministic.
    if (!systemManagedDesignRow(design)) continue;

    const missingSides = requiredProductionSides(design.placement).filter(
      (side) => !hasProductionSide(design, side)
    );

    if (missingSides.length) {
      throw new Error(
        `Approved production file is missing for: ${missingSides.join(" + ")}. Verify the custom item before moving this order forward.`
      );
    }
  }
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

  const seasonalConfiguration = row.seasonal_configuration || {};
  if (!productionFiles.front && seasonalConfiguration.production_path) {
    productionFiles.front = {
      path: seasonalConfiguration.production_path,
      width_in: Number(seasonalConfiguration.width || 0) || null,
      height_in: Number(seasonalConfiguration.height || 0) || null,
      mime_type: "image/png",
      seasonal: true,
      downloadUrl: await signedStorageUrl(SEASONAL_BUCKET, seasonalConfiguration.production_path),
    };
  }

  const mockupPath = row.customer_mockup_path || row.preview_url || "";
  return {
    id: row.id,
    placement: row.placement || "front",
    renderStatus: row.render_status || "draft",
    lockedHash: row.locked_hash || "",
    customerApprovedAt: row.customer_approved_at || null,
    preflight: row.preflight || {},
    seasonalArtworkId: row.seasonal_artwork_id || null,
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
        "id, placement, preview_url, customer_mockup_path, render_status, locked_hash, customer_approved_at, preflight, production_files, seasonal_artwork_id, seasonal_configuration"
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
    if (status !== "production_queue") {
      await assertProductionEntryReady(orderId);
    }

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
