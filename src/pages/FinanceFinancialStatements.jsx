import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { adminFinancialStatementsApi } from "@/lib/adminFinancialStatementsApi";

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
    <div className={`mt-1 text-xl font-bold ${alert ? "text-amber-800" : "text-[#18191b]"}`}>{value}</div>
    {sub && <div className="mt-1 text-xs text-[#777b82]">{sub}</div>}
  </div>;
}

function StatementRows({ rows = [], empty = "No activity in this section." }) {
  const visible = rows.filter((row) => Math.abs(Number(row.balance || 0)) >= 0.005);
  if (!visible.length) return <div className="px-4 py-3 text-sm text-[#777b82]">{empty}</div>;
  return visible.map((row) => <div key={row.id || row.code} className="grid grid-cols-[1fr_auto] gap-4 border-t border-[#ececee] px-4 py-2.5 text-sm">
    <div className="min-w-0"><span className="font-medium text-[#25272b]">{row.code} · {row.name}</span></div>
    <div className="font-medium tabular-nums text-right">{money(row.balance)}</div>
  </div>);
}

function TotalRow({ label, value, strong = false }) {
  return <div className={`grid grid-cols-[1fr_auto] gap-4 border-t border-[#d9dadd] px-4 py-3 ${strong ? "bg-[#f5f5f6] font-bold" : "font-semibold"}`}>
    <div>{label}</div><div className="tabular-nums text-right">{money(value)}</div>
  </div>;
}

export default function FinanceFinancialStatements() {
  const today = reginaDate();
  const [asOf, setAsOf] = useState(today);
  const [periodFrom, setPeriodFrom] = useState(monthStart(today));
  const [periodTo, setPeriodTo] = useState(today);
  const [data, setData] = useState({ scope: {}, readiness: {}, ledger: {}, balanceSheet: {}, profitAndLoss: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await adminFinancialStatementsApi.load({ asOf, periodFrom, periodTo });
      setData(snapshot || {});
    } catch (err) {
      console.error("Financial statements load failed:", err);
      setError(err?.message || "Could not load GL financial statements.");
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
  const balanceSheet = data?.balanceSheet || {};
  const profitAndLoss = data?.profitAndLoss || {};
  const inventory = readiness?.inventoryReference || {};
  const bsReady = Boolean(readiness.balanceSheetAuthoritative);
  const plReady = Boolean(readiness.profitAndLossAuthoritative);
  const ledgerBalanced = Boolean(readiness.ledgerBalanced);

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
        <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><BarChart3 size={16}/> Financial Statements</div>
        <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
      </div>
    </header>

    <div className="border-b border-[#dedfe3] bg-white">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
        <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 25</div>
        <div className="mt-1 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">GL Financial Statements</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Read-only Balance Sheet and Profit &amp; Loss generated directly from GDP's immutable General Ledger. No opening balances, retained earnings or missing costs are fabricated.</p></div>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs text-[#666]">As of<input type="date" value={asOf} max={today} onChange={(event) => { const value = event.target.value; setAsOf(value); if (periodTo > value) setPeriodTo(value); }} className="mt-1 block h-9 rounded-lg border border-[#d5d5d5] px-2 text-sm text-[#171717]"/></label>
            <label className="text-xs text-[#666]">P&amp;L from<input type="date" value={periodFrom} max={periodTo || asOf} onChange={(event) => setPeriodFrom(event.target.value)} className="mt-1 block h-9 rounded-lg border border-[#d5d5d5] px-2 text-sm text-[#171717]"/></label>
            <label className="text-xs text-[#666]">P&amp;L to<input type="date" value={periodTo} min={periodFrom || undefined} max={asOf || today} onChange={(event) => setPeriodTo(event.target.value)} className="mt-1 block h-9 rounded-lg border border-[#d5d5d5] px-2 text-sm text-[#171717]"/></label>
            <button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
          </div>
        </div>
      </div>
    </div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="py-16 text-center text-sm text-[#777]">Loading GL financial statements…</div> : <>
        <div className="grid lg:grid-cols-2 gap-3">
          <section className={`rounded-xl border p-4 text-sm flex gap-3 ${bsReady ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            {bsReady ? <CheckCircle2 size={18} className="shrink-0 mt-0.5"/> : <AlertTriangle size={18} className="shrink-0 mt-0.5"/>}
            <div><div className="font-semibold">{bsReady ? "Balance Sheet is ready" : "Balance Sheet is preview only"}</div><div className="mt-1 text-xs leading-5">{bsReady ? `Opening cutover ${readiness.openingCutoverDate || ""} is active and the source ledger is complete.` : <>A formal Balance Sheet requires a posted opening-balance cutover, a balanced ledger and complete source posting. {readiness.openingCutoverPosted ? "The opening cutover is posted, but another readiness condition still needs attention." : <Link to="/admin/finance/opening-balances" className="font-semibold underline">Complete Opening Balances first.</Link>}</>}</div></div>
          </section>
          <section className={`rounded-xl border p-4 text-sm flex gap-3 ${plReady ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            {plReady ? <CheckCircle2 size={18} className="shrink-0 mt-0.5"/> : <AlertTriangle size={18} className="shrink-0 mt-0.5"/>}
            <div><div className="font-semibold">{plReady ? "Profit & Loss period is covered" : "Profit & Loss period is incomplete"}</div><div className="mt-1 text-xs leading-5">First operational GL activity: {readiness.firstOperationalActivityDate || "none"}. Source failures: {Number(readiness.unresolvedSourceFailures || 0)}. Paid orders waiting for configured COGS: {Number(readiness.pendingCogsOrders || 0)}.</div></div>
          </section>
        </div>

        {!inventory.coverageComplete && Number(inventory.physicalUnits || 0) > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 flex gap-3"><AlertTriangle size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Opening inventory cost coverage is incomplete</div><div className="mt-1 text-xs leading-5">{Number(inventory.costedUnits || 0).toLocaleString("en-CA")} of {Number(inventory.physicalUnits || 0).toLocaleString("en-CA")} physical units have a known cost basis. Known value is {money(inventory.knownValue)}. Unknown cost is never treated as zero in the opening-balance workflow.</div></div></section>}

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric label="Total assets" value={money(balanceSheet.totalAssets)} sub={`As of ${asOf}`} alert={!bsReady}/>
          <Metric label="Total liabilities" value={money(balanceSheet.totalLiabilities)} sub={`As of ${asOf}`}/>
          <Metric label="Total equity" value={money(balanceSheet.totalEquity)} sub="Includes cumulative unclosed earnings" alert={!bsReady}/>
          <Metric label="Balance-sheet difference" value={money(balanceSheet.difference)} sub={ledgerBalanced && balanceSheet.balanced ? "Assets = liabilities + equity" : "Ledger needs attention"} alert={!ledgerBalanced || !balanceSheet.balanced}/>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric label="Net revenue" value={money(profitAndLoss.netRevenue)} sub={`${periodFrom} to ${periodTo}`} alert={!plReady}/>
          <Metric label="COGS" value={money(profitAndLoss.cogs)} sub="Configured cost snapshots only"/>
          <Metric label="Gross profit" value={money(profitAndLoss.grossProfit)} sub="Net revenue − COGS"/>
          <Metric label="Net income" value={money(profitAndLoss.netIncome)} sub="After operating expenses" alert={!plReady}/>
        </div>

        <div className="grid xl:grid-cols-2 gap-5 items-start">
          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-4 border-b border-[#dedede]"><div className="font-semibold">Balance Sheet</div><div className="mt-1 text-xs text-[#6d7077]">As of {asOf} · CAD · {bsReady ? "authoritative GL statement" : "preview until opening cutover is posted"}</div></div>
            <div className="px-4 py-2.5 text-xs uppercase tracking-[0.08em] font-bold text-[#6a6d73]">Assets</div>
            <StatementRows rows={balanceSheet.assets}/>
            <TotalRow label="Total Assets" value={balanceSheet.totalAssets} strong/>
            <div className="px-4 py-2.5 text-xs uppercase tracking-[0.08em] font-bold text-[#6a6d73]">Liabilities</div>
            <StatementRows rows={balanceSheet.liabilities}/>
            <TotalRow label="Total Liabilities" value={balanceSheet.totalLiabilities}/>
            <div className="px-4 py-2.5 text-xs uppercase tracking-[0.08em] font-bold text-[#6a6d73]">Equity</div>
            <StatementRows rows={balanceSheet.equity}/>
            <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-[#ececee] px-4 py-2.5 text-sm"><div className="font-medium">Current Earnings (unclosed)</div><div className="font-medium tabular-nums text-right">{money(balanceSheet.currentEarnings)}</div></div>
            <TotalRow label="Total Equity" value={balanceSheet.totalEquity}/>
            <TotalRow label="Total Liabilities & Equity" value={balanceSheet.liabilitiesAndEquity} strong/>
          </section>

          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-4 border-b border-[#dedede]"><div className="font-semibold">Profit &amp; Loss</div><div className="mt-1 text-xs text-[#6d7077]">{periodFrom} to {periodTo} · CAD · {plReady ? "covered by current GL history" : "partial-history preview"}</div></div>
            <div className="px-4 py-2.5 text-xs uppercase tracking-[0.08em] font-bold text-[#6a6d73]">Revenue</div>
            <StatementRows rows={profitAndLoss.revenue}/>
            <TotalRow label="Net Revenue" value={profitAndLoss.netRevenue}/>
            <div className="px-4 py-2.5 text-xs uppercase tracking-[0.08em] font-bold text-[#6a6d73]">Cost of Goods Sold</div>
            <StatementRows rows={profitAndLoss.costOfGoodsSold}/>
            <TotalRow label="Gross Profit" value={profitAndLoss.grossProfit} strong/>
            <div className="px-4 py-2.5 text-xs uppercase tracking-[0.08em] font-bold text-[#6a6d73]">Operating Expenses</div>
            <StatementRows rows={profitAndLoss.operatingExpenses}/>
            <TotalRow label="Operating Expenses" value={profitAndLoss.operatingExpenseTotal}/>
            <TotalRow label="Net Income" value={profitAndLoss.netIncome} strong/>
          </section>
        </div>

        <section className="rounded-xl border border-[#dedede] bg-white p-4 text-xs leading-5 text-[#65686f]">
          Phase 25 is read-only. It does not post closing entries, invent retained earnings, synthesize opening balances, change inventory quantities, alter checkout, or modify Stripe payment processing. Formal Balance Sheet readiness remains gated by the Phase 24 opening-balance cutover.
        </section>
      </>}
    </main>
  </div>;
}
