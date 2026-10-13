import { createClient } from "npm:@supabase/supabase-js@2";
import { handleStripeDispute } from "./disputes.ts";
import { verifyWelcomePaymentBinding } from "./welcome-payment-binding.mjs";
import { checkWelcomePaidOrderReservation } from "./welcome-redemption-preflight.mjs";
import { redeemWelcomeOrder } from "./welcome-redemption-adapter.mjs";
import { recordWelcomeReconciliation } from "./welcome-reconciliation.mjs";

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
    service.rpc("release_order_inventory_reservations", { p_order_id: orderId, p_status: status }),
    service.rpc("release_order_coupon_reservation", { p_order_id: orderId, p_status: status }),
  ]);
  if (inventory.error) console.error("inventory reservation release failed", inventory.error);
  if (coupon.error) console.error("coupon reservation release failed", coupon.error);
}

async function resetUnpaidCustomOrderState(service: any, orderId: string) {
  const { data: items, error: itemError } = await service
    .from("order_items")
    .select("custom_design_id")
    .eq("order_id", orderId)
    .eq("is_custom", true);
  if (itemError) throw itemError;

  const designIds = [...new Set((items || []).map((item: any) => item.custom_design_id).filter(Boolean))];
  if (designIds.length) {
    const { error: designError } = await service
      .from("custom_designs")
      .update({ order_id: null, status: "in_cart" })
      .in("id", designIds)
      .eq("order_id", orderId);
    if (designError) throw designError;
  }

  const { error: proofError } = await service
    .from("design_proofs")
    .delete()
    .eq("order_id", orderId)
    .eq("status", "pending");
  if (proofError) throw proofError;

  const now = new Date().toISOString();
  const { error: guestError } = await service
    .from("guest_design_sessions")
    .update({ converted_order_id: null, converted_at: null, updated_at: now })
    .eq("converted_order_id", orderId);
  if (guestError) throw guestError;

  const { error: checkoutError } = await service
    .from("checkout_sessions")
    .update({
      status: "active",
      converted_order_id: null,
      stripe_checkout_session_id: null,
      stripe_client_secret: null,
      processing_started_at: null,
      last_activity_at: now,
    })
    .eq("converted_order_id", orderId);
  if (checkoutError) throw checkoutError;
}

async function finalizePaidOrder(
  service: any,
  orderId: string,
  matchedMode: "live" | "test",
  paymentIntentId: string | null,
) {
  const { data: orderRecord, error: orderRecordError } = await service
    .from("orders")
    .select("payment_mode,test_inventory_workflow,discount_code")
    .eq("id", orderId)
    .maybeSingle();
  if (orderRecordError) throw orderRecordError;
  if (!orderRecord || orderRecord.payment_mode !== matchedMode) {
    throw new Error("Payment environment mismatch.");
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
      .map((item: any) => item.custom_design_id),
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

  const nextStatus = matchedMode === "test"
    ? "paid"
    : hasCustom
      ? (productionReady ? "production_queue" : "artwork_needed")
      : "paid";

  if (customDesignIds.length) {
    const paidAt = new Date().toISOString();
    const { data: finalizedGuestSessions, error: guestFinalizeError } = await service
      .from("guest_design_sessions")
      .update({ converted_at: paidAt, updated_at: paidAt })
      .eq("converted_order_id", orderId)
      .is("converted_at", null)
      .select("design_id");
    if (guestFinalizeError) throw guestFinalizeError;

    const finalizedGuestIds = (finalizedGuestSessions || []).map((row: any) => row.design_id);
    if (finalizedGuestIds.length) {
      const { error: guestDesignError } = await service
        .from("custom_designs")
        .update({ order_id: orderId, status: "ordered" })
        .in("id", finalizedGuestIds);
      if (guestDesignError) throw guestDesignError;
    }
  }

  const { error: orderUpdateError } = await service
    .from("orders")
    .update({
      payment_status: "paid",
      status: nextStatus,
      design_status: matchedMode === "test" ? "not_required" : hasCustom ? (productionReady ? "approved" : "artwork_needed") : "not_required",
      production_status: matchedMode === "test" ? "not_started" : productionReady ? "queued" : "not_started",
      fulfillment_status: "unfulfilled",
      stripe_payment_intent_id: paymentIntentId || null,
    })
    .eq("id", orderId);
  if (orderUpdateError) throw orderUpdateError;

  const { error: checkoutCleanupError } = await service
    .from("checkout_sessions")
    .update({
      status: "converted",
      stripe_client_secret: null,
      processing_started_at: null,
      last_activity_at: new Date().toISOString(),
    })
    .eq("converted_order_id", orderId);
  if (checkoutCleanupError) console.error("checkout secret cleanup failed", checkoutCleanupError);

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

  const { data: inventoryResult, error: inventoryError } = applyCommerceWorkflow
    ? await service.rpc("apply_paid_order_inventory", { p_order_id: orderId })
    : { data: { shortages: [] }, error: null };

  const shortages = Array.isArray(inventoryResult?.shortages) ? inventoryResult.shortages : [];

  // WELCOME10 may only use the dedicated verified-payment redemption path
  // below. The generic legacy coupon RPC must never process WELCOME10.
  const isWelcome = String(orderRecord.discount_code || "").trim().toUpperCase() === "WELCOME10";
  const { error: couponError } = applyCommerceWorkflow && !isWelcome
    ? await service.rpc("redeem_order_coupon", { p_order_id: orderId })
    : { error: null };
  if (couponError) console.error("paid-order coupon redemption requires attention", couponError);

  if (inventoryError || shortages.length) {
    console.error("paid-order inventory allocation requires attention", inventoryError || shortages);

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
        notes: existingNotes ? `${existingNotes}\n${inventoryNote}` : inventoryNote,
      })
      .eq("id", orderId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const liveWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const testWebhookSecret = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET");
  if (!liveWebhookSecret && !testWebhookSecret) return respond({ error: "Stripe webhook is not configured." }, 503);

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return respond({ error: "Invalid JSON." }, 400);
  }

  if (typeof event?.livemode !== "boolean") return respond({ error: "Stripe event mode is missing." }, 400);

  const matchedMode: "live" | "test" = event.livemode ? "live" : "test";
  const webhookSecret = matchedMode === "live" ? liveWebhookSecret : testWebhookSecret;
  if (!webhookSecret) return respond({ error: `Stripe ${matchedMode} webhook is not configured.` }, 503);

  if (!await verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return respond({ error: "Invalid Stripe signature." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      event.type === "payment_intent.succeeded"
    ) {
      const paymentObject = event.data.object;
      const isPaymentIntent = event.type === "payment_intent.succeeded";
      const orderId = paymentObject?.metadata?.order_id;

      if (!isPaymentIntent && paymentObject?.payment_status !== "paid") {
        return respond({ received: true, payment_pending: true });
      }

      if (orderId) {
        const paymentIntentId = isPaymentIntent
          ? String(paymentObject.id || "") || null
          : String(paymentObject.payment_intent || "") || null;
        const { data: existing, error: lookupError } = await service.from("orders")
          .select("id,discount_code,payment_mode,payment_status,stripe_checkout_session_id,stripe_payment_intent_id,test_inventory_workflow")
          .eq("id", String(orderId)).maybeSingle();
        if (lookupError) throw lookupError;
        const welcome = String(existing?.discount_code || "").trim().toUpperCase() === "WELCOME10";
        if (welcome) {
          if (Deno.env.get("WELCOME10_PROMO_ENABLED") !== "true") {
            throw new Error("WELCOME10 paid order encountered while integration is disabled.");
          }
          const binding = verifyWelcomePaymentBinding({ event, order: existing, signatureVerified: true });
          if (!binding.verified && binding.reason === "checkout_session_confirmation_required") {
            // A standalone PaymentIntent event may precede checkout.session.completed.
            // Never finalize an unlinked WELCOME10 PaymentIntent based on metadata.
            return respond({ received: true, awaiting_checkout_session: true });
          }
          if (!binding.verified || !paymentIntentId ||
              paymentIntentId !== binding.paymentIntentId) {
            throw new Error("WELCOME10 verified payment binding failed.");
          }
          await finalizePaidOrder(service, String(orderId), matchedMode, paymentIntentId);
          const { data: paidOrder, error: paidError } = await service.from("orders")
            .select("id,discount_code,payment_status,payment_mode,stripe_payment_intent_id")
            .eq("id", String(orderId)).maybeSingle();
          if (paidError || !paidOrder || paidOrder.payment_status !== "paid" ||
              paidOrder.stripe_payment_intent_id !== binding.paymentIntentId) {
            throw new Error("WELCOME10 persisted payment could not be verified.");
          }
          const preflight = await checkWelcomePaidOrderReservation({ service, order: paidOrder });
          const redemption = preflight.ok
            ? await redeemWelcomeOrder({
                service, orderId: String(orderId), order: paidOrder,
                signedStripeEventVerified: true, paymentLinkVerified: true,
                integrationEnabled: true,
                signedPaidAt: Number.isFinite(Number(event.created)) && Number(event.created) > 0
                  ? new Date(Number(event.created) * 1000).toISOString() : null,
              })
            : { redeemed: false, reason: preflight.reason };
          if (!redemption.redeemed) {
            const journal = await recordWelcomeReconciliation({
              service, orderId: String(orderId),
              eventId: binding.eventId, paymentIntentId: binding.paymentIntentId,
              paymentMode: matchedMode, reason: redemption.reason || "redemption_failed",
              verifiedPaymentBinding: true, integrationEnabled: true,
            });
            console.error("WELCOME10 paid order needs reconciliation", {
              orderId, recorded: journal.recorded, reason: redemption.reason,
            });
            // Return 5xx to retain Stripe's retry mechanism as an additional safety net.
            throw new Error("WELCOME10 redemption requires reconciliation.");
          }
          const { error: resolveError } = await service.rpc("resolve_welcome10_reconciliation", {
            p_order_id: String(orderId),
            p_payment_intent_id: binding.paymentIntentId,
          });
          if (resolveError) {
            // Redemption itself has already committed. Never redeem a second time
            // because a separate reconciliation status update failed.
            console.error("WELCOME10 reconciliation resolution requires attention", resolveError);
          }
        } else {
          await finalizePaidOrder(service, String(orderId), matchedMode, paymentIntentId);
        }
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const orderId = session?.metadata?.order_id;
      if (orderId) {
        await releaseCheckoutReservations(service, orderId, "expired");
        await resetUnpaidCustomOrderState(service, orderId);
        await service
          .from("orders")
          .update({ payment_status: "failed", status: "payment_failed", fulfillment_status: "unfulfilled" })
          .eq("id", orderId)
          .eq("payment_status", "pending");
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const orderId = session?.metadata?.order_id;
      if (orderId) {
        await releaseCheckoutReservations(service, orderId);
        await resetUnpaidCustomOrderState(service, orderId);
        await service
          .from("orders")
          .update({
            payment_status: "failed",
            status: "payment_failed",
            fulfillment_status: "unfulfilled",
            stripe_payment_intent_id: session.payment_intent || null,
          })
          .eq("id", orderId);
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const orderId = intent?.metadata?.order_id;
      if (orderId) {
        // Both legacy Checkout-backed and Michaels-style direct PaymentIntent
        // failures remain retryable until the checkout itself is abandoned.
        await service
          .from("orders")
          .update({
            payment_status: "pending",
            status: "pending_payment",
            fulfillment_status: "unfulfilled",
            stripe_payment_intent_id: intent.id,
          })
          .eq("id", orderId)
          .eq("payment_status", "pending");
      }
    }

    if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.updated" ||
      event.type === "charge.dispute.closed" ||
      event.type === "charge.dispute.funds_withdrawn" ||
      event.type === "charge.dispute.funds_reinstated"
    ) {
      await handleStripeDispute(service, event, matchedMode);
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
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return respond({ error: message }, message === "Payment environment mismatch." ? 409 : 500);
  }
});
