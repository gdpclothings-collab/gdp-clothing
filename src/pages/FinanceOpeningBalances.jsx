import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileWarning, RefreshCw, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { adminOpeningBalancesApi } from "@/lib/adminOpeningBalancesApi";

const money = (value) => Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

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

function normalizeCurrent(current) {
  if (!current) return null;
  return {
    ...current,
    cutoverDate: current.cutoverDate || current.cutover_date || "",
    totalDebits: Number(current.totalDebits ?? current.total_debits ?? 0),
    totalCredits: Number(current.totalCredits ?? current.total_credits ?? 0),
    journalEntryId: current.journalEntryId || current.journal_entry_id || null,
    reversalEntryId: current.reversalEntryId || current.reversal_entry_id || null,
    postedAt: current.postedAt || current.posted_at || null,
    reversedAt: current.reversedAt || current.reversed_at || null,
    reversalReason: current.reversalReason || current.reversal_reason || null,
  };
}

function Metric({ label, value, sub, alert = false }) {
  return <div className={`rounded-xl border bg-white p-4 ${alert ? "border-amber-300" : "border-[#dedede]"}`}>
    <div className="text-xs uppercase tracking-[0.08em] font-semibold text-[#6a6d73]">{label}</div>
    <div className={`mt-1 text-xl font-bold ${alert ? "text-amber-800" : "text-[#18191b]"}`}>{value}</div>
    <div className="mt-1 text-xs text-[#777b82]">{sub}</div>
  </div>;
}

export default function FinanceOpeningBalances() {
  const [data, setData] = useState({ accounts: [], ledger: {}, references: {}, history: [], current: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cutoverDate, setCutoverDate] = useState("");
  const [notes, setNotes] = useState("");
  const [values, setValues] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseDate, setReverseDate] = useState(reginaDate());

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await adminOpeningBalancesApi.load();
      setData(snapshot || {});
      const current = normalizeCurrent(snapshot?.current);
      if (current?.status === "draft") {
        setCutoverDate(current.cutoverDate || snapshot?.ledger?.latestAllowedCutoverDate || reginaDate());
        setNotes(current.notes || "");
        const next = {};
        (current.lines || []).forEach((line) => {
          next[line.accountId] = { side: line.side, amount: String(line.amount ?? ""), note: line.note || "" };
        });
        setValues(next);
      } else if (!current) {
        setCutoverDate(snapshot?.ledger?.latestAllowedCutoverDate || reginaDate());
        setNotes("");
        setValues({});
      }
    } catch (err) {
      console.error("Opening balance cutover load failed:", err);
      setError(err?.message || "Could not load opening balance controls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const current = normalizeCurrent(data?.current);
  const ledger = data?.ledger || {};
  const references = data?.references || {};
  const inventory = references?.inventory || {};
  const isPosted = current?.status === "posted";

  const rows = useMemo(() => accounts.map((account) => {
    const saved = values[account.id] || {};
    return {
      ...account,
      side: saved.side || account.normalBalance || "debit",
      amount: saved.amount ?? "",
      note: saved.note || "",
    };
  }), [accounts, values]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    const amount = round2(row.amount);
    if (!(amount > 0)) return acc;
    if (row.side === "debit") acc.debits = round2(acc.debits + amount);
    else acc.credits = round2(acc.credits + amount);
    acc.lines += 1;
    acc.difference = round2(acc.debits - acc.credits);
    return acc;
  }, { debits: 0, credits: 0, difference: 0, lines: 0 }), [rows]);

  const setRow = (accountId, field, value) => {
    setConfirmed(false);
    setValues((currentValues) => ({
      ...currentValues,
      [accountId]: {
        side: currentValues[accountId]?.side || accounts.find((account) => account.id === accountId)?.normalBalance || "debit",
        amount: currentValues[accountId]?.amount ?? "",
        note: currentValues[accountId]?.note || "",
        [field]: value,
      },
    }));
  };

  const payloadLines = () => rows
    .map((row) => ({
      accountId: row.id,
      side: row.side,
      amount: round2(row.amount),
      note: row.note.trim() || null,
    }))
    .filter((line) => line.amount > 0);

  const saveDraft = async ({ quiet = false } = {}) => {
    if (!cutoverDate) {
      setError("Choose an opening-balance cutover date.");
      return null;
    }
    setSaving(true);
    setError("");
    if (!quiet) setNotice("");
    try {
      const result = await adminOpeningBalancesApi.saveDraft({
        cutoverDate,
        notes: notes.trim() || null,
        lines: payloadLines(),
      });
      if (!quiet) setNotice("Opening-balance worksheet saved as a draft. No General Ledger entry was posted.");
      await load();
      return result?.cutover || null;
    } catch (err) {
      console.error("Opening balance draft save failed:", err);
      setError(err?.message || "Could not save the opening-balance draft.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const postCutover = async () => {
    setError("");
    setNotice("");
    if (!confirmed) {
      setError("Confirm that every amount comes from actual business records before posting.");
      return;
    }
    if (totals.lines < 2 || totals.debits <= 0 || totals.debits !== totals.credits) {
      setError("Opening balances must contain at least two non-zero lines and total debits must equal total credits.");
      return;
    }
    setPosting(true);
    try {
      const draft = await adminOpeningBalancesApi.saveDraft({
        cutoverDate,
        notes: notes.trim() || null,
        lines: payloadLines(),
      });
      const cutoverId = draft?.cutover?.id;
      if (!cutoverId) throw new Error("The opening-balance draft could not be identified.");
      const result = await adminOpeningBalancesApi.postCutover(cutoverId);
      const number = result?.journal?.entry_number;
      setConfirmed(false);
      setNotice(`Opening balances posted${number ? ` as journal #${number}` : ""}. The cutover is now locked; corrections require a controlled reversal.`);
      await load();
    } catch (err) {
      console.error("Opening balance post failed:", err);
      setError(err?.message || "Could not post the opening-balance cutover.");
    } finally {
      setPosting(false);
    }
  };

  const reverseCutover = async () => {
    const reason = reverseReason.trim();
    setError("");
    setNotice("");
    if (!current?.id) return;
    if (!reason) {
      setError("Enter a reason before reversing the opening-balance cutover.");
      return;
    }
    setReversing(true);
    try {
      const result = await adminOpeningBalancesApi.reverseCutover({
        cutoverId: current.id,
        reversalDate: reverseDate,
        reason,
      });
      const number = result?.reversal?.entry_number;
      setReverseReason("");
      setNotice(`Opening-balance cutover reversed${number ? ` by journal #${number}` : ""}. Original and reversal remain in the audit trail.`);
      await load();
    } catch (err) {
      console.error("Opening balance reversal failed:", err);
      setError(err?.message || "Could not reverse the opening-balance cutover.");
    } finally {
      setReversing(false);
    }
  };

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
        <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><ShieldCheck size={16}/> Opening Balances</div>
        <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
      </div>
    </header>

    <div className="border-b border-[#dedfe3] bg-white">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
        <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 24</div>
        <div className="mt-1 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Opening Balances &amp; GL Cutover</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Establish the balance-sheet starting point for GDP's automated General Ledger using verified business records only. Nothing is auto-filled or auto-posted from estimates.</p></div>
          <button type="button" onClick={load} disabled={loading || saving || posting || reversing} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
        </div>
      </div>
    </div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      {loading ? <div className="py-16 text-center text-sm text-[#777]">Loading opening-balance controls…</div> : <>
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 flex gap-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5"/>
          <div><div className="font-semibold">Opening balances are not a guess or a balancing plug</div><div className="mt-1 text-xs leading-5">Use bank/cash records, verified receivables/payables, inventory cost records, equipment records and owner-equity records. The system will never create a synthetic opening amount or automatically force Retained Earnings to make the journal balance.</div></div>
        </section>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric label="First existing GL activity" value={ledger.earliestActivityDate || "None"} sub={ledger.earliestActivityDate ? `Opening date must be before this date` : "No posted operating activity yet"}/>
          <Metric label="Latest safe cutover date" value={ledger.latestAllowedCutoverDate || "—"} sub="End-of-day opening balance date"/>
          <Metric label="Source posting failures" value={Number(ledger.unresolvedSourceFailures || 0).toLocaleString("en-CA")} sub="Must be zero before posting" alert={Number(ledger.unresolvedSourceFailures || 0) > 0}/>
          <Metric label="Cutover status" value={isPosted ? "Posted" : current?.status === "draft" ? "Draft" : "Not started"} sub={isPosted ? "Backdated pre-cutover journals are locked" : "No opening journal has been posted"}/>
        </div>

        <section className="rounded-xl border border-[#dedede] bg-white p-4">
          <div className="flex items-center gap-2 font-semibold"><FileWarning size={17}/> Authoritative reference signals</div>
          <p className="mt-1 text-xs text-[#6d7077]">Reference only. These values are never copied into the opening journal automatically.</p>
          <div className="mt-4 grid md:grid-cols-3 gap-3">
            <Metric label="Physical inventory" value={`${Number(inventory.physicalUnits || 0).toLocaleString("en-CA")} units`} sub={`${Number(inventory.costedUnits || 0).toLocaleString("en-CA")} units currently have cost coverage`} alert={!inventory.coverageComplete && Number(inventory.physicalUnits || 0) > 0}/>
            <Metric label="Known inventory value" value={money(inventory.knownValue)} sub={inventory.coverageComplete ? "Cost coverage complete" : "Incomplete coverage — do not interpret unknown cost as $0"} alert={!inventory.coverageComplete && Number(inventory.physicalUnits || 0) > 0}/>
            <Metric label="Open AR / AP" value={`${money(references.openAccountsReceivable)} / ${money(references.openAccountsPayable)}`} sub="Current receivable / payable ledgers"/>
          </div>
        </section>

        {isPosted ? <>
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 flex gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5"/>
            <div><div className="font-semibold">Opening-balance cutover is active</div><div className="mt-1 text-xs leading-5">Cutover date: {current.cutoverDate}. Posted total: {money(current.totalDebits)} debits = {money(current.totalCredits)} credits. New journals dated on or before the cutover are blocked until this cutover is reversed.</div></div>
          </section>

          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e4e4e4] font-semibold">Posted opening balances</div>
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wide text-[#6d7077]"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Debit</th><th className="px-4 py-3">Credit</th><th className="px-4 py-3">Note</th></tr></thead><tbody>
              {(current.lines || []).map((line) => { const account = accounts.find((item) => item.id === line.accountId); return <tr key={line.accountId} className="border-t border-[#eeeeee]"><td className="px-4 py-3 font-medium">{account ? `${account.code} · ${account.name}` : line.accountId}</td><td className="px-4 py-3 tabular-nums">{line.side === "debit" ? money(line.amount) : "—"}</td><td className="px-4 py-3 tabular-nums">{line.side === "credit" ? money(line.amount) : "—"}</td><td className="px-4 py-3 text-[#666]">{line.note || "—"}</td></tr>; })}
            </tbody></table></div>
          </section>

          <section className="rounded-xl border border-red-200 bg-white p-4">
            <div className="font-semibold text-red-800">Reverse cutover</div>
            <p className="mt-1 text-xs text-[#6d7077]">Use only when the opening baseline itself is wrong. This creates an equal-and-opposite journal; nothing is deleted.</p>
            <div className="mt-3 grid md:grid-cols-[180px_1fr_auto] gap-3 items-end">
              <label className="text-xs text-[#666]">Reversal date<input type="date" min={current.cutoverDate} max={reginaDate()} value={reverseDate} onChange={(event) => setReverseDate(event.target.value)} className="mt-1 w-full h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm"/></label>
              <label className="text-xs text-[#666]">Required reason<input value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} maxLength={500} placeholder="Why is the opening balance being replaced?" className="mt-1 w-full h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm"/></label>
              <button type="button" onClick={reverseCutover} disabled={reversing || !reverseReason.trim()} className="h-10 px-4 rounded-lg bg-red-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"><RotateCcw size={15}/>{reversing ? "Reversing…" : "Reverse cutover"}</button>
            </div>
          </section>
        </> : <>
          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-4 border-b border-[#e4e4e4] flex flex-col lg:flex-row lg:items-end gap-3 lg:justify-between">
              <div><div className="font-semibold">Opening-balance worksheet</div><div className="mt-1 text-xs text-[#777]">Enter only verified non-zero balances. Revenue and expense accounts are intentionally excluded.</div></div>
              <div className="flex flex-wrap gap-3">
                <label className="text-xs text-[#666]">Cutover date<input type="date" max={ledger.latestAllowedCutoverDate || reginaDate()} value={cutoverDate} onChange={(event) => { setCutoverDate(event.target.value); setConfirmed(false); }} className="mt-1 block h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm"/></label>
              </div>
            </div>
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#fafafa] text-left text-xs uppercase tracking-wide text-[#6d7077]"><tr><th className="px-4 py-3 min-w-[260px]">Account</th><th className="px-4 py-3 min-w-[120px]">Side</th><th className="px-4 py-3 min-w-[150px]">Amount</th><th className="px-4 py-3 min-w-[260px]">Evidence / note</th></tr></thead><tbody>
              {rows.map((row) => <tr key={row.id} className="border-t border-[#eeeeee]"><td className="px-4 py-3"><div className="font-medium">{row.code} · {row.name}</div><div className="text-xs text-[#777] mt-0.5">{row.accountType} · normal {row.normalBalance}</div></td><td className="px-4 py-3"><select value={row.side} onChange={(event) => setRow(row.id, "side", event.target.value)} className="h-9 w-full rounded-lg border border-[#d5d5d5] px-2 bg-white"><option value="debit">Debit</option><option value="credit">Credit</option></select></td><td className="px-4 py-3"><input type="number" min="0" step="0.01" value={row.amount} onChange={(event) => setRow(row.id, "amount", event.target.value)} placeholder="0.00" className="h-9 w-full rounded-lg border border-[#d5d5d5] px-3 tabular-nums"/></td><td className="px-4 py-3"><input value={row.note} onChange={(event) => setRow(row.id, "note", event.target.value)} maxLength={240} placeholder="Statement, count sheet, invoice, owner record…" className="h-9 w-full rounded-lg border border-[#d5d5d5] px-3"/></td></tr>)}
            </tbody></table></div>
            <div className="border-t border-[#e4e4e4] p-4 grid md:grid-cols-3 gap-3">
              <Metric label="Debits" value={money(totals.debits)} sub={`${totals.lines} non-zero lines`}/>
              <Metric label="Credits" value={money(totals.credits)} sub="Opening journal credits"/>
              <Metric label="Difference" value={money(totals.difference)} sub={totals.debits === totals.credits && totals.debits > 0 ? "Balanced" : "Must equal $0.00 before posting"} alert={totals.difference !== 0 || totals.debits <= 0}/>
            </div>
          </section>

          <section className="rounded-xl border border-[#dedede] bg-white p-4 space-y-4">
            <label className="block text-sm font-medium">Cutover notes<textarea value={notes} onChange={(event) => { setNotes(event.target.value); setConfirmed(false); }} maxLength={1500} rows={3} placeholder="Record where the opening values came from and any assumptions that still need accountant review." className="mt-1.5 w-full rounded-lg border border-[#d5d5d5] px-3 py-2 text-sm"/></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5"/><span>I confirm these amounts come from actual GDP Clothing business records. I understand the system will not invent a balancing amount.</span></label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => saveDraft()} disabled={saving || posting} className="h-10 px-4 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Save size={15}/>{saving ? "Saving…" : "Save draft"}</button>
              <button type="button" onClick={postCutover} disabled={posting || saving || !confirmed || totals.lines < 2 || totals.debits <= 0 || totals.debits !== totals.credits || Number(ledger.unresolvedSourceFailures || 0) > 0} className="h-10 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40"><ShieldCheck size={15}/>{posting ? "Posting…" : "Post opening balances"}</button>
            </div>
          </section>
        </>}

        {Array.isArray(data?.history) && data.history.length > 0 && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e4e4e4] font-semibold">Cutover history</div>
          <div className="divide-y divide-[#eeeeee]">{data.history.map((item) => <div key={item.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-1"><div><span className="font-medium">{item.cutoverDate}</span><span className="ml-2 text-xs uppercase font-semibold text-[#666]">{item.status}</span><div className="text-xs text-[#777] mt-1">{item.notes || "No notes"}</div></div><div className="text-sm tabular-nums">{money(item.totalDebits)} / {money(item.totalCredits)}</div></div>)}</div>
        </section>}
      </>}
    </main>
  </div>;
}
