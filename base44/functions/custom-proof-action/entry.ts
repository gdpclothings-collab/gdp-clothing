import { createClientFromRequest } from "npm:@base44/sdk";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: true, message: "Authentication required." }, { status: 401 });

    const body = await req.json();
    const action = body.action || "list";

    if (action === "list") {
      const ordersRaw = await base44.asServiceRole.entities.Order.filter({ customerEmail: user.email }, "-created_date", 100);
      const orders = Array.isArray(ordersRaw) ? ordersRaw : ordersRaw?.items || [];
      const customOrders = orders.filter(o => o?.items?.some(item => item?.isCustom));
      const enriched = [];

      for (const order of customOrders) {
        const proofsRaw = await base44.asServiceRole.entities.DesignProof.filter({ orderId: order.id });
        const proofs = Array.isArray(proofsRaw) ? proofsRaw : proofsRaw?.items || [];
        const designs = [];
        for (const designId of order.customDesignIds || []) {
          try {
            const design = await base44.asServiceRole.entities.CustomDesign.get(designId);
            if (design) designs.push(design);
          } catch {}
        }
        enriched.push({ order, proofs, designs });
      }

      return Response.json({ orders: enriched });
    }

    const proofId = body.proofId;
    if (!proofId) return Response.json({ error: true, message: "Proof is required." }, { status: 400 });

    const proof = await base44.asServiceRole.entities.DesignProof.get(proofId);
    if (!proof?.orderId) return Response.json({ error: true, message: "Proof is not linked to an order." }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(proof.orderId);
    if (!order || String(order.customerEmail || "").toLowerCase() !== String(user.email).toLowerCase()) {
      return Response.json({ error: true, message: "You do not have access to this proof." }, { status: 403 });
    }

    if (action === "approve") {
      if (!["ready","sent","awaiting_approval","revised"].includes(proof.status)) {
        return Response.json({ error: true, message: "This proof is not currently awaiting approval." }, { status: 409 });
      }
      await base44.asServiceRole.entities.DesignProof.update(proof.id, {
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: user.email,
        approvalAcknowledged: true
      });
      await base44.asServiceRole.entities.Order.update(order.id, {
        status: "approved",
        fulfillmentStatus: "approved",
        productionChecklist: {
          ...(order.productionChecklist || {}),
          approvalCaptured: true
        }
      });
      return Response.json({ success: true, status: "approved" });
    }

    if (action === "request_revision") {
      const comment = String(body.comment || "").trim();
      if (!comment) return Response.json({ error: true, message: "Tell us what you want changed." }, { status: 400 });
      const revisionCount = Number(proof.revisionCount || 0) + 1;
      if (Number(proof.maxRevisions || 0) > 0 && revisionCount > Number(proof.maxRevisions)) {
        return Response.json({ error: true, message: "Included revisions have been used. Please contact GDP Clothing for additional changes." }, { status: 409 });
      }
      await base44.asServiceRole.entities.DesignProof.update(proof.id, {
        status: "revision_requested",
        revisionCount,
        customerComments: [...(proof.customerComments || []), comment]
      });
      await base44.asServiceRole.entities.Order.update(order.id, {
        status: "revision_requested",
        fulfillmentStatus: "revision_requested"
      });
      return Response.json({ success: true, status: "revision_requested", revisionCount });
    }

    return Response.json({ error: true, message: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: true, message: error?.message || "Custom proof request failed." }, { status: 500 });
  }
}