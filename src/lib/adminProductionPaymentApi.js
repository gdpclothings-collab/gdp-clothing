import { supabase } from "@/lib/supabaseClient";
import { enteringProduction, productionPaymentGate } from "@/lib/productionPaymentGate";

// Early admin feedback only; the database must independently reject an
// unauthorized transition within the same transaction as the order update.
export async function assertPaidLiveProductionEntry(orderId, nextProductionStatus) {
  if (!nextProductionStatus || nextProductionStatus === "not_started") return;

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, production_status, payment_status, payment_mode")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) throw new Error("Production order could not be found.");
  // Test orders remain QA-only even if an older workflow already queued one.
  if (order.payment_mode === "test" && nextProductionStatus !== order.production_status) {
    throw new Error("QA Only: Stripe test orders cannot advance in production.");
  }
  if (!enteringProduction(order.production_status, nextProductionStatus)) return;

  const gate = productionPaymentGate(order);
  if (!gate.canRelease) throw new Error(`${gate.label}: ${gate.detail}.`);
}
