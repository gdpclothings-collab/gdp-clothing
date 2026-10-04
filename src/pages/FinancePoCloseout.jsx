import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, FileText, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { adminPoCloseoutApi } from "@/lib/adminPoCloseoutApi";

const money = (value) => Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const qty = (value) => Number(value || 0).toLocaleString("en-CA", { maximumFractionDigits: 3 });
const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Regina", year: "numeric", month: "short", day: "numeric" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00-06:00`)) : "—";
const dateTimeLabel = (value) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Regina", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";

export default function FinancePoCloseout() {
  const [data, setData] = useState({ summary: {}, purchaseOrders: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [matchedNotes, setMatchedNotes] = useState({});
  const [exceptionReasons, setExceptionReasons] = useState({});
  const [reopenReasons, setReopenReasons] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    try { setData(await adminPoCloseoutApi.load({ limit: 1000 })); }
    catch (err) { console.error("PO closeout load failed:", err); setError(err?.message || "Could not load PO closeout data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const purchaseOrders = Array.isArray(data.purchaseOrders) ? data.purchaseOrders : [];
  const approved = useMemo(() => purchaseOrders.filter((po) => po.status === "approved"), [purchaseOrders]);
  const ready = useMemo(() => approved.filter((po) => po.close_readiness === "matched"), [approved]);
  const exceptions = useMemo(() => approved.filter((po) => po.close_readiness === "exception"), [approved]);
  const closed = useMemo(() => purchaseOrders.filter((po) => po.status === "closed"), [purchaseOrders]);
  const summary = data.summary || {};

  const run = async (key, action, success) => {
    setSaving(key);
    setError("");
    setNotice("");
    try { await action(); setNotice(success); await load(); return true; }
    catch (err) { setError(err?.message || "PO closeout action failed."); return false; }
    finally { setSaving(""); }
  };

  const closeMatched = async (po) => {
    const ok = await run(`close-${po.id}`, () => adminPoCloseoutApi.closeMatched(po.id, matchedNotes[po.id] || ""), `${po.po_number} closed as fully matched. No financial or inventory transaction was created by closeout.`);
    if (ok) setMatchedNotes((current) => ({ ...current, [po.id]: "" }));
  };

  const closeException = async (po) => {
    const reason = exceptionReasons[po.id] || "";
    const ok = await run(`close-${po.id}`, () => adminPoCloseoutApi.closeException(po.id, reason), `${po.po_number} exception-closed with a frozen reconciliation snapshot.`);
    if (ok) setExceptionReasons((current) => ({ ...current, [po.id]: "" }));
  };

  const reopen = async (po) => {
    const reason = reopenReasons[po.id] || "";
    const ok = await run(`reopen-${po.id}`, () => adminPoCloseoutApi.reopen(po.id, reason), `${po.po_number} reopened to Approved. Receiving and PO-linked bill controls are active again.`);
    if (ok) setReopenReasons((current) => ({ ...current, [po.id]: "" }));
  };

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm"><div className="h-full px-3 md:px-5 flex items-center gap-3">
      <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
      <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><ClipboardCheck size={16}/> PO Closeout</div>
      <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
    </div></header>

    <div className="border-b border-[#dedfe3] bg-white"><div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
      <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 18</div>
      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">PO Closeout &amp; Variance Controls</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Close completed purchase orders only after receiving and supplier billing are reconciled, or preserve a documented exception when they are not.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button><Link to="/admin/finance/receiving" className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2"><FileText size={14}/> Receiving</Link><Link to="/admin/finance/purchasing" className="h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2"><FileText size={14}/> Purchasing</Link></div></div>
    </div></div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Closeout is a control, not a transaction</div><div className="mt-1 text-xs">Closing a PO does not create an expense, payment, tax entry, bank movement or inventory adjustment. It freezes new receiving and PO-linked bills. Reopen requires a reason and returns the PO to Approved. Matched close requires full receiving plus live bills within $0.01 of the PO total.</div></div></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3"><Metric label="Approved POs" value={loading ? "—" : String(summary.approvedCount || 0)}/><Metric label="Ready to close" value={loading ? "—" : String(summary.closeReadyCount || 0)} good/><Metric label="Need exception" value={loading ? "—" : String(summary.closeExceptionCount || 0)} warn={Number(summary.closeExceptionCount || 0) > 0}/><Metric label="Closed matched" value={loading ? "—" : String(summary.closedMatchedCount || 0)}/><Metric label="Closed exceptions" value={loading ? "—" : String(summary.closedExceptionCount || 0)} warn={Number(summary.closedExceptionCount || 0) > 0}/></div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-700"/> Matched close</div><div className="text-xs text-[#777] mt-0.5">All PO lines are fully received and non-voided supplier bills match the PO total within $0.01.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>PO</Th><Th>Supplier</Th><Th>Receiving</Th><Th>Billing</Th><Th right>Variance</Th><Th>Action</Th></tr></thead><tbody>{ready.length ? ready.map((po) => <tr key={po.id} className="border-t border-[#eee] align-top"><Td><div className="font-semibold">{po.po_number}</div><div className="text-xs text-[#777]">{dateLabel(po.order_date)}</div></Td><Td>{po.supplier_name}</Td><Td><div className="font-medium">{qty(po.received_quantity)} / {qty(po.ordered_quantity)}</div><Badge value={po.receiving_status}/></Td><Td><div className="font-medium">{money(po.billed_total)} / {money(po.total)}</div><div className="text-xs text-[#777]">{po.linked_bill_count || 0} live bill{Number(po.linked_bill_count || 0) === 1 ? "" : "s"}</div></Td><Td right strong>{money(po.bill_variance)}</Td><Td><div className="flex gap-1 min-w-[310px]"><input className="h-8 flex-1 rounded-md border border-[#d5d5d5] px-2 text-xs" value={matchedNotes[po.id] || ""} onChange={(e) => setMatchedNotes((current) => ({ ...current, [po.id]: e.target.value }))} placeholder="Optional close note"/><button type="button" onClick={() => closeMatched(po)} disabled={saving === `close-${po.id}`} className="h-8 px-3 rounded-md bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40">Close matched</button></div></Td></tr>) : <Empty cols={6}>{loading ? "Loading matched purchase orders…" : "No approved purchase order is fully matched yet."}</Empty>}</tbody></table></div></section>

      <section className="rounded-xl border border-amber-200 bg-white overflow-hidden"><div className="px-4 py-3 border-b border-amber-100 bg-amber-50"><div className="text-sm font-semibold flex items-center gap-2 text-amber-950"><AlertTriangle size={16}/> Exception close</div><div className="text-xs text-amber-900/75 mt-0.5">Use only when you intentionally accept a shortage, missing/extra bill, or amount variance. A reason is mandatory and the reconciliation snapshot is frozen in audit history.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-sm"><thead className="bg-[#fffdf7] text-[#707070] text-xs"><tr><Th>PO</Th><Th>Supplier</Th><Th>Receiving</Th><Th>Billing</Th><Th right>Variance</Th><Th>Reason / Action</Th></tr></thead><tbody>{exceptions.length ? exceptions.map((po) => <tr key={po.id} className="border-t border-amber-100 align-top"><Td><div className="font-semibold">{po.po_number}</div><div className="text-xs text-[#777]">{dateLabel(po.order_date)}</div></Td><Td>{po.supplier_name}</Td><Td><div className="font-medium">{qty(po.received_quantity)} / {qty(po.ordered_quantity)}</div><div className="text-xs text-[#777]">{po.short_line_count || 0} short line{Number(po.short_line_count || 0) === 1 ? "" : "s"}</div></Td><Td><div className="font-medium">{money(po.billed_total)} / {money(po.total)}</div><Badge value={po.bill_match_status}/></Td><Td right strong>{money(po.bill_variance)}</Td><Td><div className="flex gap-1 min-w-[360px]"><input className="h-8 flex-1 rounded-md border border-amber-300 px-2 text-xs" value={exceptionReasons[po.id] || ""} onChange={(e) => setExceptionReasons((current) => ({ ...current, [po.id]: e.target.value }))} placeholder="Required exception reason"/><button type="button" onClick={() => closeException(po)} disabled={saving === `close-${po.id}`} className="h-8 px-3 rounded-md bg-amber-700 text-white text-xs font-semibold disabled:opacity-40">Close exception</button></div></Td></tr>) : <Empty cols={6}>{loading ? "Loading exception candidates…" : "No approved purchase order currently needs an exception close."}</Empty>}</tbody></table></div></section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Closed PO history</div><div className="text-xs text-[#777] mt-0.5">Closed POs are read-only for receiving and PO-linked billing. Reopening requires an active supplier and an audit reason.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1350px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>PO</Th><Th>Supplier</Th><Th>Closed</Th><Th>Mode</Th><Th>Frozen receiving</Th><Th>Frozen billing</Th><Th>Close reason</Th><Th>Reopen</Th></tr></thead><tbody>{closed.length ? closed.map((po) => { const snapshot = po.close_snapshot || {}; return <tr key={po.id} className="border-t border-[#eee] align-top"><Td><div className="font-semibold">{po.po_number}</div><div className="text-xs text-[#777]">PO {money(po.total)}</div></Td><Td>{po.supplier_name}</Td><Td>{dateTimeLabel(po.closed_at)}</Td><Td><Badge value={po.close_mode}/></Td><Td>{qty(snapshot.receivedQuantity)} / {qty(snapshot.orderedQuantity)}<div className="text-xs text-[#777]">{snapshot.shortLineCount || 0} short line{Number(snapshot.shortLineCount || 0) === 1 ? "" : "s"}</div></Td><Td>{money(snapshot.billedTotal)} / {money(snapshot.poTotal)}<div className="text-xs text-[#777]">Variance {money(snapshot.billVariance)}</div></Td><Td><div className="max-w-[280px] text-xs">{po.close_reason || "Fully matched"}</div></Td><Td><div className="flex gap-1 min-w-[330px]"><input className="h-8 flex-1 rounded-md border border-[#d5d5d5] px-2 text-xs" value={reopenReasons[po.id] || ""} onChange={(e) => setReopenReasons((current) => ({ ...current, [po.id]: e.target.value }))} placeholder="Required reopen reason"/><button type="button" onClick={() => reopen(po)} disabled={saving === `reopen-${po.id}`} className="h-8 px-2 rounded-md border border-[#d5d5d5] text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40"><RotateCcw size={13}/> Reopen</button></div></Td></tr>; }) : <Empty cols={8}>{loading ? "Loading closed purchase orders…" : "No purchase orders have been closed yet."}</Empty>}</tbody></table></div></section>
    </main>
  </div>;
}

function Metric({ label, value, good = false, warn = false }) { return <div className={`rounded-xl border bg-white p-4 ${good ? "border-emerald-200" : warn ? "border-amber-300" : "border-[#dedede]"}`}><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl font-semibold tabular-nums ${good ? "text-emerald-800" : warn ? "text-amber-800" : ""}`}>{value}</div></div>; }
function Badge({ value }) { const clean = String(value || "none").replaceAll("_", " "); const positive = ["matched", "received"].includes(clean); const warn = ["exception", "variance", "partial"].includes(clean); return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${positive ? "bg-emerald-100 text-emerald-800" : warn ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{clean}</span>; }
function Th({ children, right = false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-3 py-3 ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
