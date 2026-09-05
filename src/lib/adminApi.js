import { supabase } from "@/lib/supabaseClient";
import { normalizeProduct, normalizeReview } from "@/lib/supabaseMappers";

const throwIfError = ({ error, data }) => {
  if (error) throw error;
  return data;
};

async function signedStorageUrl(bucket, path, expiresIn = 3600) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) return "";
  return data?.signedUrl || "";
}

const mapVariant = (row) => ({
  ...row,
  podSku: row.pod_sku,
});

const mapOrderItem = (row) => ({
  ...row,
  productId: row.product_id,
  variantId: row.variant_id,
  customDesignId: row.custom_design_id,
  fulfillmentMode: row.fulfillment_mode,
  isCustom: row.is_custom,
  price: Number(row.unit_price || 0),
});

const mapOrder = (row) => ({
  ...row,
  orderNumber: row.order_number,
  customerEmail: row.customer_email,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  fulfillmentStatus: row.fulfillment_status,
  shippingAddress: row.shipping_address,
  billingAddress: row.billing_address,
  shippingMethod: row.shipping_method,
  paymentStatus: row.payment_status,
  paymentIntentId: row.stripe_payment_intent_id,
  trackingNumber: row.tracking_number,
  discountCode: row.discount_code,
  isGuest: row.is_guest,
  needByDate: row.need_by_date,
  productionChecklist: row.production_checklist,
  created_date: row.created_at,
  updated_date: row.updated_at,
  items: (row.order_items || []).map(mapOrderItem),
});

const mapCustomDesign = (row) => ({
  ...row,
  userId: row.user_id,
  orderId: row.order_id,
  productId: row.product_id,
  productName: row.product_name,
  designStyle: row.design_style,
  previewUrl: row.preview_url,
  photoAssets: row.photo_assets,
  recipientType: row.recipient_type,
  designMood: row.design_mood,
  designIntensity: row.design_intensity,
  garmentTier: row.garment_tier,
  needByDate: row.need_by_date,
  proofRequired: row.proof_required,
  revisionAllowance: row.revision_allowance,
  primaryPhotoIndex: row.primary_photo_index,
  customerConfirmedRights: row.customer_confirmed_rights,
  approvalPolicyAcknowledged: row.approval_policy_acknowledged,
  additionalGarments: row.additional_garments,
  created_date: row.created_at,
  updated_date: row.updated_at,
});

const mapProof = (row) => ({
  ...row,
  customDesignId: row.custom_design_id,
  orderId: row.order_id,
  orderItemId: row.order_item_id,
  currentVersion: row.current_version,
  customerComments: row.customer_comments,
  adminComments: row.admin_comments,
  approvedAt: row.approved_at,
  revisionCount: row.revision_count,
  maxRevisions: row.max_revisions,
  revisionPins: row.revision_pins,
  approvedBy: row.approved_by,
  approvalAcknowledged: row.approval_acknowledged,
  created_date: row.created_at,
  updated_date: row.updated_at,
  versions: (row.proof_versions || [])
    .map((version) => ({
      ...version,
      createdAt: version.created_at,
    }))
    .sort((a, b) => Number(a.version) - Number(b.version)),
});

const mapCollection = (row) => ({
  ...row,
  sortOrder: row.sort_order,
  created_date: row.created_at,
  updated_date: row.updated_at,
});

const mapDiscount = (row) => ({
  ...row,
  appliesTo: row.applies_to,
  appliesToId: row.applies_to_id,
  minPurchase: row.min_purchase,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  usageCount: row.usage_count,
  usageLimit: row.usage_limit,
  qtyTier2: row.qty_tier_2,
  qtyTier3: row.qty_tier_3,
  created_date: row.created_at,
  updated_date: row.updated_at,
});

const mapSettings = (row) => row ? ({
  ...row,
  storeName: row.store_name,
  primaryColor: row.primary_color,
  orderPrefix: row.order_prefix,
  lowStockThreshold: row.low_stock_threshold,
  contactEmail: row.contact_email,
  footerText: row.footer_text,
  updated_date: row.updated_at,
}) : null;

const productPayload = (data) => ({
  name: data.name,
  slug: data.slug,
  description: data.description || null,
  type: data.type || null,
  category: data.category || null,
  vendor: data.vendor || "GDP Clothing",
  barcode: data.barcode || null,
  cost_per_item: data.costPerItem,
  track_inventory: data.trackInventory !== false,
  requires_shipping: data.requiresShipping !== false,
  taxable: data.taxable !== false,
  price: Number(data.price || 0),
  compare_at_price: data.compareAtPrice,
  images: data.images || [],
  colors: data.colors || [],
  sizes: data.sizes || [],
  tags: data.tags || [],
  fulfillment_mode: data.fulfillmentMode || "in_house",
  pod_provider: data.podProvider || null,
  status: data.status || "draft",
  featured: Boolean(data.featured),
  best_seller: Boolean(data.bestSeller),
  new_arrival: Boolean(data.newArrival),
  custom_designable: Boolean(data.customDesignable),
  customization: data.customization || {},
  material: data.material || null,
  seo: data.seo || {},
});

const variantPayload = (productId, variant) => ({
  product_id: productId,
  name: variant.name || "Default",
  sku: variant.sku || null,
  pod_sku: variant.podSku || null,
  stock: Number(variant.stock || 0),
  price: variant.price === null || variant.price === undefined ? null : Number(variant.price),
  color: variant.color || null,
  size: variant.size || null,
  active: true,
});

export const adminApi = {
  async loadDashboard() {
    const [orders, products, proofs, designs, collections, discounts, reviews, settings] = await Promise.all([
      supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(250),
      supabase.from("products").select("*, product_variants(*), collection_products(collection_id)").order("created_at", { ascending: false }).limit(500),
      supabase.from("design_proofs").select("*, proof_versions(*)").order("created_at", { ascending: false }).limit(250),
      supabase.from("custom_designs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("collections").select("*").order("created_at", { ascending: false }).limit(250),
      supabase.from("discounts").select("*").order("created_at", { ascending: false }).limit(250),
      supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(250),
      supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    const designRows = throwIfError(designs) || [];
    const proofRows = throwIfError(proofs) || [];

    const signedDesigns = await Promise.all(
      designRows.map(async (row) => mapCustomDesign({
        ...row,
        preview_url: await signedStorageUrl("customer-uploads", row.preview_url),
      }))
    );

    const signedProofs = await Promise.all(
      proofRows.map(async (row) => ({
        ...row,
        proof_versions: await Promise.all(
          (row.proof_versions || []).map(async (version) => ({
            ...version,
            url: await signedStorageUrl("design-proofs", version.url),
          }))
        ),
      }))
    );

    return {
      orders: (throwIfError(orders) || []).map(mapOrder),
      products: (throwIfError(products) || []).map((row) => ({
        ...normalizeProduct(row),
        variants: (row.product_variants || []).map(mapVariant),
        collectionIds: (row.collection_products || []).map((link) => link.collection_id),
      })),
      proofs: signedProofs.map(mapProof),
      customDesigns: signedDesigns,
      collections: (throwIfError(collections) || []).map(mapCollection),
      discounts: (throwIfError(discounts) || []).map(mapDiscount),
      reviews: (throwIfError(reviews) || []).map(normalizeReview),
      storeSettings: mapSettings(throwIfError(settings)),
    };
  },

  async updateOrder(id, data) {
    const payload = {};
    if ("status" in data) payload.status = data.status;
    if ("fulfillmentStatus" in data) payload.fulfillment_status = data.fulfillmentStatus;
    if ("productionChecklist" in data) payload.production_checklist = data.productionChecklist;
    if ("trackingNumber" in data) payload.tracking_number = data.trackingNumber;
    if ("carrier" in data) payload.carrier = data.carrier;
    if ("notes" in data) payload.notes = data.notes;

    throwIfError(await supabase.from("orders").update(payload).eq("id", id));
  },

  async updateProof(id, data) {
    const payload = {};
    if ("status" in data) payload.status = data.status;
    if ("currentVersion" in data) payload.current_version = data.currentVersion;
    if ("customerComments" in data) payload.customer_comments = data.customerComments;
    if ("adminComments" in data) payload.admin_comments = data.adminComments;
    if ("approvedAt" in data) payload.approved_at = data.approvedAt;
    if ("revisionCount" in data) payload.revision_count = data.revisionCount;
    if ("revisionPins" in data) payload.revision_pins = data.revisionPins;
    if ("approvalAcknowledged" in data) payload.approval_acknowledged = data.approvalAcknowledged;

    throwIfError(await supabase.from("design_proofs").update(payload).eq("id", id));
  },

  async uploadProof(proof, file) {
    const { data: design, error: designError } = await supabase
      .from("custom_designs")
      .select("user_id")
      .eq("id", proof.customDesignId)
      .maybeSingle();

    if (designError) throw designError;

    const nextVersion = Number(proof.currentVersion || 0) + 1;
    const ownerFolder = design?.user_id || "unassigned";
    const safeName = String(file.name || "proof")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const path = `${ownerFolder}/${proof.id}/v${nextVersion}-${Date.now()}-${safeName}`;

    const upload = await supabase.storage
      .from("design-proofs")
      .upload(path, file, { upsert: false });

    if (upload.error) throw upload.error;

    const versionInsert = await supabase.from("proof_versions").insert({
      proof_id: proof.id,
      version: nextVersion,
      url: path,
      note: proof.status === "revision_requested" ? "Revised proof" : "Design proof",
    });
    if (versionInsert.error) throw versionInsert.error;

    await this.updateProof(proof.id, {
      currentVersion: nextVersion,
      status: "awaiting_approval",
    });

    if (proof.orderId) {
      await this.updateOrder(proof.orderId, {
        status: "awaiting_approval",
        fulfillmentStatus: "awaiting_approval",
      });
    }
  },

  async archiveProduct(id) {
    throwIfError(await supabase.from("products").update({ status: "archived" }).eq("id", id));
  },

  async updateReview(id, status) {
    throwIfError(await supabase.from("reviews").update({ status }).eq("id", id));
  },

  async saveProduct(id, data) {
    let productId = id;

    if (id) {
      throwIfError(await supabase.from("products").update(productPayload(data)).eq("id", id));
    } else {
      const created = await supabase
        .from("products")
        .insert(productPayload(data))
        .select("id")
        .single();
      productId = throwIfError(created).id;
    }

    throwIfError(await supabase.from("product_variants").delete().eq("product_id", productId));
    if ((data.variants || []).length) {
      throwIfError(
        await supabase
          .from("product_variants")
          .insert(data.variants.map((variant) => variantPayload(productId, variant)))
      );
    }

    throwIfError(await supabase.from("collection_products").delete().eq("product_id", productId));
    if ((data.collectionIds || []).length) {
      throwIfError(
        await supabase.from("collection_products").insert(
          data.collectionIds.map((collectionId, position) => ({
            product_id: productId,
            collection_id: collectionId,
            position,
          }))
        )
      );
    }

    return productId;
  },

  async saveCollection(id, data) {
    const payload = {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      image: data.image || null,
      tagline: data.tagline || null,
      seasonal: Boolean(data.seasonal),
      status: data.status || "active",
      sort_order: data.sortOrder || "manual",
    };

    if (id) {
      throwIfError(await supabase.from("collections").update(payload).eq("id", id));
    } else {
      throwIfError(await supabase.from("collections").insert(payload));
    }
  },

  async saveDiscount(id, data) {
    const payload = {
      code: data.code,
      type: data.type,
      value: Number(data.value || 0),
      applies_to: data.appliesTo || "all",
      applies_to_id: data.appliesToId || null,
      min_purchase: data.minPurchase,
      active: Boolean(data.active),
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      usage_limit: data.usageLimit,
    };

    if (id) {
      throwIfError(await supabase.from("discounts").update(payload).eq("id", id));
    } else {
      throwIfError(await supabase.from("discounts").insert(payload));
    }
  },

  async saveStoreSettings(id, data) {
    const payload = {
      id: id || 1,
      store_name: data.storeName || "GDP Clothing",
      slogan: data.slogan || "",
      currency: data.currency || "CAD",
      timezone: data.timezone || "America/Regina",
      order_prefix: data.orderPrefix || "GDP",
      low_stock_threshold: Number(data.lowStockThreshold || 0),
      contact_email: data.contactEmail || null,
      phone: data.phone || null,
      address: data.address || null,
      logo: data.logo || null,
      primary_color: data.primaryColor || null,
      instagram: data.instagram || null,
      facebook: data.facebook || null,
      tiktok: data.tiktok || null,
      youtube: data.youtube || null,
      footer_text: data.footerText || null,
    };

    throwIfError(await supabase.from("store_settings").upsert(payload));
  },
};
