import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, Plus, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { adminGeneralLedgerApi } from "@/lib/adminGeneralLedgerApi";

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

function monthStart() {
  const today = reginaDate();
  return `${today.slice(0, 8)}01`;
}

function blankLine() {
  return { accountId: "", description: "", debit: "", credit: "" };
}

function accountTypeLabel(value) {
  return String(value || "").replace(/^./, (letter) => letter.toUpperCase());
}

export default function FinanceGeneralLedger() {
  const [data, setData] = useState({ summary: {}, accounts: [], trialBalance: [], entries: [], scope: {} });
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [reversing, setReversing] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(reginaDate());
  const [entryDate, setEntryDate] = useState(reginaDate());
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState([blankLine(), blankLine()]);
  const [reverseReasons, setReverseReasons] = useState({});
  const [reverseDates, setReverseDates] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminGeneralLedgerApi.load({ from: from || null, to: to || null, limit: 500 }));
    } catch (err) {
      console.error("General ledger load failed:", err);
      setError(err?.message || "Could not load the general ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Initial load uses the initialized date range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const trialBalance = Array.isArray(data?.trialBalance) ? data.trialBalance : [];
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const summary = data?.summary || {};

  const postingAccounts = useMemo(
    () => accounts.filter((account) => account.active && account.manualPostingAllowed),
    [accounts],
  );

  const draftTotals = useMemo(() => {
    const debit = round2(lines.reduce((sum, line) => sum + Number(line.debit || 0), 0));
    const credit = round2(lines.reduce((sum, line) => sum + Number(line.credit || 0), 0));
    return { debit, credit, difference: round2(debit - credit) };
  }, [lines]);

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const next = { ...line, [field]: value };
      if (field === "debit" && value !== "") next.credit = "";
      if (field === "credit" && value !== "") next.debit = "";
      return next;
    }));
  };

  const addLine = () => {
    if (lines.length >= 50) return;
    setLines((current) => [...current, blankLine()]);
  };

  const removeLine = (index) => {
    if (lines.length <= 2) return;
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  };

  const recordJournal = async () => {
    setError("");
    setNotice("");
    const cleanMemo = memo.trim();
    if (!cleanMemo) {
      setError("Enter a journal memo before posting.");
      return;
    }
    if (!entryDate) {
      setError("Choose a journal date.");
      return;
    }
    if (draftTotals.debit <= 0 || draftTotals.credit <= 0 || draftTotals.difference !== 0) {
      setError("Debits and credits must be equal and greater than zero.");
      return;
    }
    const normalized = lines.map((line) => ({
      accountId: line.accountId,
      description: line.description.trim() || null,
      debit: round2(line.debit),
      credit: round2(line.credit),
    }));
    if (normalized.some((line) => !line.accountId || !((line.debit > 0 && line.credit === 0) || (line.credit > 0 && line.debit === 0)))) {
      setError("Every journal line needs an account and exactly one debit or credit amount.");
      return;
    }

    setPosting(true);
    try {
      const result = await adminGeneralLedgerApi.recordManualJournal({
        entryDate,
        reference: reference.trim() || null,
        memo: cleanMemo,
        lines: normalized,
      });
      const number = result?.entry?.entry_number;
      setReference("");
      setMemo("");
      setEntryDate(reginaDate());
      setLines([blankLine(), blankLine()]);
      setNotice(`Journal${number ? ` #${number}` : ""} posted. It is now immutable; corrections require a reversing entry.`);
      await load();
    } catch (err) {
      console.error("Manual journal post failed:", err);
      setError(err?.message || "Could not post the journal entry.");
    } finally {
      setPosting(false);
    }
  };

  const reverseJournal = async (entry) => {
    const reason = String(reverseReasons[entry.id] || "").trim();
    const reversalDate = reverseDates[entry.id] || reginaDate();
    setError("");
    setNotice("");
    if (!reason) {
      setError(`Enter a reversal reason for journal #${entry.entry_number}.`);
      return;
    }
    setReversing(entry.id);
    try {
      const result = await adminGeneralLedgerApi.reverseJournal({ entryId: entry.id, reversalDate, reason });
      const reversalNumber = result?.reversal?.entry_number;
      setReverseReasons((current) => { const next = { ...current }; delete next[entry.id]; return next; });
      setReverseDates((current) => { const next = { ...current }; delete next[entry.id]; return next; });
      setNotice(`Journal #${entry.entry_number} reversed${reversalNumber ? ` by journal #${reversalNumber}` : ""}. Original and reversal remain in the audit trail.`);
      await load();
    } catch (err) {
      console.error("Journal reversal failed:", err);
      setError(err?.message || "Could not reverse the journal entry.");
    } finally {
      setReversing("");
    }
  };

  const balanced = Boolean(summary.balanced);

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
        <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><BookOpen size={16}/> General Ledger</div>
        <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
      </div>
    </header>

    <div className="border-b border-[#dedfe3] bg-white">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
        <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 22</div>
        <div className="mt-1 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Chart of Accounts &amp; General Ledger</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Double-entry accounting foundation for GDP Clothing. Manual journals post only when debits equal credits, and posted entries are corrected through reversing entries instead of deletion.</p></div>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs text-[#666]">From<input type="date" value={from} max={to || reginaDate()} onChange={(event) => setFrom(event.target.value)} className="mt-1 block h-9 rounded-lg border border-[#d5d5d5] px-2 text-sm text-[#171717]"/></label>
            <label className="text-xs text-[#666]">To<input type="date" value={to} min={from || undefined} max={reginaDate()} onChange={(event) => setTo(event.target.value)} className="mt-1 block h-9 rounded-lg border border-[#d5d5d5] px-2 text-sm text-[#171717]"/></label>
            <button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
          </div>
        </div>
      </div>
    </div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 flex gap-3">
        <AlertTriangle size={18} className="shrink-0 mt-0.5"/>
        <div><div className="font-semibold">General Ledger foundation is intentionally manual-only in Phase 22</div><div className="mt-1 text-xs leading-5">Existing storefront sales, Stripe activity, expenses, AR/AP and inventory are not auto-posted into this ledger yet. This prevents duplicate or fabricated accounting entries. Source-to-ledger posting will be added as a separate controlled phase.</div></div>
      </section>

      {loading ? <div className="py-16 text-center text-sm text-[#777]">Loading general ledger…</div> : <>
        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <Metric label="Journal entries" value={Number(summary.entryCount || 0).toLocaleString("en-CA")} sub={`${Number(summary.reversalEntryCount || 0)} reversal entries`}/>
          <Metric label="Total debits" value={money(summary.totalDebits)} sub="Selected ledger period"/>
          <Metric label="Total credits" value={money(summary.totalCredits)} sub="Selected ledger period"/>
          <Metric label="Difference" value={money(summary.difference)} alert={!balanced} sub={balanced ? "Debits = credits" : "Ledger imbalance detected"}/>
          <Metric label="Ledger status" value={balanced ? "Balanced" : "Attention"} alert={!balanced} strong sub="Manual journals only"/>
        </div>

        <section className={`rounded-xl border p-4 text-sm flex gap-3 ${balanced ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950"}`}>
          {balanced ? <CheckCircle2 size={18} className="shrink-0 mt-0.5"/> : <AlertTriangle size={18} className="shrink-0 mt-0.5"/>}
          <div><div className="font-semibold">{balanced ? "Trial balance is mathematically balanced" : "Trial balance is out of balance"}</div><div className="mt-1 text-xs">This verifies only journals currently posted in the Phase 22 ledger; it does not yet certify complete business financial statements.</div></div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <SectionHeader title="Post manual journal" subtitle="Admin + MFA protected. A journal posts immediately only after every account and amount passes server-side double-entry validation." icon={<ShieldCheck size={16}/>}/>
          <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-[170px_220px_minmax(0,1fr)] gap-3">
              <label className="text-xs text-[#666]">Journal date<input type="date" value={entryDate} max={reginaDate()} onChange={(event) => setEntryDate(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-[#d5d5d5] px-3 text-sm"/></label>
              <label className="text-xs text-[#666]">Reference (optional)<input value={reference} maxLength={120} onChange={(event) => setReference(event.target.value)} placeholder="Receipt, adjustment, etc." className="mt-1 block h-10 w-full rounded-lg border border-[#d5d5d5] px-3 text-sm"/></label>
              <label className="text-xs text-[#666]">Memo<input value={memo} maxLength={500} onChange={(event) => setMemo(event.target.value)} placeholder="Why this journal is being posted" className="mt-1 block h-10 w-full rounded-lg border border-[#d5d5d5] px-3 text-sm"/></label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#e3e3e3]">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Account</Th><Th>Description</Th><Th right>Debit</Th><Th right>Credit</Th><Th></Th></tr></thead>
                <tbody>{lines.map((line, index) => <tr key={`draft-${index}`} className="border-t border-[#eeeeee]">
                  <Td><select value={line.accountId} onChange={(event) => updateLine(index, "accountId", event.target.value)} className="h-9 w-full min-w-[280px] rounded-lg border border-[#d5d5d5] bg-white px-2 text-sm"><option value="">Select account</option>{postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></Td>
                  <Td><input value={line.description} maxLength={240} onChange={(event) => updateLine(index, "description", event.target.value)} placeholder="Optional line description" className="h-9 w-full min-w-[260px] rounded-lg border border-[#d5d5d5] px-2 text-sm"/></Td>
                  <Td right><input type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(index, "debit", event.target.value)} className="h-9 w-32 rounded-lg border border-[#d5d5d5] px-2 text-right text-sm" placeholder="0.00"/></Td>
                  <Td right><input type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(index, "credit", event.target.value)} className="h-9 w-32 rounded-lg border border-[#d5d5d5] px-2 text-right text-sm" placeholder="0.00"/></Td>
                  <Td><button type="button" onClick={() => removeLine(index)} disabled={lines.length <= 2} className="h-9 w-9 rounded-lg border border-[#ddd] inline-grid place-items-center disabled:opacity-30" aria-label={`Remove journal line ${index + 1}`}><Trash2 size={14}/></button></Td>
                </tr>)}</tbody>
                <tfoot className="border-t border-[#dedede] bg-[#fafafa]"><tr><Td><button type="button" onClick={addLine} disabled={lines.length >= 50} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Plus size={13}/> Add line</button></Td><Td right><span className="font-semibold">Draft totals</span></Td><Td right><span className="font-semibold">{money(draftTotals.debit)}</span></Td><Td right><span className="font-semibold">{money(draftTotals.credit)}</span></Td><Td></Td></tr></tfoot>
              </table>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className={`text-sm ${draftTotals.difference === 0 && draftTotals.debit > 0 ? "text-emerald-700" : "text-amber-700"}`}>{draftTotals.debit > 0 ? `Difference: ${money(draftTotals.difference)}` : "Enter at least one debit and one credit."}</div>
              <button type="button" onClick={recordJournal} disabled={posting || draftTotals.debit <= 0 || draftTotals.difference !== 0} className="h-10 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"><BookOpen size={15}/>{posting ? "Posting…" : "Post balanced journal"}</button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <SectionHeader title="Trial balance" subtitle={`${data?.scope?.from || from} through ${data?.scope?.to || to}. Debit and credit columns include both original and reversing journals so the audit trail nets correctly.`}/>
          <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Account</Th><Th>Type</Th><Th>Normal balance</Th><Th right>Debits</Th><Th right>Credits</Th><Th right>Ending debit</Th><Th right>Ending credit</Th></tr></thead><tbody>{trialBalance.length ? trialBalance.map((row) => <tr key={row.account_id} className="border-t border-[#eeeeee]"><Td><div className="font-semibold">{row.code} · {row.name}</div></Td><Td>{accountTypeLabel(row.account_type)}</Td><Td>{accountTypeLabel(row.normal_balance)}</Td><Td right>{money(row.debits)}</Td><Td right>{money(row.credits)}</Td><Td right strong={Number(row.ending_debit || 0) > 0}>{money(row.ending_debit)}</Td><Td right strong={Number(row.ending_credit || 0) > 0}>{money(row.ending_credit)}</Td></tr>) : <Empty cols={7}>No chart-of-accounts rows.</Empty>}</tbody><tfoot className="border-t border-[#d8d8d8] bg-[#fafafa] font-semibold"><tr><Td colSpan={3}>Totals</Td><Td right>{money(summary.totalDebits)}</Td><Td right>{money(summary.totalCredits)}</Td><Td></Td><Td></Td></tr></tfoot></table></div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <SectionHeader title="Journal register" subtitle="Posted entries cannot be edited or deleted. Reversal creates a second equal-and-opposite posted journal and links it to the original."/>
          <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th># / Date</Th><Th>Reference / Memo</Th><Th>Status</Th><Th right>Debit</Th><Th right>Credit</Th><Th>Lines</Th><Th>Correction</Th></tr></thead><tbody>{entries.length ? entries.map((entry) => {
            const canReverse = entry.source_type === "manual" && entry.status === "posted" && !entry.reversed_by_entry_id;
            return <tr key={entry.id} className="border-t border-[#eeeeee] align-top">
              <Td><div className="font-semibold">#{entry.entry_number}</div><div className="text-xs text-[#777] mt-0.5">{entry.entry_date}</div></Td>
              <Td><div className="font-medium">{entry.reference || "No reference"}</div><div className="mt-1 max-w-[360px] text-xs text-[#666] whitespace-pre-wrap">{entry.memo}</div></Td>
              <Td><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.status === "reversed" ? "bg-slate-100 text-slate-700" : entry.source_type === "reversal" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{entry.status === "reversed" ? "Reversed" : entry.source_type === "reversal" ? "Reversal" : "Posted"}</span>{entry.reversal_reason && <div className="mt-1 max-w-[220px] text-[11px] text-[#777]">{entry.reversal_reason}</div>}</Td>
              <Td right strong>{money(entry.total_debit)}</Td><Td right strong>{money(entry.total_credit)}</Td>
              <Td><details><summary className="cursor-pointer text-xs font-semibold">{Array.isArray(entry.lines) ? entry.lines.length : 0} lines</summary><div className="mt-2 min-w-[320px] space-y-1">{(entry.lines || []).map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 rounded bg-[#f8f8f8] px-2 py-1 text-[11px]"><span>{line.accountCode} · {line.accountName}{line.description ? ` — ${line.description}` : ""}</span><span>{Number(line.debit || 0) > 0 ? `Dr ${money(line.debit)}` : `Cr ${money(line.credit)}`}</span></div>)}</div></details></Td>
              <Td>{canReverse ? <div className="min-w-[310px] space-y-2"><div className="flex gap-2"><input type="date" max={reginaDate()} value={reverseDates[entry.id] || reginaDate()} onChange={(event) => setReverseDates((current) => ({ ...current, [entry.id]: event.target.value }))} className="h-8 rounded-lg border border-[#d5d5d5] px-2 text-xs"/><input value={reverseReasons[entry.id] || ""} maxLength={500} onChange={(event) => setReverseReasons((current) => ({ ...current, [entry.id]: event.target.value }))} placeholder="Required reversal reason" className="h-8 min-w-0 flex-1 rounded-lg border border-[#d5d5d5] px-2 text-xs"/></div><button type="button" onClick={() => reverseJournal(entry)} disabled={reversing === entry.id} className="h-8 px-3 rounded-lg border border-[#cfcfcf] bg-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><RotateCcw size={12}/>{reversing === entry.id ? "Reversing…" : "Post reversal"}</button></div> : <span className="text-xs text-[#888]">{entry.source_type === "reversal" ? "Reversal entry" : "No further action"}</span>}</Td>
            </tr>;
          }) : <Empty cols={7}>No journals posted in this date range.</Empty>}</tbody></table></div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <SectionHeader title="GDP chart of accounts" subtitle="System account structure for the accounting ledger. Account maintenance is locked in Phase 22 so the foundation cannot be casually reclassified."/>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Code</Th><Th>Account</Th><Th>Type</Th><Th>Normal balance</Th><Th>Manual posting</Th></tr></thead><tbody>{accounts.length ? accounts.map((account) => <tr key={account.id} className="border-t border-[#eeeeee]"><Td><span className="font-mono font-semibold">{account.code}</span></Td><Td><span className="font-semibold">{account.name}</span></Td><Td>{accountTypeLabel(account.accountType)}</Td><Td>{accountTypeLabel(account.normalBalance)}</Td><Td>{account.manualPostingAllowed ? "Allowed" : "System only"}</Td></tr>) : <Empty cols={5}>No Finance accounts configured.</Empty>}</tbody></table></div>
        </section>
      </>}
    </main>
  </div>;
}

function Metric({ label, value, sub, alert = false, strong = false }) {
  return <div className={`rounded-xl border bg-white p-4 ${alert ? "border-amber-300" : "border-[#dedede]"}`}><div className="text-xs text-[#777]">{label}</div><div className={`mt-1 text-xl ${strong ? "font-bold" : "font-semibold"} ${alert ? "text-amber-800" : ""}`}>{value}</div><div className="mt-1 text-[11px] text-[#888]">{sub}</div></div>;
}

function SectionHeader({ title, subtitle, icon = null }) {
  return <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold flex items-center gap-2">{icon}{title}</div><div className="text-xs text-[#777] mt-0.5">{subtitle}</div></div>;
}

function Th({ children, right = false }) { return <th className={`px-3 py-2.5 font-semibold ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false, colSpan }) { return <td colSpan={colSpan} className={`px-3 py-3 ${right ? "text-right" : "text-left"} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ children, cols }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
