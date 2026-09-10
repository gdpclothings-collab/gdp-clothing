import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));

  if (!timestamp || !signatures.length) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );

  const expected = hex(digest);
  return signatures.some((sig) => timingSafeEqual(expected, sig));
}

async function releaseCheckoutReservations(service: any, orderId: string, status = "released") {
  const [inventory, coupon] = await Promise.all([
    service.rpc("release_order_inventory_reservations", {
      p_order_id: orderId,
      p_status: status,
    }),
    service.rpc("release_order_coupon_reservation", {
      p_order_id: orderId,
      p_status: status,
    }),
  ]);
  if (inventory.error) console.error("inventory reservation release failed", inventory.error);
  if (coupon.error) console.error("coupon reservation release failed", coupon.error);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const liveWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const testWebhookSecret = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET");
  if (!liveWebhookSecret && !testWebhookSecret) return respond({ error: "Stripe webhook is not configured." }, 503);

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  const matchedMode = liveWebhookSecret && await verifyStripeSignature(rawBody, signature, liveWebhookSecret)
    ? "live"
    : testWebhookSecret && await verifyStripeSignature(rawBody, signature, testWebhookSecret)
      ? "test"
      : null;

  if (!matchedMode) {
    return respond({ error: "Invalid Stripe signature." }, 400);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return respond({ error: "Invalid JSON." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session?.metadata?.order_id;

      if (orderId) {
        const { data: orderRecord, error: orderRecordError } = await service
          .from("orders")
          .select("payment_mode,test_inventory_workflow")
          .eq("id", orderId)
          .maybeSingle();
        if (orderRecordError) throw orderRecordError;
        if (!orderRecord || orderRecord.payment_mode !== matchedMode || Boolean(event.livemode) !== (matchedMode === "live")) {
          return respond({ error: "Payment environment mismatch." }, 409);
        }

        const applyCommerceWorkflow = matchedMode === "live" || Boolean(orderRecord.test_inventory_workflow);
        const { data: items, error: itemError } = await service
          .from("order_items")
          .select("is_custom,custom_design_id")
          .eq("order_id", orderId);
        if (itemError) throw itemError;

        const hasCustom = (items || []).some((item: any) => item.is_custom);
        const customDesignIds = [...new Set(
          (items || [])
            .filter((item: any) => item.is_custom && item.custom_design_id)
            .map((item: any) => item.custom_design_id)
        )];
        let productionReady = false;
        let readyDesignIds: string[] = [];
        if (customDesignIds.length) {
          const { data: designs, error: designError } = await service
            .from("custom_designs")
            .select("id,render_status,locked_hash,customer_approved_at,production_files,seasonal_artwork_id")
            .in("id", customDesignIds);
          if (designError) throw designError;
          readyDesignIds = (designs || [])
            .filter((design: any) => Boolean(design.seasonal_artwork_id) || (
              design.render_status === "locked" &&
              design.customer_approved_at &&
              /^[0-9a-f]{64}$/.test(String(design.locked_hash || "")) &&
              design.production_files &&
              Object.keys(design.production_files).length > 0
            ))
            .map((design: any) => design.id);
          productionReady = readyDesignIds.length === customDesignIds.length;
        }
        const nextStatus = matchedMode === "test" ? "paid" : hasCustom ? (productionReady ? "production_queue" : "artwork_needed") : "paid";

        const { error } = await service
          .from("orders")
          .update({
            payment_status: "paid",
            status: nextStatus,
            design_status: matchedMode === "test" ? "not_required" : hasCustom ? (productionReady ? "approved" : "artwork_needed") : "not_required",
            production_status: matchedMode === "test" ? "not_started" : productionReady ? "queued" : "not_started",
            fulfillment_status: "unfulfilled",
            stripe_payment_intent_id: session.payment_intent || null,
          })
          .eq("id", orderId);
        if (error) throw error;

        if (matchedMode === "live" && productionReady && readyDesignIds.length) {
          await service
            .from("custom_designs")
            .update({ status: "in_production" })
            .in("id", readyDesignIds);
        } else if (matchedMode === "live" && hasCustom) {
          await service
            .from("design_proofs")
            .update({ status: "pending" })
            .eq("order_id", orderId)
            .eq("status", "pending");
        }

        // Allocate tracked variant inventory only after Stripe confirms payment.
        // The database RPC is idempotent per order item, so webhook retries do
        // not deduct stock twice.
        const { data: inventoryResult, error: inventoryError } = applyCommerceWorkflow
          ? await service.rpc("apply_paid_order_inventory", { p_order_id: orderId })
          : { data: { shortages: [] }, error: null };

        const shortages = Array.isArray(inventoryResult?.shortages)
          ? inventoryResult.shortages
          : [];

        const { error: couponError } = applyCommerceWorkflow
          ? await service.rpc("redeem_order_coupon", { p_order_id: orderId })
          : { error: null };
        if (couponError) {
          console.error("paid-order coupon redemption requires attention", couponError);
        }

        if (inventoryError || shortages.length) {
          console.error(
            "paid-order inventory allocation requires attention",
            inventoryError || shortages
          );

          const { data: currentOrder } = await service
            .from("orders")
            .select("notes")
            .eq("id", orderId)
            .maybeSingle();

          const detail = inventoryError
            ? inventoryError.message
            : `${shortages.length} paid line item(s) could not be allocated from an online-fulfillment location.`;
          const existingNotes = String(currentOrder?.notes || "").trim();
          const inventoryNote = `Inventory attention: ${detail}`;

          await service
            .from("orders")
            .update({
              priority: "due_soon",
              notes: existingNotes
                ? `${existingNotes}\n${inventoryNote}`
                : inventoryNote,
            })
            .eq("id", orderId);
        }
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const orderId = session?.metadata?.order_id;
      if (orderId) {
        await releaseCheckoutReservations(service, orderId, "expired");
        await service
          .from("orders")
          .update({
            payment_status: "failed",
            status: "payment_failed",
            fulfillment_status: "unfulfilled",
          })
          .eq("id", orderId)
          .eq("payment_status", "pending");
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const orderId = intent?.metadata?.order_id;
      if (orderId) {
        await releaseCheckoutReservations(service, orderId);
        await service
          .from("orders")
          .update({
            payment_status: "failed",
            status: "payment_failed",
            fulfillment_status: "unfulfilled",
            stripe_payment_intent_id: intent.id,
          })
          .eq("id", orderId);
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const paymentIntentId = charge?.payment_intent;
      if (paymentIntentId) {
        const fullyRefunded = Number(charge.amount_refunded || 0) >= Number(charge.amount || 0);
        await service
          .from("orders")
          .update({
            payment_status: fullyRefunded ? "refunded" : "partially_refunded",
            status: fullyRefunded ? "refunded" : "partially_refunded",
          })
          .eq("stripe_payment_intent_id", paymentIntentId);
      }
    }

    return respond({ received: true });
  } catch (error) {
    console.error("stripe webhook processing error", error);
    return respond({ error: error?.message || "Webhook processing failed." }, 500);
  }
});
