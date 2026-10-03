import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { adminLiquidityApi } from "@/lib/adminLiquidityApi";

const money = (value) => value === null || value === undefined
  ? "—"
  : Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });

function dateLabel(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" })
    .format(new Date(year, month - 1, day));
}

export default function FinanceLiquidity() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminLiquidityApi.load());
    } catch (err) {
      console.error("Liquidity snapshot load failed:", err);
      setError(err?.message || "Could not load the liquidity snapshot.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const bank = data?.bank || {};
  const cash = data?.cash || {};
  const liquidity = data?.liquidity || {};
  const bankHistory = Array.isArray(data?.recentBankStatements) ? data.recentBankStatements : [];
  const cashHistory = Array.isArray(data?.recentCashCloses) ? data.recentCashCloses : [];

  const notices = useMemo(() => {
    const items = [];
    if (bank.verifiedBalance === null || bank.verifiedBalance === undefined) {
      items.push({ tone: "amber", text: "No statement-verified bank balance yet. Close a bank statement period before relying on a bank liquidity estimate." });
    } else if (Number(bank.postCloseEntryCount || 0) > 0) {
      items.push({ tone: "blue", text: `${bank.postCloseEntryCount} active bank entr${Number(bank.postCloseEntryCount) === 1 ? "y is" : "ies are"} after the latest closed statement. They are included in the book estimate but are not statement-verified yet.` });
    } else {
      items.push({ tone: "green", text: `Bank balance is statement-verified through ${dateLabel(bank.verifiedThrough)} with no later active bank entries.` });
    }

    if (Number(bank.reviewCount || 0) > 0 || Number(bank.unclassifiedCount || 0) > 0) {
      items.push({ tone: "amber", text: `${Number(bank.reviewCount || 0)} post-close bank entries need review and ${Number(bank.unclassifiedCount || 0)} remain unclassified.` });
    }

    if (cash.source === "open_expected") {
      items.push({ tone: "blue", text: `Cash-on-hand uses the expected drawer amount for the open cash day ${dateLabel(cash.openDate)}. It is not a physical-count close yet.` });
    } else if (cash.source === "closed_actual") {
      items.push({ tone: "green", text: `Cash-on-hand uses the last physically counted close from ${dateLabel(cash.latestClosedDate)}.` });
    } else {
      items.push({ tone: "amber", text: "No cash-register position is available yet. Open or close a cash day to establish physical cash-on-hand." });
    }

    return items;
  }, [bank, cash]);

  return (
    <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
        <div className="h-full px-3 md:px-5 flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
          <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><Banknote size={16}/> Cash Position &amp; Liquidity</div>
          <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
        </div>
      </header>

      <div className="border-b border-[#dedfe3] bg-white">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
          <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 14</div>
          <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Cash Position &amp; Liquidity</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">A read-only view of statement-verified bank cash, post-close bank-book movement, and physical cash-register position. It does not move money or create accounting entries.</p></div>
            <button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
          </div>
        </div>
      </div>

      <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading ? <div className="py-16 text-center text-sm text-[#777]">Loading cash position…</div> : <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Metric label="Estimated total liquidity" value={liquidity.complete ? money(liquidity.estimatedTotal) : "Needs both sources"} strong sub={liquidity.complete ? "Bank book estimate + current cash position" : `Known components: ${money(liquidity.partialTotal)}`}/>
            <Metric label="Bank book estimate" value={money(bank.bookBalanceEstimate)} sub={bank.verifiedThrough ? `Verified base through ${dateLabel(bank.verifiedThrough)}` : "No verified bank base"}/>
            <Metric label="Physical cash position" value={money(cash.positionEstimate)} sub={cash.source === "open_expected" ? `Expected · ${dateLabel(cash.openDate)}` : cash.source === "closed_actual" ? `Counted · ${dateLabel(cash.latestClosedDate)}` : "No cash close data"}/>
            <Metric label="Statement-verified bank" value={money(bank.verifiedBalance)} sub={bank.verifiedThrough ? `Through ${dateLabel(bank.verifiedThrough)}` : "Close a statement period"}/>
          </div>

          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#ededed] flex items-center gap-2"><ShieldCheck size={16}/><div><div className="text-sm font-semibold">Coverage &amp; confidence</div><div className="text-xs text-[#777] mt-0.5">Every estimate shows whether it comes from a verified close or later book activity.</div></div></div>
            <div className="p-4 space-y-2">{notices.map((item, index) => <Notice key={`${item.tone}-${index}`} {...item}/>)}</div>
          </section>

          <div className="grid lg:grid-cols-2 gap-5">
            <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Bank position</div><div className="text-xs text-[#777] mt-0.5">Latest closed statement plus active ledger activity after that close.</div></div>
              <div className="p-4 space-y-3">
                <Row label="Statement-verified balance" value={money(bank.verifiedBalance)} />
                <Row label="Post-close credits" value={money(bank.postCloseCredits)} />
                <Row label="Post-close debits" value={`−${money(bank.postCloseDebits)}`} />
                <Row label="Post-close net movement" value={money(bank.postCloseNet)} />
                <Row label="Bank book estimate" value={money(bank.bookBalanceEstimate)} strong />
                <Row label="Post-close entries" value={String(bank.postCloseEntryCount || 0)} />
              </div>
            </section>

            <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Cash-register position</div><div className="text-xs text-[#777] mt-0.5">Uses an open day's live expected drawer amount, otherwise the latest closed physical count.</div></div>
              <div className="p-4 space-y-3">
                <Row label="Current cash position" value={money(cash.positionEstimate)} strong />
                <Row label="Position source" value={cash.source === "open_expected" ? "Open-day expected cash" : cash.source === "closed_actual" ? "Closed-day actual count" : "Unavailable"} />
                <Row label="Position date" value={dateLabel(cash.asOfDate)} />
                <Row label="Latest closed actual" value={money(cash.latestClosedActual)} />
                <Row label="Latest close variance" value={money(cash.latestClosedVariance)} />
                <Row label="Open-day expected" value={money(cash.openExpected)} />
              </div>
            </section>
          </div>

          <HistorySection bankHistory={bankHistory} cashHistory={cashHistory}/>

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Read-only accounting view</div><div className="mt-1 text-xs">This page does not create, edit, void, deposit, withdraw, transfer, or reconcile money. Correct the source ledger in Bank Reconciliation, Bank Close, or Cash Close; this dashboard only summarizes those sources.</div></div></div>
        </>}
      </main>
    </div>
  );
}

function HistorySection({ bankHistory, cashHistory }) {
  return <div className="grid xl:grid-cols-2 gap-5">
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Recent closed bank statements</div><div className="text-xs text-[#777] mt-0.5">Up to 12 statement-verified periods.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Period</Th><Th right>Opening</Th><Th right>Credits</Th><Th right>Debits</Th><Th right>Closing</Th></tr></thead><tbody>{bankHistory.length ? bankHistory.map((row) => <tr key={`${row.period_start}-${row.period_end}`} className="border-t border-[#eeeeee]"><Td>{dateLabel(row.period_start)} – {dateLabel(row.period_end)}</Td><Td right>{money(row.opening_balance)}</Td><Td right>{money(row.credit_snapshot)}</Td><Td right>{money(row.debit_snapshot)}</Td><Td right strong>{money(row.statement_closing_balance)}</Td></tr>) : <Empty cols={5}>No closed bank statement periods yet.</Empty>}</tbody></table></div></section>
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Recent cash closes</div><div className="text-xs text-[#777] mt-0.5">Up to 31 physically counted cash days.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[660px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th right>Opening</Th><Th right>Expected</Th><Th right>Actual</Th><Th right>Variance</Th></tr></thead><tbody>{cashHistory.length ? cashHistory.map((row) => <tr key={row.business_date} className="border-t border-[#eeeeee]"><Td>{dateLabel(row.business_date)}</Td><Td right>{money(row.opening_cash)}</Td><Td right>{money(row.expected_cash)}</Td><Td right strong>{money(row.actual_cash)}</Td><Td right>{money(row.variance)}</Td></tr>) : <Empty cols={5}>No closed cash days yet.</Empty>}</tbody></table></div></section>
  </div>;
}

function Metric({ label, value, sub, strong = false }) { return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div>{sub && <div className="text-xs text-[#777] mt-1">{sub}</div>}</div>; }
function Row({ label, value, strong = false }) { return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-[#666]">{label}</span><span className={`text-right tabular-nums ${strong ? "font-bold" : "font-medium"}`}>{value}</span></div>; }
function Notice({ tone, text }) { const green = tone === "green"; const amber = tone === "amber"; const cls = green ? "border-emerald-200 bg-emerald-50 text-emerald-900" : amber ? "border-amber-200 bg-amber-50 text-amber-950" : "border-blue-200 bg-blue-50 text-blue-950"; const Icon = green ? CheckCircle2 : amber ? AlertTriangle : ShieldCheck; return <div className={`rounded-lg border px-3 py-2.5 text-sm flex gap-2 ${cls}`}><Icon size={16} className="shrink-0 mt-0.5"/><span>{text}</span></div>; }
function Th({ children, right = false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-3 py-3 ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
