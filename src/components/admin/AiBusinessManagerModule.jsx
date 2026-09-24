import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, Boxes, CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import { aiBusinessManagerApi } from "@/lib/aiBusinessManagerApi";

function Metric({ label, value }) {
  return <div className="rounded-xl border border-[#dedfe3] bg-white p-4"><div className="text-xs font-bold uppercase tracking-wide text-[#70737a]">{label}</div><div className="mt-1 text-2xl font-bold tabular-nums">{value}</div></div>;
}

export default function AiBusinessManagerModule() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError("");
    try { setSnapshot(await aiBusinessManagerApi.loadSummary()); }
    catch (err) { setError(err?.message || "Could not load Business Manager."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const s = snapshot?.summary || {};
  const attention = useMemo(() => {
    const items = [];
    if (Number(s.failedPayments) > 0) items.push({ icon: CreditCard, text: `${s.failedPayments} payment attempt(s) are recorded as failed. Review only; no payment action is taken.` });
    if (Number(s.outOfStockLocations) > 0) items.push({ icon: Boxes, text: `${s.outOfStockLocations} inventory location record(s) have zero available stock.` });
    if (Number(s.lowStockLocations) > 0) items.push({ icon: AlertTriangle, text: `${s.lowStockLocations} inventory location record(s) have 1–5 units available.` });
    if (!items.length) items.push({ icon: ShieldCheck, text: "No summary-level attention items detected." });
    return items;
  }, [s.failedPayments, s.outOfStockLocations, s.lowStockLocations]);

  return <main className="max-w-[1600px] mx-auto px-4 md:px-7 lg:px-10 py-6 space-y-5">
    <div className="rounded-2xl border border-[#dedfe3] bg-white p-5 flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
      <div><div className="flex items-center gap-2 font-bold"><Bot size={20}/> AI Business Manager</div><p className="mt-1 text-sm text-[#60636a]">Phase 1 is strictly read-only. It summarizes business signals and cannot change orders, inventory, prices, payments, customers, email, or deployments.</p></div>
      <button onClick={load} disabled={loading} className="h-10 px-4 rounded-lg border border-[#d6d8dd] bg-white hover:bg-[#f7f7f8] disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm font-semibold"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Refresh</button>
    </div>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="Orders" value={s.orders ?? "—"}/><Metric label="Paid orders" value={s.paidOrders ?? "—"}/><Metric label="Products" value={s.products ?? "—"}/><Metric label="Variants" value={s.variants ?? "—"}/><Metric label="Available units" value={s.inventoryAvailable ?? "—"}/><Metric label="Committed units" value={s.inventoryCommitted ?? "—"}/><Metric label="Sales leads" value={s.salesLeads ?? "—"}/><Metric label="Support tickets" value={s.supportTickets ?? "—"}/></div>
    <section className="rounded-2xl border border-[#dedfe3] bg-white p-5"><h2 className="font-bold">What needs my attention?</h2><div className="mt-3 space-y-2">{attention.map(({icon: Icon,text}, i)=><div key={i} className="flex gap-3 rounded-xl bg-[#f6f7f8] p-3 text-sm"><Icon size={18} className="mt-0.5 shrink-0"/><span>{text}</span></div>)}</div></section>
    <div className="text-xs text-[#777b82]">Security mode: admin-only · JWT required · no customer PII returned · no write actions.</div>
  </main>;
}
