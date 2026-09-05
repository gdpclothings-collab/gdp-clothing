import React, { useEffect, useState } from "react";
import {
  WalletCards,
  CircleDollarSign,
  BadgePercent,
  ReceiptText,
  Truck,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { adminFinanceApi } from "@/lib/adminFinanceApi";

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function FinanceModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminFinanceApi.load());
    } catch (err) {
      console.error("Finance module load failed:", err);
      setError(err?.message || "Could not load finance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const metrics = data?.metrics || {};

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="text-xs text-[#777]">
          Order-led financial view. Stripe processor fees and payout settlement remain in Stripe.
        </div>
        <button onClick={load} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <MetricCard label="Paid revenue" value={loading ? "—" : money(metrics.paidRevenue)} icon={CircleDollarSign} />
        <MetricCard label="Gross sales" value={loading ? "—" : money(metrics.grossSales)} icon={WalletCards} />
        <MetricCard label="Discounts" value={loading ? "—" : money(metrics.discounts)} icon={BadgePercent} />
        <MetricCard label="Tax collected" value={loading ? "—" : money(metrics.taxCollected)} icon={ReceiptText} />
        <MetricCard label="Shipping" value={loading ? "—" : money(metrics.shippingCollected)} icon={Truck} />
        <MetricCard label="Refund orders" value={loading ? "—" : metrics.refundOrders ?? 0} icon={RotateCcw} />
      </div>

      <section className="mt-6 rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e8e8e8]">
          <div className="text-sm font-semibold">Transactions</div>
          <div className="text-xs text-[#777] mt-0.5">Latest GDP order payment records</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Payment</Th>
                <Th>Order status</Th>
                <Th right>Subtotal</Th>
                <Th right>Tax</Th>
                <Th right>Total</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="py-12 text-center text-[#777]">Loading transactions…</td></tr>
              ) : (data?.transactions || []).length ? (
                data.transactions.map((order) => (
                  <tr key={order.id} className="border-t border-[#eeeeee]">
                    <Td><span className="font-semibold">{order.order_number}</span></Td>
                    <Td>
                      <div>{order.customer_name || "Guest"}</div>
                      <div className="text-[11px] text-[#777]">{order.customer_email}</div>
                    </Td>
                    <Td><Status value={order.payment_status} /></Td>
                    <Td><span className="capitalize">{String(order.status || "").replaceAll("_", " ")}</span></Td>
                    <Td right>{money(order.subtotal)}</Td>
                    <Td right>{money(order.tax)}</Td>
                    <Td right><span className="font-semibold">{money(order.total)}</span></Td>
                    <Td>{formatDate(order.created_at)}</Td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="8" className="py-12 text-center text-[#777]">No transactions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#777]">{label}</div>
        <Icon size={16} className="text-[#777]" />
      </div>
      <div className="text-xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function Status({ value }) {
  const normalized = String(value || "pending");
  const cls =
    normalized === "paid"
      ? "bg-emerald-100 text-emerald-800"
      : normalized.includes("refund")
        ? "bg-amber-100 text-amber-800"
        : normalized === "failed"
          ? "bg-red-100 text-red-700"
          : "bg-[#eeeeee] text-[#555]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${cls}`}>{normalized.replaceAll("_", " ")}</span>;
}

function Th({ children, right }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}
