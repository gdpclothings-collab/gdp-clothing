import { supabase } from "@/lib/supabaseClient";
import { normalizeProduct } from "@/lib/supabaseMappers";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeOrderItem = (row) => ({
  ...row,
  productId: row.product_id,
  variantId: row.variant_id,
  customDesignId: row.custom_design_id,
  fulfillmentMode: row.fulfillment_mode,
  isCustom: row.is_custom,
  price: Number(row.unit_price || 0),
});

export const normalizeOrder = (row) => row ? ({
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
  confirmationToken: row.confirmation_token,
  created_date: row.created_at,
  updated_date: row.updated_at,
  items: (row.order_items || []).map(normalizeOrderItem),
}) : null;

const normalizeSavedDesign = (row) => ({
  ...row,
  customDesignId: row.custom_design_id,
  previewUrl: row.preview_url,
  created_date: row.created_at,
});

const normalizeCustomDesign = (row) => ({
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
});

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    const authError = Object.assign(
      new Error("Please sign in before uploading private artwork or saving a custom design."),
      { code: "AUTH_REQUIRED" }
    );
    throw authError;
  }
  return data.user;
}

async function signedCustomerUpload(path, expiresIn = 3600) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const { data, error } = await supabase.storage
    .from("customer-uploads")
    .createSignedUrl(path, expiresIn);

  if (error) return "";
  return data?.signedUrl || "";
}

export const customerApi = {
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  },

  async getProduct(id) {
    if (!uuidPattern.test(String(id || ""))) return null;
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return normalizeProduct(data);
  },

  async getDefaultCustomProduct() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .eq("custom_designable", true)
      .order("featured", { ascending: false })
      .order("best_seller", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return normalizeProduct(data);
  },

  async uploadArtwork(file) {
    const user = await requireUser();
    const safeName = String(file.name || "artwork")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from("customer-uploads")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
    if (error) throw error;

    const signedUrl = await signedCustomerUpload(path);
    return { file_url: signedUrl, storage_path: path };
  },

  async createCustomDesign(data) {
    const user = await requireUser();
    const productId = uuidPattern.test(String(data.productId || "")) ? data.productId : null;
    const photoAssets = (data.photoAssets || []).map((asset) => ({
      path: asset.path || asset.storage_path || null,
      name: asset.name || "",
      width: asset.width || null,
      height: asset.height || null,
      quality: asset.quality || null,
      isPrimary: Boolean(asset.isPrimary),
    }));
    const photoPaths = photoAssets.map((asset) => asset.path).filter(Boolean);
    const primary = photoAssets[data.primaryPhotoIndex || 0];

    const payload = {
      user_id: user.id,
      product_id: productId,
      product_name: data.productName,
      name: data.name || null,
      design_style: data.designStyle || null,
      photos: photoPaths,
      personalization: data.personalization || {},
      placement: data.placement || "front",
      color: data.color || null,
      size: data.size || null,
      preview_url: primary?.path || photoPaths[0] || null,
      photo_assets: photoAssets,
      occasion: data.occasion || null,
      recipient_type: data.recipientType || null,
      design_mood: data.designMood || null,
      story: data.story || null,
      design_intensity: Number(data.designIntensity || 3),
      garment_tier: data.garmentTier || "classic",
      need_by_date: data.needByDate || null,
      priority: data.priority || "standard",
      proof_required: data.proofRequired !== false,
      revision_allowance: Number(data.revisionAllowance ?? 2),
      primary_photo_index: Number(data.primaryPhotoIndex || 0),
      customer_confirmed_rights: Boolean(data.customerConfirmedRights),
      approval_policy_acknowledged: Boolean(data.approvalPolicyAcknowledged),
      additional_garments: data.additionalGarments || [],
      status: data.status || "draft",
    };

    const { data: created, error } = await supabase
      .from("custom_designs")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return normalizeCustomDesign(created);
  },

  async listOrders() {
    const user = await requireUser();
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map(normalizeOrder);
  },

  async listSavedDesigns() {
    const user = await requireUser();
    const { data, error } = await supabase
      .from("saved_designs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;

    const rows = [];
    for (const row of data || []) {
      let previewUrl = row.preview_url || "";
      if (previewUrl && !/^https?:\/\//i.test(previewUrl)) {
        previewUrl = await signedCustomerUpload(previewUrl);
      }
      rows.push(normalizeSavedDesign({ ...row, preview_url: previewUrl }));
    }
    return rows;
  },

  async getProducts(ids) {
    const clean = (ids || []).filter((id) => uuidPattern.test(String(id)));
    if (!clean.length) return [];
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .in("id", clean)
      .eq("status", "active");
    if (error) throw error;
    return (data || []).map(normalizeProduct);
  },

  async trackOrder(orderNumber) {
    const user = await requireUser();
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", user.id)
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (error) throw error;
    return normalizeOrder(data);
  },

  async createSupportTicket(payload) {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user || null;
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user?.id || null,
      customer_email: payload.customerEmail,
      customer_name: payload.customerName || null,
      subject: payload.subject,
      message: payload.message,
      status: "open",
      priority: "normal",
    });
    if (error) throw error;
  },

  async proofAction(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke("custom-proof-action", {
      body: { action, ...payload },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.message || "Proof action failed.");
    return data;
  },

  async validateCoupon(code, purchase = 0) {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: { action: "validateCoupon", code, purchase },
    });
    if (error) throw error;
    return data;
  },

  async getCheckoutConfig({ amount, province, shippingMethod, freeShipping = false }) {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: {
        action: "checkoutConfig",
        amount,
        province,
        shippingMethod,
        freeShipping,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.message || "Checkout configuration failed.");
    return data;
  },


  async trackCheckout(cart, customer, totals, sessionToken) {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: {
        action: "trackCheckout",
        cart,
        customer,
        totals,
        sessionToken,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.message || "Checkout tracking failed.");
    return data;
  },

  async createOrder(cart, customer, discountCode, origin, checkoutSessionToken) {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: {
        action: "createOrder",
        cart,
        customer,
        discountCode,
        origin,
        checkoutSessionToken,
      },
    });

    if (error) {
      let message = error.message || "Checkout failed.";
      try {
        const context = error.context;
        if (context && typeof context.clone === "function") {
          const body = await context.clone().json();
          message = body?.message || body?.error || message;
        }
      } catch {
        // Keep the original Functions error message if the response body is unavailable.
      }
      throw new Error(message);
    }

    return data;
  },

  async getOrderConfirmation(orderNumber, token) {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: {
        action: "getOrder",
        orderNumber,
        token,
      },
    });
    if (error) throw error;
    if (data?.error) return null;
    return normalizeOrder(data?.order || null);
  },

  async signCustomerUpload(path, expiresIn = 3600) {
    return signedCustomerUpload(path, expiresIn);
  },
};
