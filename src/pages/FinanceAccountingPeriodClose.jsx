import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarCheck2, CheckCircle2, LockKeyhole, RefreshCw, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { adminAccountingPeriodCloseApi } from "@/lib/adminAccountingPeriodCloseApi";

const money = (value) => Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });

function monthLabel(value) {
  if (!value) return "Not available";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

function CheckItem({ label, ready, detail }) {
  return <div className={`rounded-xl border p-4 ${ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
    <div className="flex items-start gap-3">
      {ready ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700"/> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700"/>}
      <div><div className="text-sm font-semibold">{label}</div><div className="mt-1 text-xs leading-5 text-[#666a72]">{detail}</div></div>
    </div>
  </div>;
}

export default function FinanceAccountingPeriodClose() {
  const [data, setData] = useState({ periods: [], checklist: null, latestClosedPeriod: null, activeOpeningCutover: null });
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminAccountingPeriodCloseApi.load());
    } catch (err) {
      console.error("Accounting period close load failed:", err);
      setError(err?.message || "Could not load accounting period close controls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const checklist = data?.checklist || null;
  const periods = Array.isArray(data?.periods) ? data.periods : [];
  const latestClosed = data?.latestClosedPeriod || null;
  const blockedReasons = Array.isArray(checklist?.blockedReasons) ? checklist.blockedReasons : [];
  const canClose = Boolean(checklist?.closable);

  const closePeriod = async () => {
    setError("");
    setNotice("");
    if (!checklist?.periodStart) return;
    if (!confirmed) {
      setError("Confirm the close checklist before locking this accounting period.");
      return;
    }
    if (!canClose) {
      setError("This accounting period is not ready to close. Resolve the checklist items first.");
      return;
    }
    setClosing(true);
    try {
      const result = await adminAccountingPeriodCloseApi.close({
        periodStart: checklist.periodStart,
        notes: notes.trim() || null,
      });
      const period = result?.period;
      setNotice(`${monthLabel(period?.period_start || checklist.periodStart)} is closed. New ledger postings dated inside that month are now locked.`);
      setNotes("");
      setConfirmed(false);
      await load();
    } catch (err) {
      console.error("Accounting period close failed:", err);
      setError(err?.message || "Could not close the accounting period.");
    } finally {
      setClosing(false);
    }
  };

  const reopenLatest = async () => {
    const reason = reopenReason.trim();
    setError("");
    setNotice("");
    if (!latestClosed?.id) return;
    if (!reason) {
      setError("Enter a reason before reopening the latest closed accounting period.");
      return;
    }
    setReopening(true);
    try {
      await adminAccountingPeriodCloseApi.reopen({ periodCloseId: latestClosed.id, reason });
      setNotice(`${monthLabel(latestClosed.periodStart)} reopened. The month is unlocked until it passes the close checklist again.`);
      setReopenReason("");
      setConfirmed(false);
      await load();
    } catch (err) {
      console.error("Accounting period reopen failed:", err);
      setError(err?.message || "Could not reopen the accounting period.");
    } finally {
      setReopening(false);
    }
  };

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
        <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><CalendarCheck2 size={16}/> Accounting Period Close</div>
        <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
      </div>
    </header>

    <div className="border-b border-[#dedfe3] bg-white">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
        <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 26</div>
        <div className="mt-1 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Accounting Period Close &amp; Lock</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Close completed calendar months in sequence after the General Ledger, source posting, COGS, cash activity and bank activity pass their checks. Closed months reject new backdated journal activity until deliberately reopened.</p></div>
          <button type="button" onClick={load} disabled={loading || closing || reopening} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
        </div>
      </div>
    </div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      {loading ? <div className="py-16 text-center text-sm text-[#777]">Loading accounting close controls…</div> : <>
        <section className="rounded-xl border border-[#dedede] bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div><div className="text-xs uppercase tracking-[0.08em] font-semibold text-[#6a6d73]">Next sequential close</div><h2 className="mt-1 text-2xl font-bold">{checklist ? monthLabel(checklist.periodStart) : "Not available yet"}</h2><p className="mt-1 text-sm text-[#666a72]">{checklist ? `${checklist.periodStart} through ${checklist.periodEnd}` : "Post the real opening-balance cutover and establish GL activity first."}</p></div>
            <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${canClose ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{canClose ? "Ready to close" : "Not ready"}</div>
          </div>

          {checklist && <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            <CheckItem label="Completed month" ready={Boolean(checklist.periodComplete)} detail={checklist.periodComplete ? "The month is fully complete and no longer the current calendar month." : "Current or future months cannot be closed."}/>
            <CheckItem label="Opening balances" ready={Boolean(checklist.openingCutoverReady)} detail={checklist.openingCutoverReady ? `Cutover posted on ${checklist.openingCutover?.cutoverDate}.` : "A real Phase 24 opening-balance cutover must be posted first."}/>
            <CheckItem label="General Ledger" ready={Boolean(checklist.ledger?.balanced)} detail={`${money(checklist.ledger?.totalDebits)} debits · ${money(checklist.ledger?.totalCredits)} credits · difference ${money(checklist.ledger?.difference)}`}/>
            <CheckItem label="Source posting" ready={Number(checklist.unresolvedSourceFailures || 0) === 0} detail={`${Number(checklist.unresolvedSourceFailures || 0)} unresolved source-to-ledger failure(s).`}/>
            <CheckItem label="COGS coverage" ready={Number(checklist.pendingCogsOrders || 0) === 0} detail={`${Number(checklist.pendingCogsOrders || 0)} paid order(s) through period end still waiting for configured COGS.`}/>
            <CheckItem label="Cash Close" ready={Boolean(checklist.cashClose?.ready)} detail={`${Number(checklist.cashClose?.activityDays || 0)} cash activity day(s) · ${Number(checklist.cashClose?.unclosedActivityDays || 0)} unclosed.`}/>
            <CheckItem label="Bank reconciliation" ready={Boolean(checklist.bankClose?.ready)} detail={`${Number(checklist.bankClose?.activeEntries || 0)} active bank entry/entries · ${Number(checklist.bankClose?.unreconciledEntries || 0)} not covered by a closed statement.`}/>
            <CheckItem label="Sequential order" ready={Boolean(checklist.sequenceOkay)} detail={checklist.sequenceOkay ? "This is the next eligible month in the close sequence." : `Expected next period: ${checklist.expectedNextPeriodStart || "not established"}.`}/>
          </div>}

          {!data?.activeOpeningCutover && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="font-semibold">Opening balances are still required</div><div className="mt-1 text-xs leading-5">Phase 26 is installed, but GDP should not close its first accounting month until the Phase 24 opening-balance worksheet is populated from real records and posted. <Link to="/admin/finance/opening-balances" className="font-semibold underline">Open Opening Balances</Link>.</div></div>}

          {blockedReasons.length > 0 && <div className="mt-4 rounded-lg border border-[#dedede] bg-[#fafafa] p-4"><div className="text-sm font-semibold">Items blocking close</div><ul className="mt-2 list-disc pl-5 text-xs leading-6 text-[#666a72]">{blockedReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}

          {checklist && <div className="mt-5 grid lg:grid-cols-[1fr_auto] gap-4 items-end">
            <label className="text-sm font-medium">Close notes <span className="font-normal text-[#777]">(optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1500} rows={3} placeholder="Month-end notes, supporting records, exceptions…" className="mt-1.5 w-full rounded-lg border border-[#d5d5d5] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#999]"/></label>
            <div className="lg:w-[310px] space-y-3"><label className="flex items-start gap-2 text-xs leading-5 text-[#555961]"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1"/>I confirm the checklist and understand that ledger activity dated inside the closed month will be locked until the month is deliberately reopened.</label><button type="button" onClick={closePeriod} disabled={!canClose || !confirmed || closing || reopening} className="w-full h-10 rounded-lg bg-[#171717] px-4 text-sm font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-40"><LockKeyhole size={16}/>{closing ? "Closing…" : `Close ${monthLabel(checklist.periodStart)}`}</button></div>
          </div>}
        </section>

        {latestClosed && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3"><RotateCcw size={19} className="mt-0.5 shrink-0 text-amber-800"/><div className="flex-1"><div className="font-semibold text-amber-950">Controlled reopen — latest closed month only</div><div className="mt-1 text-xs leading-5 text-amber-900">{monthLabel(latestClosed.periodStart)} is the latest locked period. Reopening is audited and requires a reason. Older months cannot be reopened until later closed months are reopened first.</div><div className="mt-3 flex flex-col md:flex-row gap-2"><input value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} maxLength={500} placeholder="Required reopen reason" className="h-10 flex-1 rounded-lg border border-amber-300 bg-white px-3 text-sm outline-none"/><button type="button" onClick={reopenLatest} disabled={reopening || closing || !reopenReason.trim()} className="h-10 rounded-lg border border-amber-400 bg-white px-4 text-sm font-semibold text-amber-950 disabled:opacity-40">{reopening ? "Reopening…" : "Reopen latest month"}</button></div></div></div>
        </section>}

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-4 border-b border-[#dedede]"><div className="font-semibold">Accounting close history</div><div className="mt-1 text-xs text-[#6d7077]">No hard deletes. Reopened months remain visible with their reopen count and audit reason.</div></div>
          {periods.length === 0 ? <div className="px-4 py-8 text-center text-sm text-[#777]">No accounting periods have been closed yet.</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#fafafa] text-xs uppercase tracking-[0.06em] text-[#6a6d73]"><tr><th className="px-4 py-3 text-left">Period</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Closed</th><th className="px-4 py-3 text-right">Reopens</th><th className="px-4 py-3 text-left">Last reopen reason</th></tr></thead><tbody>{periods.map((period) => <tr key={period.id} className="border-t border-[#ececee]"><td className="px-4 py-3 font-medium">{monthLabel(period.periodStart)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${period.status === "closed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{period.status}</span></td><td className="px-4 py-3 text-[#666]">{period.closedAt ? new Date(period.closedAt).toLocaleString("en-CA") : "—"}</td><td className="px-4 py-3 text-right tabular-nums">{Number(period.reopenCount || 0)}</td><td className="px-4 py-3 text-[#666]">{period.lastReopenReason || "—"}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white p-4 text-xs leading-5 text-[#65686f]">Phase 26 closes calendar months only. It does not create year-end closing entries or automatically move income into Retained Earnings. That remains a separate controlled year-end workflow so GDP never receives a synthetic accounting entry.</section>
      </>}
    </main>
  </div>;
}
