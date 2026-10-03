import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, Plus, RefreshCw, ShieldCheck, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { adminBankReconciliationApi } from "@/lib/adminBankReconciliationApi";

const RANGE_OPTIONS = [
  ["today", "Today"], ["7d", "7 days"], ["30d", "30 days"],
  ["month", "This month"], ["year", "This year"], ["all", "All time"],
];

const SOURCE_TYPES = [
  ["stripe_payout", "Stripe payout"],
  ["cash_deposit", "Cash deposit"],
  ["e_transfer", "e-Transfer deposit"],
  ["terminal_deposit", "Debit / card terminal deposit"],
  ["cheque", "Cheque"],
  ["expense", "Expense / withdrawal"],
  ["other", "Other bank activity"],
];

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function rangeDates(range) {
  if (range === "all") return { from: null, to: null };
  const end = new Date();
  const start = new Date();
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  if (range === "month") start.setDate(1);
  if (range === "year") start.setMonth(0, 1);
  return { from: localDateValue(start), to: localDateValue(end) };
}

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function sourceLabel(value) {
  return SOURCE_TYPES.find(([id]) => id === value)?.[1] || String(value || "Other").replaceAll("_", " ");
}

function displayDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function blankEntry() {
  return {
    occurredOn: localDateValue(), direction: "credit", amount: "", description: "",
    reference: "", sourceType: "other", sourceReference: "", expectedAmount: "", notes: "",
  };
}

export default function FinanceBankReconciliation() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState({ metrics: {}, entries: [], unmatchedStripePayouts: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(blankEntry());
  const [voidReasons, setVoidReasons] = useState({});

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminBankReconciliationApi.load({ ...rangeDates(selectedRange), limit: 1000 }));
    } catch (err) {
      console.error("Bank reconciliation load failed:", err);
      setError(err?.message || "Could not load bank reconciliation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const metrics = data?.metrics || {};
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const payouts = Array.isArray(data?.unmatchedStripePayouts) ? data.unmatchedStripePayouts : [];
  const events = Array.isArray(data?.events) ? data.events : [];
  const active = useMemo(() => entries.filter((row) => row.status === "active"), [entries]);
  const voided = useMemo(() => entries.filter((row) => row.status === "voided"), [entries]);

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
      setError(err?.message || "Bank reconciliation action failed.");
      return false;
    } finally {
      setSaving("");
    }
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    const ok = await run("create", () => adminBankReconciliationApi.create(form), "Bank entry recorded and added to reconciliation history.");
    if (ok) {
      setForm(blankEntry());
      setShowCreate(false);
    }
  };

  const voidEntry = async (row) => {
    const reason = String(voidReasons[row.id] || "").trim();
    if (!reason) {
      setError("Enter a reason before voiding a bank entry.");
      return;
    }
    const ok = await run(`void-${row.id}`, () => adminBankReconciliationApi.void(row.id, reason), "Bank entry voided. The audit history is preserved.");
    if (ok) setVoidReasons((current) => ({ ...current, [row.id]: "" }));
  };

  const usePayout = (payout) => {
    setForm({
      occurredOn: payout.arrival_date || localDateValue(),
      direction: "credit",
      amount: String(payout.amount ?? ""),
      description: `Stripe payout ${payout.stripe_payout_id}`,
      reference: payout.stripe_payout_id,
      sourceType: "stripe_payout",
      sourceReference: payout.stripe_payout_id,
      expectedAmount: String(payout.amount ?? ""),
      notes: "",
    });
    setShowCreate(true);
    setError("");
    setNotice("");
  };

  const setSourceType = (sourceType) => {
    setForm((current) => ({
      ...current,
      sourceType,
      direction: sourceType === "stripe_payout" ? "credit" : current.direction,
      sourceReference: "",
      expectedAmount: "",
    }));
  };

  const selectedPayout = payouts.find((payout) => payout.stripe_payout_id === form.sourceReference);
  const expected = form.sourceType === "stripe_payout" ? Number(selectedPayout?.amount || form.expectedAmount || 0) : Number(form.expectedAmount || 0);
  const amount = Number(form.amount || 0);
  const previewVariance = form.expectedAmount === "" && form.sourceType !== "stripe_payout" ? null : amount - expected;

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
        <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><Banknote size={16} /> Bank Reconciliation</div>
        <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15} /> Finance</Link>
      </div>
    </header>

    <div className="border-b border-[#dedfe3] bg-white">
      <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
        <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 11</div>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Bank & Deposit Reconciliation</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Record the transactions that actually reached the business bank account and compare them with expected deposits. Stripe payouts can be matched directly without changing checkout, payment capture, or payout creation.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap rounded-lg border border-[#d9d9d9] bg-white p-1">{RANGE_OPTIONS.map(([id, label]) => <button key={id} type="button" onClick={() => setRange(id)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${range === id ? "bg-[#171717] text-white" : "text-[#666] hover:bg-[#f2f2f2]"}`}>{label}</button>)}</div>
            <button type="button" onClick={() => load()} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
            <button type="button" onClick={() => setShowCreate((value) => !value)} className="h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2"><Plus size={15} /> Bank entry</button>
          </div>
        </div>
      </div>
    </div>

    <main className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Bookkeeping reconciliation only</div><div className="mt-1 text-xs">This page does not connect to your bank, move money, create Stripe payouts, charge customers, or change orders. Enter only activity visible on your real business bank statement. Mistakes are voided with a reason instead of deleted.</div></div></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Metric label="Bank entries" value={loading ? "—" : String(metrics.activeCount || 0)} />
        <Metric label="Credits" value={loading ? "—" : money(metrics.creditTotal)} strong />
        <Metric label="Debits" value={loading ? "—" : money(metrics.debitTotal)} />
        <Metric label="Matched" value={loading ? "—" : String(metrics.matchedCount || 0)} />
        <Metric label="Needs review" value={loading ? "—" : String(metrics.reviewCount || 0)} />
        <Metric label="Unmatched Stripe" value={loading ? "—" : `${metrics.unmatchedStripePayoutCount || 0} · ${money(metrics.unmatchedStripePayoutAmount)}`} />
      </div>

      {showCreate && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Record bank statement entry</div><div className="text-xs text-[#777] mt-0.5">Expected amount is optional except Stripe payouts, where GDP Finance uses the synced payout amount automatically.</div></div>
        <form onSubmit={saveEntry} className="p-4 space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Bank date"><input type="date" max={localDateValue()} required value={form.occurredOn} onChange={(e) => setForm((current) => ({ ...current, occurredOn: e.target.value }))} className="input-control" /></Field>
            <Field label="Direction"><select value={form.direction} disabled={form.sourceType === "stripe_payout"} onChange={(e) => setForm((current) => ({ ...current, direction: e.target.value }))} className="input-control"><option value="credit">Credit / money in</option><option value="debit">Debit / money out</option></select></Field>
            <MoneyField label="Bank amount" required value={form.amount} onChange={(value) => setForm((current) => ({ ...current, amount: value }))} />
            <Field label="Source"><select value={form.sourceType} onChange={(e) => setSourceType(e.target.value)} className="input-control">{SOURCE_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <Field label="Description"><input required maxLength={500} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} placeholder="Bank statement description" className="input-control" /></Field>
            <Field label="Bank reference"><input maxLength={200} value={form.reference} onChange={(e) => setForm((current) => ({ ...current, reference: e.target.value }))} placeholder="Confirmation, trace, deposit slip, etc." className="input-control" /></Field>
          </div>

          {form.sourceType === "stripe_payout" ? <div className="grid lg:grid-cols-[1fr_180px_180px] gap-3 items-end">
            <Field label="Unmatched Stripe payout"><select required value={form.sourceReference} onChange={(e) => { const payout = payouts.find((item) => item.stripe_payout_id === e.target.value); setForm((current) => ({ ...current, sourceReference: e.target.value, expectedAmount: payout ? String(payout.amount) : "" })); }} className="input-control"><option value="">Choose payout</option>{payouts.map((payout) => <option key={payout.stripe_payout_id} value={payout.stripe_payout_id}>{payout.stripe_payout_id} · {money(payout.amount)} · {payout.arrival_date || "no arrival date"}</option>)}</select></Field>
            <Readout label="Expected" value={selectedPayout ? money(selectedPayout.amount) : "—"} />
            <Readout label="Difference" value={previewVariance === null ? "—" : money(previewVariance)} />
          </div> : <div className="grid lg:grid-cols-[1fr_180px_180px] gap-3 items-end">
            <Field label="Source reference"><input maxLength={200} value={form.sourceReference} onChange={(e) => setForm((current) => ({ ...current, sourceReference: e.target.value }))} placeholder="Sale batch, deposit slip, invoice, etc." className="input-control" /></Field>
            <MoneyField label="Expected amount" value={form.expectedAmount} onChange={(value) => setForm((current) => ({ ...current, expectedAmount: value }))} />
            <Readout label="Difference" value={previewVariance === null ? "Not compared" : money(previewVariance)} />
          </div>}

          <Field label="Notes"><input maxLength={1000} value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Optional reconciliation note" className="input-control" /></Field>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="h-9 px-3 rounded-lg border border-[#d8d8d8] bg-white text-sm">Cancel</button><button type="submit" disabled={saving === "create"} className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-60">{saving === "create" ? "Saving…" : "Save bank entry"}</button></div>
        </form>
      </section>}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ededed] flex items-center justify-between gap-3"><div><div className="text-sm font-semibold">Unmatched paid Stripe payouts</div><div className="text-xs text-[#777] mt-0.5">Synced live payouts that do not yet have an active bank match in the selected period.</div></div><Badge tone={payouts.length ? "amber" : "green"}>{payouts.length} open</Badge></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Arrival</Th><Th>Payout ID</Th><Th right>Expected</Th><Th>Method</Th><Th>Action</Th></tr></thead><tbody>{loading ? <Empty cols={5}>Loading payouts…</Empty> : payouts.length ? payouts.map((payout) => <tr key={payout.stripe_payout_id} className="border-t border-[#eeeeee]"><Td>{displayDate(payout.arrival_date)}</Td><Td><code className="text-xs">{payout.stripe_payout_id}</code></Td><Td right strong>{money(payout.amount)}</Td><Td>{payout.method || "—"}</Td><Td><button type="button" onClick={() => usePayout(payout)} className="h-8 px-3 rounded-md border border-[#d8d8d8] bg-white text-xs font-semibold">Match bank entry</button></Td></tr>) : <Empty cols={5}>No unmatched paid Stripe payouts in this period.</Empty>}</tbody></table></div>
      </section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Active bank entries</div><div className="text-xs text-[#777] mt-0.5">Matched means the bank amount is within one cent of the expected amount. “Recorded” means no expected amount was supplied.</div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1380px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Direction</Th><Th>Source</Th><Th>Description / reference</Th><Th right>Bank amount</Th><Th right>Expected</Th><Th right>Difference</Th><Th>Status</Th><Th>Audit action</Th></tr></thead><tbody>
          {loading ? <Empty cols={9}>Loading bank entries…</Empty> : active.length ? active.map((row) => <tr key={row.id} className="border-t border-[#eeeeee]"><Td strong>{displayDate(row.occurred_on)}</Td><Td><Badge tone={row.direction === "credit" ? "green" : "neutral"}>{row.direction === "credit" ? "Credit" : "Debit"}</Badge></Td><Td><div>{sourceLabel(row.source_type)}</div>{row.source_reference && <div className="text-[11px] text-[#777] mt-0.5 max-w-[180px] truncate" title={row.source_reference}>{row.source_reference}</div>}</Td><Td><div className="font-medium max-w-[280px]">{row.description}</div><div className="text-xs text-[#777] mt-0.5">{row.reference || "—"}</div></Td><Td right strong>{money(row.amount)}</Td><Td right>{row.expected_amount == null ? "—" : money(row.expected_amount)}</Td><Td right>{row.variance == null ? "—" : money(row.variance)}</Td><Td><MatchBadge status={row.match_status}/></Td><Td><div className="flex gap-2 min-w-[270px]"><input value={voidReasons[row.id] || ""} onChange={(e) => setVoidReasons((current) => ({ ...current, [row.id]: e.target.value }))} maxLength={500} placeholder="Reason to void" className="h-8 flex-1 rounded-md border border-[#d8d8d8] px-2 text-xs"/><button type="button" onClick={() => voidEntry(row)} disabled={saving === `void-${row.id}` || !String(voidReasons[row.id] || "").trim()} className="h-8 px-2.5 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Undo2 size={12}/>{saving === `void-${row.id}` ? "Voiding…" : "Void"}</button></div></Td></tr>) : <Empty cols={9}>No bank entries in this period.</Empty>}
        </tbody></table></div>
      </section>

      {voided.length > 0 && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Voided bank-entry history</div><div className="text-xs text-[#777] mt-0.5">Preserved for audit; voided entries are excluded from live reconciliation totals and free their Stripe payout for rematching.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Description</Th><Th right>Amount</Th><Th>Voided</Th><Th>Reason</Th></tr></thead><tbody>{voided.map((row) => <tr key={row.id} className="border-t border-[#eeeeee] text-[#666]"><Td>{displayDate(row.occurred_on)}</Td><Td>{row.description}</Td><Td right>{money(row.amount)}</Td><Td>{row.voided_at ? new Date(row.voided_at).toLocaleString("en-CA") : "—"}</Td><Td>{row.void_reason || "—"}</Td></tr>)}</tbody></table></div></section>}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Recent bank reconciliation audit events</div><div className="text-xs text-[#777] mt-0.5">Created and voided events are append-only.</div></div><div className="divide-y divide-[#eeeeee]">{events.length ? events.slice(0, 30).map((event) => <div key={event.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm"><span className="font-semibold capitalize min-w-20">{event.event_type}</span><span className="text-[#555] flex-1">{event.reason || "Bank entry recorded"}</span><span className="text-xs text-[#888]">{event.created_at ? new Date(event.created_at).toLocaleString("en-CA") : ""}</span></div>) : <div className="px-4 py-8 text-center text-sm text-[#777]">No bank reconciliation events in this period.</div>}</div></section>
    </main>
  </div>;
}

function Field({ label, children }) { return <label className="block"><div className="text-xs font-medium text-[#555] mb-1.5">{label}</div>{children}</label>; }
function MoneyField({ label, value, onChange, required = false }) { return <Field label={label}><input type="number" min="0" step="0.01" inputMode="decimal" required={required} value={value} onChange={(e) => onChange(e.target.value)} className="input-control text-right" /></Field>; }
function Readout({ label, value }) { return <div><div className="text-xs font-medium text-[#555] mb-1.5">{label}</div><div className="h-10 rounded-lg border border-[#d8d8d8] bg-[#fafafa] px-3 grid items-center text-right text-sm font-semibold tabular-nums">{value}</div></div>; }
function Metric({ label, value, strong = false }) { return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div></div>; }
function Badge({ children, tone = "neutral" }) { const cls = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[#d8d8d8] bg-[#f7f7f7] text-[#555]"; return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>; }
function MatchBadge({ status }) { if (status === "matched") return <Badge tone="green">Matched</Badge>; if (status === "review") return <Badge tone="amber">Review</Badge>; return <Badge>Recorded</Badge>; }
function Th({ children, right = false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-3 py-3 align-top ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
