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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) return respond({ error: "Stripe webhook is not configured." }, 503);

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  if (!(await verifyStripeSignature(rawBody, signature, webhookSecret))) {
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
        const { data: items, error: itemError } = await service
          .from("order_items")
          .select("is_custom")
          .eq("order_id", orderId);
        if (itemError) throw itemError;

        const hasCustom = (items || []).some((item: any) => item.is_custom);
        const nextStatus = hasCustom ? "artwork_needed" : "paid";

        const { error } = await service
          .from("orders")
          .update({
            payment_status: "paid",
            status: nextStatus,
            fulfillment_status: nextStatus,
            stripe_payment_intent_id: session.payment_intent || null,
          })
          .eq("id", orderId);
        if (error) throw error;

        if (hasCustom) {
          await service
            .from("design_proofs")
            .update({ status: "pending" })
            .eq("order_id", orderId)
            .eq("status", "pending");
        }

        // Allocate tracked variant inventory only after Stripe confirms payment.
        // The database RPC is idempotent per order item, so webhook retries do
        // not deduct stock twice.
        const { data: inventoryResult, error: inventoryError } = await service.rpc(
          "apply_paid_order_inventory",
          { p_order_id: orderId }
        );

        const shortages = Array.isArray(inventoryResult?.shortages)
          ? inventoryResult.shortages
          : [];

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
        await service
          .from("orders")
          .update({
            payment_status: "failed",
            status: "payment_failed",
            fulfillment_status: "payment_failed",
          })
          .eq("id", orderId)
          .eq("payment_status", "pending");
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object;
      const orderId = intent?.metadata?.order_id;
      if (orderId) {
        await service
          .from("orders")
          .update({
            payment_status: "failed",
            status: "payment_failed",
            fulfillment_status: "payment_failed",
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
