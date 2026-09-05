import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

async function getUser(req: Request, url: string, anonKey: string) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.auth.getUser();
  return data?.user || null;
}

async function signedUrl(service: any, bucket: string, path: string | null, expiresIn = 3600) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await service.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl || "";
}

function mapOrder(row: any) {
  return {
    ...row,
    orderNumber: row.order_number,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    shippingMethod: row.shipping_method,
    trackingNumber: row.tracking_number,
    needByDate: row.need_by_date,
    productionChecklist: row.production_checklist,
    created_date: row.created_at,
    items: (row.order_items || []).map((item: any) => ({
      ...item,
      productId: item.product_id,
      customDesignId: item.custom_design_id,
      isCustom: item.is_custom,
      fulfillmentMode: item.fulfillment_mode,
      price: Number(item.unit_price || 0),
    })),
  };
}

function mapDesign(row: any, previewUrl: string) {
  return {
    ...row,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    designStyle: row.design_style,
    previewUrl,
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
  };
}

function mapProof(row: any, versions: any[]) {
  return {
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
    approvedBy: row.approved_by,
    approvalAcknowledged: row.approval_acknowledged,
    versions,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: true, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const user = await getUser(req, supabaseUrl, anonKey);
  if (!user) return respond({ error: true, message: "Authentication required." }, 401);

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "list") {
      const { data: orders, error: orderError } = await service
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (orderError) throw orderError;

      const { data: designs, error: designError } = await service
        .from("custom_designs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (designError) throw designError;

      const designIds = (designs || []).map((d: any) => d.id);
      let proofs: any[] = [];
      if (designIds.length) {
        const { data, error } = await service
          .from("design_proofs")
          .select("*")
          .in("custom_design_id", designIds)
          .order("created_at", { ascending: false });
        if (error) throw error;
        proofs = data || [];
      }

      const proofIds = proofs.map((p: any) => p.id);
      let versions: any[] = [];
      if (proofIds.length) {
        const { data, error } = await service
          .from("proof_versions")
          .select("*")
          .in("proof_id", proofIds)
          .order("version", { ascending: true });
        if (error) throw error;
        versions = data || [];
      }

      const signedVersions = new Map<string, any[]>();
      for (const version of versions) {
        const signed = await signedUrl(service, "design-proofs", version.url);
        const arr = signedVersions.get(version.proof_id) || [];
        arr.push({
          ...version,
          createdAt: version.created_at,
          url: signed,
        });
        signedVersions.set(version.proof_id, arr);
      }

      const signedDesigns: any[] = [];
      for (const design of designs || []) {
        const preview = await signedUrl(service, "customer-uploads", design.preview_url);
        signedDesigns.push(mapDesign(design, preview));
      }

      const mappedProofs = proofs.map((proof: any) =>
        mapProof(proof, signedVersions.get(proof.id) || [])
      );

      const entries = (orders || [])
        .map((order: any) => {
          const orderDesigns = signedDesigns.filter((d: any) => d.orderId === order.id);
          if (!orderDesigns.length) return null;
          const ids = new Set(orderDesigns.map((d: any) => d.id));
          return {
            order: mapOrder(order),
            designs: orderDesigns,
            proofs: mappedProofs.filter((p: any) => ids.has(p.customDesignId)),
          };
        })
        .filter(Boolean);

      return respond({ orders: entries });
    }

    const proofId = String(body?.proofId || "");
    if (!proofId) return respond({ error: true, message: "Missing proof ID." }, 400);

    const { data: proof, error: proofError } = await service
      .from("design_proofs")
      .select("*")
      .eq("id", proofId)
      .maybeSingle();
    if (proofError) throw proofError;
    if (!proof) return respond({ error: true, message: "Proof not found." }, 404);

    const { data: design, error: designError } = await service
      .from("custom_designs")
      .select("*")
      .eq("id", proof.custom_design_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (designError) throw designError;
    if (!design) return respond({ error: true, message: "Proof access denied." }, 403);

    if (action === "approve") {
      if (!["ready", "sent", "awaiting_approval", "revised"].includes(proof.status)) {
        return respond({ error: true, message: "This proof is not awaiting approval." }, 409);
      }

      const now = new Date().toISOString();
      const { error } = await service
        .from("design_proofs")
        .update({
          status: "approved",
          approved_at: now,
          approved_by: user.id,
          approval_acknowledged: true,
        })
        .eq("id", proof.id);
      if (error) throw error;

      if (proof.order_id) {
        await service
          .from("orders")
          .update({ status: "approved", fulfillment_status: "approved" })
          .eq("id", proof.order_id);
      }

      return respond({ success: true, status: "approved" });
    }

    if (action === "request_revision") {
      const comment = String(body?.comment || "").trim();
      if (!comment) return respond({ error: true, message: "Revision comment is required." }, 400);
      if (!["ready", "sent", "awaiting_approval", "revised"].includes(proof.status)) {
        return respond({ error: true, message: "This proof is not open for revision." }, 409);
      }

      const revisionCount = Number(proof.revision_count || 0);
      const maxRevisions = Number(proof.max_revisions || 0);
      if (revisionCount >= maxRevisions) {
        return respond({ error: true, message: "The included revision limit has been reached." }, 409);
      }

      const comments = [...(proof.customer_comments || []), comment];
      const { error } = await service
        .from("design_proofs")
        .update({
          status: "revision_requested",
          customer_comments: comments,
          revision_count: revisionCount + 1,
        })
        .eq("id", proof.id);
      if (error) throw error;

      if (proof.order_id) {
        await service
          .from("orders")
          .update({ status: "revision_requested", fulfillment_status: "revision_requested" })
          .eq("id", proof.order_id);
      }

      return respond({ success: true, status: "revision_requested" });
    }

    return respond({ error: true, message: "Unknown proof action." }, 400);
  } catch (error) {
    console.error("custom-proof-action error", error);
    return respond({ error: true, message: error?.message || "Proof action failed." }, 500);
  }
});
