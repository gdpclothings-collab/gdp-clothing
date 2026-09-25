import React, { useEffect, useState } from "react";
import { Trash2, X, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { adminOrdersApi } from "@/lib/adminOrdersApi";

const ELIGIBLE_STATUSES = new Set(["draft", "pending_payment", "payment_failed", "cancelled"]);
const ELIGIBLE_PAYMENTS = new Set(["pending", "failed"]);

function canOfferDelete(order) {
  const payment = String(order.payment_status || "").toLowerCase();
  const status = String(order.status || "").toLowerCase();
  const fulfillment = String(order.fulfillment_status || "").toLowerCase();
  if (["paid", "refunded", "partially_refunded"].includes(payment)) return false;
  if (["fulfilled", "shipped", "out_for_delivery", "delivered", "picked_up"].includes(fulfillment)) return false;
  if (["completed", "fulfilled", "shipped", "delivered"].includes(status)) return false;
  return order.payment_mode === "test" || ELIGIBLE_STATUSES.has(status) || ELIGIBLE_PAYMENTS.has(payment);
}

export default function OrderCleanupControl() {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  const isAdminArea = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  const load = async () => {
    if (!isAdminArea) return;
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, payment_status, payment_mode, fulfillment_status, total, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setMessage(error.message || "Could not load cleanup candidates.");
    else setOrders((data || []).filter(canOfferDelete));
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!isAdminArea) return null;

  const remove = async (order) => {
    const ok = window.confirm(
      `Permanently delete ${order.order_number}?\n\nOnly test/failed/unpaid orders are allowed. Paid, refunded, fulfilled and completed orders are protected by the server and cannot be deleted.`
    );
    if (!ok) return;
    setBusyId(order.id);
    setMessage("");
    try {
      await adminOrdersApi.deleteTestOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setMessage(`${order.order_number} was permanently deleted.`);
    } catch (error) {
      setMessage(error?.message || "Delete was rejected. The order may be protected.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[65] rounded-full bg-[#202020] px-4 py-3 text-xs font-semibold text-white shadow-xl hover:bg-black inline-flex items-center gap-2"
      >
        <Trash2 size={15} /> Test order cleanup
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/40 p-4 grid place-items-center" onMouseDown={() => setOpen(false)}>
          <section className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">Test & failed order cleanup</h2>
                <p className="mt-1 text-xs text-[#777]">Permanent delete is server-guarded. Successful commerce records remain protected.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-[#f3f3f3]" aria-label="Close cleanup"><X size={18} /></button>
            </header>

            <div className="flex items-center justify-between gap-3 border-b bg-[#fafafa] px-5 py-3">
              <span className="text-xs text-[#666]">{orders.length} eligible cleanup candidate(s)</span>
              <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs disabled:opacity-50"><RefreshCw size={13} /> {loading ? "Refreshing…" : "Refresh"}</button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-4 space-y-2">
              {message && <div className="rounded-lg border bg-[#fafafa] px-3 py-2 text-xs">{message}</div>}
              {loading && orders.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#777]">Loading cleanup candidates…</div>
              ) : orders.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#777]">No eligible test, failed or unpaid orders found.</div>
              ) : orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-4 rounded-xl border p-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{order.order_number}</div>
                    <div className="mt-1 text-[11px] text-[#777] capitalize">{String(order.payment_mode || "live")} · {String(order.status || "").replaceAll("_", " ")} · payment {String(order.payment_status || "unknown").replaceAll("_", " ")}</div>
                  </div>
                  <button type="button" onClick={() => remove(order)} disabled={busyId === order.id} className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-2"><Trash2 size={13} /> {busyId === order.id ? "Deleting…" : "Delete"}</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
