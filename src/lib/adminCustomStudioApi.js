import { supabase } from "@/lib/supabaseClient";
import { adminApi } from "@/lib/adminApi";

async function signedStorageUrl(bucket, path, expiresIn = 3600) {
  if (!path) return "";
  if (/^(https?:\/\/|data:image\/)/i.test(path)) return path;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) return "";
  return data?.signedUrl || "";
}

const mapOrderItem = (row) => ({
  ...row,
  customDesignId: row.custom_design_id,
  fulfillmentMode: row.fulfillment_mode,
  isCustom: row.is_custom,
  price: Number(row.unit_price || 0),
});

const mapOrder = (row) => ({
  ...row,
  orderNumber: row.order_number,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  paymentStatus: row.payment_status,
  paymentMode: row.payment_mode,
  fulfillmentStatus: row.fulfillment_status,
  needByDate: row.need_by_date,
  productionChecklist: row.production_checklist || {},
  createdAt: row.created_at,
  items: (row.order_items || []).map(mapOrderItem),
});

const mapDesign = (row) => ({
  ...row,
  userId: row.user_id,
  orderId: row.order_id,
  productId: row.product_id,
  productName: row.product_name,
  designStyle: row.design_style,
  previewUrl: row.preview_url,
  photoAssets: row.photo_assets || [],
  recipientType: row.recipient_type,
  designMood: row.design_mood,
  designIntensity: row.design_intensity,
  needByDate: row.need_by_date,
  proofRequired: row.proof_required,
  revisionAllowance: row.revision_allowance,
  primaryPhotoIndex: row.primary_photo_index,
  designPath: row.design_path,
  renderSnapshot: row.render_snapshot || {},
  productionFiles: row.production_files || {},
  customerMockupPath: row.customer_mockup_path,
  renderStatus: row.render_status,
  lockedHash: row.locked_hash,
  customerApprovedAt: row.customer_approved_at,
  preflight: row.preflight || {},
  createdAt: row.created_at,
});

const mapProof = (row) => ({
  ...row,
  customDesignId: row.custom_design_id,
  orderId: row.order_id,
  orderItemId: row.order_item_id,
  currentVersion: row.current_version,
  customerComments: row.customer_comments || [],
  adminComments: row.admin_comments || [],
  approvedAt: row.approved_at,
  revisionCount: row.revision_count,
  maxRevisions: row.max_revisions,
  revisionPins: row.revision_pins || [],
  approvalAcknowledged: row.approval_acknowledged,
  createdAt: row.created_at,
  versions: (row.proof_versions || []).map((version) => ({
    ...version,
    createdAt: version.created_at,
  })),
});

export const adminCustomStudioApi = {
  async load() {
    const [ordersResult, designsResult, proofsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("custom_designs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("design_proofs")
        .select("*, proof_versions(*)")
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

    if (ordersResult.error) throw ordersResult.error;
    if (designsResult.error) throw designsResult.error;
    if (proofsResult.error) throw proofsResult.error;

    const orders = (ordersResult.data || [])
      .map(mapOrder)
      .filter((order) => order.items.some((item) => item.isCustom));

    const designs = await Promise.all(
      (designsResult.data || []).map(async (row) => {
        // Stored private bucket keys cannot be used directly as <img src>.
        // Sign only the first six thumbnails visible in the admin grid, in a
        // single Storage request per design, instead of signing every upload.
        const photoAssets = row.photo_assets || [];
        const visiblePaths = [...new Set([
          ...photoAssets.slice(0, 6).map((asset) => asset?.path || asset?.storage_path || asset?.url || ""),
          ...(!photoAssets.length ? (row.photos || []).slice(0, 6) : []),
        ].filter((path) => path && !/^(https?:\/\/|data:image\/)/i.test(path)))];
        const signedPhotos = new Map();
        if (visiblePaths.length) {
          const { data: signed, error: photoError } = await supabase.storage
            .from("customer-uploads")
            .createSignedUrls(visiblePaths, 3600);
          if (!photoError) visiblePaths.forEach((path, i) => signedPhotos.set(path, signed?.[i]?.signedUrl || ""));
        }
        const photoUrl = (path) => /^(https?:\/\/|data:image\/)/i.test(path || "") ? path : signedPhotos.get(path) || "";
        const productionFiles = {};
        for (const side of ["front", "back"]) {
          const file = row.production_files?.[side];
          if (!file?.path) continue;
          productionFiles[side] = {
            ...file,
            downloadUrl: await signedStorageUrl("customer-uploads", file.path),
          };
        }
        return mapDesign({
          ...row,
          preview_url: await signedStorageUrl("customer-uploads", row.preview_url),
          photo_assets: photoAssets.map((asset) => ({
            ...asset,
            url: photoUrl(asset?.path || asset?.storage_path || asset?.url),
          })),
          photos: (row.photos || []).map((path) => photoUrl(path)),
          production_files: productionFiles,
        });
      })
    );

    const proofs = await Promise.all(
      (proofsResult.data || []).map(async (row) => {
        const signedVersions = await Promise.all(
          (row.proof_versions || []).map(async (version) => ({
            ...version,
            url: await signedStorageUrl("design-proofs", version.url),
          }))
        );
        return mapProof({ ...row, proof_versions: signedVersions });
      })
    );

    return { orders, designs, proofs };
  },

  async startArtwork(order, proof) {
    await adminApi.updateOrder(order.id, {
      status: "design_in_progress",
      designStatus: "design_in_progress",
    });

    if (proof?.id) {
      await adminApi.updateProof(proof.id, { status: "in_progress" });
    }
  },

  async setProofStatus(proofId, status) {
    await adminApi.updateProof(proofId, { status });
  },

  async uploadProof(proof, file) {
    return adminApi.uploadProof(proof, file);
  },

  async releaseApprovedOrder(orderId) {
    // Atomic DB-side predicate: a stale browser tab cannot release an order
    // after payment has been voided or while the storefront uses test mode.
    const { data, error } = await supabase.from("orders")
      .update({ status: "production_queue", production_status: "queued" })
      .eq("id", orderId)
      .eq("payment_status", "paid")
      .eq("payment_mode", "live")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error("Production release blocked: verified live payment is required.");
  },
};
