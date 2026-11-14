import { verifyWelcomePaymentBinding } from "./welcome-payment-binding.mjs";

// Supplement the signature-verified order/session/intent binding with the
// authoritative server-stored amount and CAD currency for ordinary orders.
// No Stripe event metadata may independently authorize an arbitrary order.
export function verifyStandardPaymentBinding({ event, order, signatureVerified = false }) {
  const binding = verifyWelcomePaymentBinding({ event, order, signatureVerified });
  if (!binding.verified) return binding;

  const expectedAmount = Math.round(Number(order.total) * 100);
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 50) {
    return { verified: false, reason: "invalid_order_total" };
  }
  const obj = event.data?.object;
  const actualAmount = event.type === "payment_intent.succeeded"
    ? obj?.amount_received
    : obj?.amount_total;
  if (String(obj?.currency || "").toLowerCase() !== "cad" ||
      !Number.isSafeInteger(actualAmount) || actualAmount !== expectedAmount) {
    return { verified: false, reason: "amount_or_currency_mismatch" };
  }
  return binding;
}
