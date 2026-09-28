import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

const checkoutPath = 'supabase/functions/checkout/index.ts';
let checkout = fs.readFileSync(checkoutPath, 'utf8');

checkout = replaceOnce(
  checkout,
  '.select("id,design_id,token_hash,expires_at,converted_at")\n          .in("design_id", guestDesignIds);',
  '.select("id,design_id,token_hash,expires_at,converted_order_id,converted_at")\n          .in("design_id", guestDesignIds);',
  'guest checkout session selection',
);

checkout = replaceOnce(
  checkout,
  '          .update({\n            converted_order_id: order.id,\n            converted_at: convertedAt,\n            updated_at: convertedAt,\n          })',
  '          .update({\n            // Reserve the guest design for this pending payment, but do not\n            // permanently consume it until Stripe confirms payment.\n            converted_order_id: order.id,\n            converted_at: null,\n            updated_at: convertedAt,\n          })',
  'guest design pending reservation',
);

checkout = replaceOnce(
  checkout,
  '      await service\n        .from("custom_designs")\n        .update({ order_id: order.id, status: "ordered", ...(user && !design.user_id ? { user_id: user.id } : {}) })\n        .eq("id", design.id);\n\n      if (design.proof_required !== false) {',
  '      // Guest designs stay in_cart while payment is pending. The Stripe\n      // webhook performs the permanent order/status transition after payment.\n      if (!guestDesignSessions.has(design.id)) {\n        await service\n          .from("custom_designs")\n          .update({ order_id: order.id, status: "ordered", ...(user && !design.user_id ? { user_id: user.id } : {}) })\n          .eq("id", design.id);\n      }\n\n      if (!guestDesignSessions.has(design.id) && design.proof_required !== false) {',
  'guest design permanent transition',
);

checkout = replaceOnce(
  checkout,
  '    if (!stripeSecret || !stripePublishableKey) {\n      await releaseCheckoutReservations(service, order.id);',
  '    if (!stripeSecret || !stripePublishableKey) {\n      await releaseCheckoutReservations(service, order.id);\n      await releaseGuestDesignClaims(service, order.id);',
  'missing Stripe config guest release',
);

checkout = replaceOnce(
  checkout,
  '          .update({\n            status: "converted",\n            converted_order_id: order.id,\n            last_activity_at: new Date().toISOString(),\n          })',
  '          .update({\n            status: "active",\n            converted_order_id: null,\n            last_activity_at: new Date().toISOString(),\n          })',
  'missing Stripe config checkout reset',
);

checkout = replaceOnce(
  checkout,
  '        .update({\n          status: "converted",\n          converted_order_id: order.id,\n          last_activity_at: new Date().toISOString(),\n        })',
  '        .update({\n          // A Stripe session is only pending payment; conversion is finalized\n          // by the verified Stripe webhook after successful payment.\n          status: "active",\n          converted_order_id: order.id,\n          stripe_checkout_session_id: stripeData.id,\n          stripe_client_secret: stripeData.client_secret,\n          last_activity_at: new Date().toISOString(),\n        })',
  'checkout pending session state',
);

fs.writeFileSync(checkoutPath, checkout);

const webhookPath = 'supabase/functions/stripe-webhook/index.ts';
let webhook = fs.readFileSync(webhookPath, 'utf8');

webhook = replaceOnce(
  webhook,
  '        const nextStatus = matchedMode === "test" ? "paid" : hasCustom ? (productionReady ? "production_queue" : "artwork_needed") : "paid";\n\n        const { error } = await service',
  '        const nextStatus = matchedMode === "test" ? "paid" : hasCustom ? (productionReady ? "production_queue" : "artwork_needed") : "paid";\n\n        // Finalize guest custom designs only after Stripe has confirmed payment.\n        // The converted_order_id predicate prevents an older abandoned/retried\n        // checkout from consuming a design currently reserved by a newer one.\n        if (customDesignIds.length) {\n          const paidAt = new Date().toISOString();\n          const { data: finalizedGuestSessions, error: guestFinalizeError } = await service\n            .from("guest_design_sessions")\n            .update({ converted_at: paidAt, updated_at: paidAt })\n            .eq("converted_order_id", orderId)\n            .is("converted_at", null)\n            .select("design_id");\n          if (guestFinalizeError) throw guestFinalizeError;\n\n          const finalizedGuestIds = (finalizedGuestSessions || []).map((row: any) => row.design_id);\n          if (finalizedGuestIds.length) {\n            const { error: guestDesignError } = await service\n              .from("custom_designs")\n              .update({ order_id: orderId, status: "ordered" })\n              .in("id", finalizedGuestIds);\n            if (guestDesignError) throw guestDesignError;\n          }\n        }\n\n        const { error } = await service',
  'paid guest design finalization',
);

webhook = replaceOnce(
  webhook,
  '        const { error: checkoutCleanupError } = await service\n          .from("checkout_sessions")\n          .update({ stripe_client_secret: null, processing_started_at: null, last_activity_at: new Date().toISOString() })',
  '        const { error: checkoutCleanupError } = await service\n          .from("checkout_sessions")\n          .update({\n            status: "converted",\n            stripe_client_secret: null,\n            processing_started_at: null,\n            last_activity_at: new Date().toISOString(),\n          })',
  'paid checkout session finalization',
);

fs.writeFileSync(webhookPath, webhook);

console.log('Applied targeted guest-design payment lifecycle repair.');
