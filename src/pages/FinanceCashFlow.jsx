import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { adminCashFlowApi } from "@/lib/adminCashFlowApi";

const money = (value) => Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });

function reginaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Regina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthStart(date = reginaDate()) {
  return `${date.slice(0, 8)}01`;
}

function Metric({ label, value, sub, alert = false }) {
  return <div className={`rounded-xl border bg-white p-4 ${alert ? "border-amber-300" : "border-[#dedede]"}`}>
    <div className="text-xs uppercase tracking-[0.08em] font-semibold text-[#6a6d73]">{label}</div>
    <div className={`mt-1 text-xl font-bold tabular-nums ${alert ? "text-amber-800" : "text-[#18191b]"}`}>{value}</div>
    {sub && <div className="mt-1 text-xs text-[#777b82]">{sub}</div>}
  </div>;
}

function ActivitySection({ title, total, rows = [], empty = "No cash activity in this section." }) {
  return <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
    <div className="flex items-center justify-between gap-4 px-4 py-4 border-b border-[#dedede]"><div className="font-semibold">{title}</div><div className="font-bold tabular-nums">{money(total)}</div></div>
    {rows.length === 0 ? <div className="px-4 py-5 text-sm text-[#777b82]">{empty}</div> : rows.map((row) => <div key={row.journalEntryId} className="grid gap-1 border-t border-[#ececee] px-4 py-3 text-sm sm:grid-cols-[120px_1fr_auto] sm:gap-4">
      <div className="text-[#666a72]">{row.date}</div>
      <div className="min-w-0"><div className="font-medium text-[#25272b]">{row.label || "Cash movement"}</div><div className="mt-0.5 truncate text-xs text-[#777b82]">{row.reference || row.memo || `Journal #${row.entryNumber || "—"}`}</div></div>
      <div className="font-semibold tabular-nums sm:text-right">{money(row.amount)}</div>
    </div>)}
  </section>;
}

export default function FinanceCashFlow() {
  const today = reginaDate();
  const [periodFrom, setPeriodFrom] = useState(monthStart(today));
  const [periodTo, setPeriodTo] = useState(today);
  const [data, setData] = useState({
    scope: {},
    readiness: {},
    ledger: {},
    cashFlow: {},
    cashComposition: [],
    activities: { operating: [], investing: [], financing: [], unclassified: [] },
    policy: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await adminCashFlowApi.load({ periodFrom, periodTo });
      setData(snapshot || {});
    } catch (err) {
      console.error("Cash flow statement load failed:", err);
      setError(err?.message || "Could not load the Cash Flow Statement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Initial load uses initialized Regina dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readiness = data?.readiness || {};
  const cashFlow = data?.cashFlow || {};
  const activities = data?.activities || { operating: [], investing: [], financing: [], unclassified: [] };
  const composition = Array.isArray(data?.cashComposition) ? data.cashComposition : [];
  const authoritative = Boolean(readiness.authoritative);
  const reconciled = Boolean(readiness.reconciled);
  const unclassifiedCount = Number(readiness.unclassifiedMovementCount || 0);
  const structuralAdjustment = Number(readiness.structuralCashAdjustment || 0);

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
        <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><Banknote size={16}/> Cash Flow Statement</div>
        <div className="ml-auto flex items-center gap-2"><Link to="/admin/finance/financial-statements" className="hidden sm:flex h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 items-center gap-2 text-sm font-semibold">Financial Statements</Link><Link to="/admin/finance" className="h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link></div>
      </div>
    </header>

    <div className="border-b border-[#dedfe3] bg-white">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
        <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 27</div>
        <div className="mt-1 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Cash Flow Statement</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Direct-method cash flow generated from the General Ledger's real Cash on Hand and Operating Bank movements. Stripe Clearing stays outside cash until a payout settles to the bank.</p></div>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs text-[#666]">From<input type="date" value={periodFrom} max={periodTo || today} onChange={(event) => setPeriodFrom(event.target.value)} className="mt-1 block h-9 rounded-lg border border-[#d5d5d5] px-2 text-sm text-[#171717]"/></label>
            <label className="text-xs text-[#666]">To<input type="date" value={periodTo} min={periodFrom || undefined} max={today} onChange={(event) => setPeriodTo(event.target.value)} className="mt-1 block h-9 rounded-lg border border-[#d5d5d5] px-2 text-sm text-[#171717]"/></label>
            <button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
          </div>
        </div>
      </div>
    </div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="py-16 text-center text-sm text-[#777]">Loading Cash Flow Statement…</div> : <>
        <section className={`rounded-xl border p-4 text-sm flex gap-3 ${authoritative ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          {authoritative ? <CheckCircle2 size={18} className="shrink-0 mt-0.5"/> : <AlertTriangle size={18} className="shrink-0 mt-0.5"/>}
          <div><div className="font-semibold">{authoritative ? "Cash Flow Statement is ready" : "Cash Flow Statement is preview only"}</div><div className="mt-1 text-xs leading-5">{authoritative ? "Opening balances are established, the GL is balanced, source posting is complete, every cash movement is classified, and beginning cash reconciles to ending cash." : <>A formal Cash Flow Statement requires a posted opening-balance cutover before the selected period, a balanced GL, no unresolved source-posting failures, no unclassified cash movements, and a zero reconciliation difference. {!readiness.openingCutoverPosted && <Link to="/admin/finance/opening-balances" className="font-semibold underline"> Complete Opening Balances first.</Link>}</>}</div></div>
        </section>

        {structuralAdjustment !== 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 flex gap-3"><AlertTriangle size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Structural cash adjustment exists inside this period</div><div className="mt-1 text-xs leading-5">{money(structuralAdjustment)} comes from an opening-balance or opening-reversal journal. It is shown only for reconciliation and is not treated as operating, investing, or financing cash flow.</div></div></section>}

        {unclassifiedCount > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 flex gap-3"><AlertTriangle size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Cash classification needs review</div><div className="mt-1 text-xs leading-5">{unclassifiedCount} cash-moving journal(s), totaling {money(readiness.unclassifiedMovementAmount)}, could not be classified safely. They remain visible as Unclassified and prevent authoritative status.</div></div></section>}

        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <Metric label="Beginning cash" value={money(cashFlow.beginningCash)} sub={`Before ${periodFrom}`} alert={!readiness.periodStartsAfterCutover}/>
          <Metric label="Operating cash flow" value={money(cashFlow.operating)} sub="Customer receipts, payouts and operating payments"/>
          <Metric label="Investing cash flow" value={money(cashFlow.investing)} sub="Equipment and investing activity"/>
          <Metric label="Financing cash flow" value={money(cashFlow.financing)} sub="Owner/equity financing movements"/>
          <Metric label="Ending cash" value={money(cashFlow.endingCash)} sub={`As of ${periodTo}`} alert={!reconciled}/>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric label="Net cash flow" value={money(cashFlow.netCashFlow)} sub="Operating + investing + financing + unclassified"/>
          <Metric label="Unclassified" value={money(cashFlow.unclassified)} sub={`${unclassifiedCount} movement(s)`} alert={unclassifiedCount > 0}/>
          <Metric label="Structural adjustment" value={money(cashFlow.structuralAdjustment)} sub="Opening/restatement journals only" alert={structuralAdjustment !== 0}/>
          <Metric label="Reconciliation difference" value={money(cashFlow.reconciliationDifference)} sub={reconciled ? "Beginning + movements = ending cash" : "Cash flow needs review"} alert={!reconciled}/>
        </div>

        <div className="grid xl:grid-cols-2 gap-5 items-start">
          <ActivitySection title="Operating activities" total={cashFlow.operating} rows={Array.isArray(activities.operating) ? activities.operating : []}/>
          <ActivitySection title="Investing activities" total={cashFlow.investing} rows={Array.isArray(activities.investing) ? activities.investing : []}/>
          <ActivitySection title="Financing activities" total={cashFlow.financing} rows={Array.isArray(activities.financing) ? activities.financing : []}/>
          <ActivitySection title="Unclassified cash movements" total={cashFlow.unclassified} rows={Array.isArray(activities.unclassified) ? activities.unclassified : []} empty="No unclassified cash movements."/>
        </div>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-4 border-b border-[#dedede]"><div className="font-semibold">Cash composition</div><div className="mt-1 text-xs text-[#6d7077]">Only Cash on Hand and Operating Bank are treated as cash. Stripe Clearing is a processor receivable until settlement.</div></div>
          {composition.length === 0 ? <div className="px-4 py-6 text-sm text-[#777]">No configured cash accounts found.</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#fafafa] text-xs uppercase tracking-[0.06em] text-[#6a6d73]"><tr><th className="px-4 py-3 text-left">Account</th><th className="px-4 py-3 text-right">Beginning</th><th className="px-4 py-3 text-right">Change</th><th className="px-4 py-3 text-right">Ending</th></tr></thead><tbody>{composition.map((account) => <tr key={account.id || account.systemKey} className="border-t border-[#ececee]"><td className="px-4 py-3 font-medium">{account.code} · {account.name}</td><td className="px-4 py-3 text-right tabular-nums">{money(account.beginningBalance)}</td><td className="px-4 py-3 text-right tabular-nums">{money(account.change)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{money(account.endingBalance)}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white p-4 text-xs leading-5 text-[#65686f]">Phase 27 is read-only reporting. It does not create or edit journal entries, change payment processing, move Stripe money, alter taxes, inventory quantities, pricing, discounts, shipping, or Custom Studio. Opening-balance journals are never presented as normal cash-flow activity.</section>
      </>}
    </main>
  </div>;
}
