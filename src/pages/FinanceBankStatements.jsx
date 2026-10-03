import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, LockKeyhole, RefreshCw, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { adminBankStatementApi } from "@/lib/adminBankStatementApi";

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function monthStartValue(date = new Date()) {
  const next = new Date(date);
  next.setDate(1);
  return localDateValue(next);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function displayDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function periodLabel(row) {
  return `${displayDate(row.period_start)} – ${displayDate(row.period_end)}`;
}

export default function FinanceBankStatements() {
  const today = localDateValue();
  const [data, setData] = useState({ metrics: {}, statements: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openForm, setOpenForm] = useState({ periodStart: monthStartValue(), periodEnd: today, openingBalance: "0", notes: "" });
  const [closeForms, setCloseForms] = useState({});
  const [reopenReasons, setReopenReasons] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminBankStatementApi.load({ limit: 200 }));
    } catch (err) {
      console.error("Bank statement close load failed:", err);
      setError(err?.message || "Could not load bank statement periods.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statements = Array.isArray(data?.statements) ? data.statements : [];
  const metrics = data?.metrics || {};
  const openStatements = useMemo(() => statements.filter((row) => row.status === "open"), [statements]);
  const closedStatements = useMemo(() => statements.filter((row) => row.status === "closed"), [statements]);

  const run = async (key, action, successMessage) => {
    setSaving(key);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      await load();
      return true;
    } catch (err) {
      setError(err?.message || "Bank statement action failed.");
      return false;
    } finally {
      setSaving("");
    }
  };

  const openPeriod = async () => {
    const ok = await run("open", () => adminBankStatementApi.open(openForm), "Bank statement period opened.");
    if (ok) setOpenForm({ periodStart: monthStartValue(), periodEnd: today, openingBalance: "0", notes: "" });
  };

  const closePeriod = async (row) => {
    const form = closeForms[row.id] || { statementClosingBalance: "", closeNotes: "" };
    if (form.statementClosingBalance === "") {
      setError("Enter the real closing balance printed on the bank statement.");
      return;
    }
    await run(`close-${row.id}`, () => adminBankStatementApi.close({ reconciliationId: row.id, ...form }), "Bank statement reconciled and period locked.");
  };

  const reopenPeriod = async (row) => {
    const reason = String(reopenReasons[row.id] || "").trim();
    if (!reason) {
      setError("Enter a reason before reopening a closed bank period.");
      return;
    }
    const ok = await run(`reopen-${row.id}`, () => adminBankStatementApi.reopen({ reconciliationId: row.id, reason }), "Bank statement period reopened for correction.");
    if (ok) setReopenReasons((current) => ({ ...current, [row.id]: "" }));
  };

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
        <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><LockKeyhole size={16}/> Bank Statement Close</div>
        <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
      </div>
    </header>

    <div className="border-b border-[#dedfe3] bg-white"><div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7"><div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 13</div><div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Bank Statement Period Close</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Reconcile the bank ledger to the real statement ending balance. A period can close only at a $0.00 difference, then GDP Finance locks bank activity in that date range until an audited reopen.</p></div><div className="flex flex-wrap gap-2"><Link to="/admin/finance/bank-reconciliation" className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2"><Banknote size={14}/> Bank ledger</Link><Link to="/admin/finance/bank-import" className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2">CSV import</Link><button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button></div></div></div></div>

    <main className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Closed means locked</div><div className="mt-1 text-xs">After a period closes, manual bank entries, CSV imports, and voids dated inside that period are blocked server-side. Reopen requires a reason and keeps the prior close snapshot in the audit trail.</div></div></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="Open periods" value={loading ? "—" : String(metrics.openCount || 0)}/><Metric label="Closed periods" value={loading ? "—" : String(metrics.closedCount || 0)} strong/><Metric label="Locked entries" value={loading ? "—" : String(metrics.lockedEntryCount || 0)}/><Metric label="Latest closed through" value={loading ? "—" : displayDate(metrics.latestClosedPeriodEnd)}/></div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Open statement period</div><div className="text-xs text-[#777] mt-0.5">Periods cannot overlap. Enter the opening balance from the bank statement.</div></div><div className="p-4 grid md:grid-cols-2 lg:grid-cols-[170px_170px_170px_1fr_auto] gap-3 items-end"><Field label="Start"><input type="date" max={today} value={openForm.periodStart} onChange={(e) => setOpenForm((current) => ({ ...current, periodStart: e.target.value }))} className="input-control"/></Field><Field label="End"><input type="date" max={today} value={openForm.periodEnd} onChange={(e) => setOpenForm((current) => ({ ...current, periodEnd: e.target.value }))} className="input-control"/></Field><MoneyField label="Opening balance" value={openForm.openingBalance} onChange={(value) => setOpenForm((current) => ({ ...current, openingBalance: value }))}/><Field label="Notes"><input maxLength={1000} value={openForm.notes} onChange={(e) => setOpenForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Optional statement/account note" className="input-control"/></Field><button type="button" onClick={openPeriod} disabled={saving === "open"} className="h-10 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"><Save size={14}/>{saving === "open" ? "Opening…" : "Open period"}</button></div></section>

      {openStatements.map((row) => {
        const form = closeForms[row.id] || { statementClosingBalance: "", closeNotes: "" };
        const actual = form.statementClosingBalance === "" ? null : Number(form.statementClosingBalance);
        const difference = actual === null || !Number.isFinite(actual) ? null : Math.round((actual - Number(row.calculated_closing_balance || 0)) * 100) / 100;
        const reconciled = difference !== null && Math.abs(difference) < 0.005;
        return <section key={row.id} className="rounded-xl border border-amber-200 bg-white overflow-hidden"><div className="px-4 py-3 border-b border-amber-100 bg-amber-50 flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-semibold">Open · {periodLabel(row)}</div><div className="text-xs text-amber-900/70 mt-0.5">Live totals update from active bank entries until the period is closed.</div></div><Badge tone="amber">Open</Badge></div><div className="p-4 space-y-4"><div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3"><Metric label="Opening" value={money(row.opening_balance)}/><Metric label="Credits" value={money(row.credit_total)}/><Metric label="Debits" value={money(row.debit_total)}/><Metric label="Entries" value={String(row.entry_count || 0)}/><Metric label="Book closing" value={money(row.calculated_closing_balance)} strong/><Metric label="Difference" value={difference === null ? "Enter closing balance" : money(difference)} strong={reconciled}/></div><div className="grid md:grid-cols-[190px_1fr_auto] gap-3 items-end"><MoneyField label="Real statement closing balance" value={form.statementClosingBalance} onChange={(value) => setCloseForms((current) => ({ ...current, [row.id]: { ...form, statementClosingBalance: value } }))}/><Field label="Close note"><input maxLength={1000} value={form.closeNotes} onChange={(e) => setCloseForms((current) => ({ ...current, [row.id]: { ...form, closeNotes: e.target.value } }))} placeholder="Optional reconciliation note" className="input-control"/></Field><button type="button" onClick={() => closePeriod(row)} disabled={!reconciled || saving === `close-${row.id}`} className="h-10 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40"><LockKeyhole size={14}/>{saving === `close-${row.id}` ? "Closing…" : "Close & lock"}</button></div>{difference !== null && !reconciled && <div className="text-xs text-amber-800">Difference must be exactly {money(0)} before this statement can close. Add, import, or correct bank entries first.</div>}</div></section>;
      })}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Closed statement periods</div><div className="text-xs text-[#777] mt-0.5">Closed periods use frozen credit/debit snapshots and lock their bank activity dates.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Period</Th><Th right>Opening</Th><Th right>Credits</Th><Th right>Debits</Th><Th right>Closing</Th><Th right>Entries</Th><Th>Status</Th><Th>Reopen</Th></tr></thead><tbody>{loading ? <Empty cols={8}>Loading statement periods…</Empty> : closedStatements.length ? closedStatements.map((row) => <tr key={row.id} className="border-t border-[#eeeeee]"><Td strong>{periodLabel(row)}</Td><Td right>{money(row.opening_balance)}</Td><Td right>{money(row.credit_total)}</Td><Td right>{money(row.debit_total)}</Td><Td right strong>{money(row.statement_closing_balance)}</Td><Td right>{row.entry_count}</Td><Td><div className="space-y-1"><Badge tone="green">Locked</Badge><div className="text-[11px] text-[#777]">{row.closed_at ? new Date(row.closed_at).toLocaleString("en-CA") : "—"}</div></div></Td><Td><div className="flex min-w-[300px] gap-2"><input maxLength={500} value={reopenReasons[row.id] || ""} onChange={(e) => setReopenReasons((current) => ({ ...current, [row.id]: e.target.value }))} placeholder="Required reason" className="h-8 min-w-0 flex-1 rounded-md border border-[#d8d8d8] px-2 text-xs"/><button type="button" onClick={() => reopenPeriod(row)} disabled={saving === `reopen-${row.id}`} className="h-8 px-3 rounded-md border border-[#cfcfcf] bg-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"><RotateCcw size={12}/>{saving === `reopen-${row.id}` ? "Reopening…" : "Reopen"}</button></div></Td></tr>) : <Empty cols={8}>No closed bank statement periods yet.</Empty>}</tbody></table></div></section>
    </main>
  </div>;
}

function Field({ label, children }) { return <label className="block"><div className="text-xs font-medium text-[#555] mb-1.5">{label}</div>{children}</label>; }
function MoneyField({ label, value, onChange }) { return <Field label={label}><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[#777]">$</span><input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className="input-control pl-7"/></div></Field>; }
function Metric({ label, value, strong = false }) { return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div></div>; }
function Badge({ children, tone = "neutral" }) { const cls = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[#d8d8d8] bg-[#f7f7f7] text-[#555]"; return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>; }
function Th({ children, right = false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-3 py-3 align-top ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
