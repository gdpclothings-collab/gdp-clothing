import test from "node:test";
import assert from "node:assert/strict";
import { verifyWelcomePaymentBinding as verify } from "../supabase/functions/stripe-webhook/welcome-payment-binding.mjs";

const pending = { id: "order-1", payment_mode: "test", payment_status: "pending", stripe_payment_intent_id: null, stripe_checkout_session_id: "cs_1" };
const event = { id: "evt_1", type: "checkout.session.completed", livemode: false,
  data: { object: { id: "cs_1", payment_intent: "pi_1", payment_status: "paid",
    metadata: { order_id: "order-1", payment_mode: "test" } } } };

test("first signed paid session binds to stored Checkout session before intent is saved", () => {
  const result = verify({ event, order: pending, signatureVerified: true });
  assert.deepEqual(result, { verified: true, paymentIntentId: "pi_1", eventId: "evt_1" });
});
test("unsigned event fails closed", () => assert.equal(verify({ event, order: pending }).verified, false));
test("wrong order is rejected", () => assert.equal(verify({ event, order: {...pending,id:"wrong"}, signatureVerified:true }).verified,false));
test("wrong environment is rejected", () => assert.equal(verify({ event, order: {...pending,payment_mode:"live"}, signatureVerified:true }).verified,false));
test("wrong metadata mode is rejected", () => assert.equal(verify({ event: {...event,data:{object:{...event.data.object,metadata:{...event.data.object.metadata,payment_mode:"live"}}}},order:pending,signatureVerified:true }).verified,false));
test("wrong persisted session is rejected", () => assert.equal(verify({ event,order:{...pending,stripe_checkout_session_id:"cs_wrong"},signatureVerified:true }).verified,false));
test("changed persisted intent is rejected", () => assert.equal(verify({ event,order:{...pending,stripe_payment_intent_id:"pi_wrong"},signatureVerified:true }).verified,false));
test("unpaid checkout event is rejected", () => assert.equal(verify({ event:{...event,data:{object:{...event.data.object,payment_status:"unpaid"}}},order:pending,signatureVerified:true }).verified,false));
test("unlinked payment intent event is not sufficient", () => assert.equal(verify({ event:{id:"evt_pi",type:"payment_intent.succeeded",livemode:false,data:{object:{id:"pi_1",metadata:{order_id:"order-1",payment_mode:"test"}}}},order:pending,signatureVerified:true }).reason,"checkout_session_confirmation_required"));
test("known paid intent may be retried", () => assert.equal(verify({ event:{id:"evt_pi",type:"payment_intent.succeeded",livemode:false,data:{object:{id:"pi_1",metadata:{order_id:"order-1",payment_mode:"test"}}}},order:{...pending,payment_status:"paid",stripe_payment_intent_id:"pi_1"},signatureVerified:true }).verified,true));
test("unsupported Stripe event is rejected", () => assert.equal(verify({event:{...event,type:"charge.refunded"},order:pending,signatureVerified:true}).verified,false));
