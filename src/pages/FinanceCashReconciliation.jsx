import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, LockKeyhole, Plus, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { adminCashReconciliationApi } from "@/lib/adminCashReconciliationApi";

const RANGE_OPTIONS = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["year", "This year"],
  ["all", "All time"],
];

const ADJUSTMENT_TYPES = [
  ["refund", "Cash refund"],
  ["cash_in", "Cash in"],
  ["cash_out", "Cash out"],
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

function displayDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function adjustmentLabel(value) {
  return ADJUSTMENT_TYPES.find(([id]) => id === value)?.[1] || String(value || "").replaceAll("_", " ");
}

function blankAdjustment() {
  return { type: "refund", amount: "", reason: "", reference: "" };
}

export default function FinanceCashReconciliation() {
  const today = localDateValue();
  const [range, setRange] = useState("month");
  const [data, setData] = useState({ metrics: {}, reconciliations: [], adjustments: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openForm, setOpenForm] = useState({ businessDate: today, openingCash: "0", notes: "" });
  const [adjustmentForms, setAdjustmentForms] = useState({});
  const [closeForms, setCloseForms] = useState({});
  const [reopenReasons, setReopenReasons] = useState({});

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminCashReconciliationApi.load({ ...rangeDates(selectedRange), limit: 366 }));
    } catch (err) {
      console.error("Cash reconciliation load failed:", err);
      setError(err?.message || "Could not load cash reconciliation records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const reconciliations = Array.isArray(data?.reconciliations) ? data.reconciliations : [];
  const adjustments = Array.isArray(data?.adjustments) ? data.adjustments : [];
  const metrics = data?.metrics || {};
  const openDays = useMemo(() => reconciliations.filter((row) => row.status === "open"), [reconciliations]);
  const closedDays = useMemo(() => reconciliations.filter((row) => row.status === "closed"), [reconciliations]);

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
      setError(err?.message || "Cash reconciliation action failed.");
      return false;
    } finally {
      setSaving("");
    }
  };

  const openDay = async () => {
    const ok = await run("open", () => adminCashReconciliationApi.openDay(openForm), "Cash reconciliation opened.");
    if (ok) setOpenForm({ businessDate: today, openingCash: "0", notes: "" });
  };

  const addAdjustment = async (row) => {
    const form = adjustmentForms[row.id] || blankAdjustment();
    const ok = await run(`adjust-${row.id}`, () => adminCashReconciliationApi.addAdjustment({ reconciliationId: row.id, ...form }), "Cash adjustment recorded.");
    if (ok) setAdjustmentForms((current) => ({ ...current, [row.id]: blankAdjustment() }));
  };

  const closeDay = async (row) => {
    const form = closeForms[row.id] || { actualCash: "", notes: "" };
    if (form.actualCash === "") {
      setError("Count the actual cash before closing the day.");
      return;
    }
    const ok = await run(`close-${row.id}`, () => adminCashReconciliationApi.closeDay({ reconciliationId: row.id, ...form }), "Cash day closed and variance snapshot saved.");
    if (ok) setCloseForms((current) => ({ ...current, [row.id]: { actualCash: "", notes: "" } }));
  };

  const reopenDay = async (row) => {
    const reason = reopenReasons[row.id] || "";
    const ok = await run(`reopen-${row.id}`, () => adminCashReconciliationApi.reopenDay({ reconciliationId: row.id, reason }), "Cash day reopened for correction.");
    if (ok) setReopenReasons((current) => ({ ...current, [row.id]: "" }));
  };

  return (
    <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
        <div className="h-full px-3 md:px-5 flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div>
            <div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div>
          </Link>
          <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><Banknote size={16} /> Cash Reconciliation</div>
          <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15} /> Finance</Link>
        </div>
      </header>

      <div className="border-b border-[#dedfe3] bg-white">
        <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
          <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">GDP Commerce Admin</div>
          <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Cash Register Reconciliation</h1>
              <p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Compare opening cash plus real cash activity against the physical amount counted at close. Closed days are snapshotted for an auditable cash trail.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap rounded-lg border border-[#d9d9d9] bg-white p-1">
                {RANGE_OPTIONS.map(([id, label]) => <button key={id} type="button" onClick={() => setRange(id)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${range === id ? "bg-[#171717] text-white" : "text-[#666] hover:bg-[#f2f2f2]"}`}>{label}</button>)}
              </div>
              <button type="button" onClick={() => load()} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div className="font-semibold">Cash-only control</div>
          <div className="mt-1 text-xs">Cash sales come from Local Sales marked Cash. Cash expenses come from Finance expenses whose payment method is Cash. Stripe, e-Transfer, debit and card-terminal sales do not enter the cash drawer. Use Cash refund / Cash in / Cash out only for real physical cash movements not already recorded elsewhere.</div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Metric label="Open days" value={loading ? "—" : String(metrics.openDays || 0)} />
          <Metric label="Closed days" value={loading ? "—" : String(metrics.closedDays || 0)} />
          <Metric label="Net variance" value={loading ? "—" : money(metrics.closedVariance)} strong />
          <Metric label="Shortages" value={loading ? "—" : money(metrics.shortageTotal)} />
          <Metric label="Overages" value={loading ? "—" : money(metrics.overageTotal)} />
        </div>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed] flex items-center gap-2"><Plus size={16} /><div><div className="text-sm font-semibold">Open a cash day</div><div className="text-xs text-[#777] mt-0.5">One cash reconciliation is allowed per business date.</div></div></div>
          <div className="p-4 grid md:grid-cols-[180px_180px_1fr_auto] gap-3 items-end">
            <Field label="Business date"><input type="date" max={today} value={openForm.businessDate} onChange={(e) => setOpenForm((current) => ({ ...current, businessDate: e.target.value }))} className="input-control" /></Field>
            <MoneyField label="Opening cash" value={openForm.openingCash} onChange={(value) => setOpenForm((current) => ({ ...current, openingCash: value }))} />
            <Field label="Opening note (optional)"><input value={openForm.notes} maxLength={1000} onChange={(e) => setOpenForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Float, register note, or shift detail" className="input-control" /></Field>
            <button type="button" onClick={openDay} disabled={saving === "open"} className="h-10 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"><Save size={14} /> {saving === "open" ? "Opening…" : "Open day"}</button>
          </div>
        </section>

        {openDays.map((row) => {
          const adj = adjustmentForms[row.id] || blankAdjustment();
          const close = closeForms[row.id] || { actualCash: "", notes: "" };
          const rowAdjustments = adjustments.filter((item) => item.reconciliation_id === row.id);
          const predictedVariance = close.actualCash === "" ? null : Number(close.actualCash) - Number(row.expected_cash || 0);
          return <section key={row.id} className="rounded-xl border border-amber-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-100 bg-amber-50 flex flex-wrap items-center justify-between gap-2"><div><div className="text-sm font-semibold">Open cash day · {displayDate(row.business_date)}</div><div className="text-xs text-amber-900/70 mt-0.5">Expected cash updates from live cash sales, cash expenses and adjustments until you close the day.</div></div><Badge tone="amber">Open</Badge></div>
            <div className="p-4 space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <Metric label="Opening" value={money(row.opening_cash)} />
                <Metric label="Cash sales" value={money(row.cash_sales)} />
                <Metric label="Cash refunds" value={`−${money(row.cash_refunds)}`} />
                <Metric label="Cash expenses" value={`−${money(row.cash_expenses)}`} />
                <Metric label="Other cash movement" value={money(Number(row.cash_in || 0) - Number(row.cash_out || 0))} />
                <Metric label="Expected cash" value={money(row.expected_cash)} strong />
              </div>

              <div className="rounded-lg border border-[#e4e4e4] p-3">
                <div className="text-sm font-semibold mb-3">Add physical cash movement</div>
                <div className="grid md:grid-cols-[160px_140px_1fr_180px_auto] gap-3 items-end">
                  <Field label="Type"><select value={adj.type} onChange={(e) => setAdjustmentForms((current) => ({ ...current, [row.id]: { ...adj, type: e.target.value } }))} className="input-control">{ADJUSTMENT_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
                  <MoneyField label="Amount" value={adj.amount} onChange={(value) => setAdjustmentForms((current) => ({ ...current, [row.id]: { ...adj, amount: value } }))} />
                  <Field label="Reason"><input value={adj.reason} maxLength={500} onChange={(e) => setAdjustmentForms((current) => ({ ...current, [row.id]: { ...adj, reason: e.target.value } }))} placeholder="Required reason" className="input-control" /></Field>
                  <Field label="Reference"><input value={adj.reference} maxLength={100} onChange={(e) => setAdjustmentForms((current) => ({ ...current, [row.id]: { ...adj, reference: e.target.value } }))} placeholder="Optional" className="input-control" /></Field>
                  <button type="button" onClick={() => addAdjustment(row)} disabled={saving === `adjust-${row.id}`} className="h-10 px-3 rounded-lg border border-[#cfcfcf] bg-white text-sm font-semibold disabled:opacity-60">{saving === `adjust-${row.id}` ? "Adding…" : "Add"}</button>
                </div>
                {rowAdjustments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{rowAdjustments.map((item) => <span key={item.id} className="rounded-full border border-[#dedede] bg-[#fafafa] px-2.5 py-1 text-xs">{adjustmentLabel(item.adjustment_type)} {money(item.amount)} · {item.reason}</span>)}</div>}
              </div>

              <div className="rounded-lg border border-[#e4e4e4] bg-[#fafafa] p-3">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2"><LockKeyhole size={14} /> Close cash day</div>
                <div className="grid md:grid-cols-[170px_1fr_180px_auto] gap-3 items-end">
                  <MoneyField label="Actual cash counted" value={close.actualCash} onChange={(value) => setCloseForms((current) => ({ ...current, [row.id]: { ...close, actualCash: value } }))} />
                  <Field label="Close note (optional)"><input value={close.notes} maxLength={1000} onChange={(e) => setCloseForms((current) => ({ ...current, [row.id]: { ...close, notes: e.target.value } }))} placeholder="Explain count or discrepancy" className="input-control" /></Field>
                  <div><div className="text-xs font-medium text-[#555] mb-1.5">Projected variance</div><div className={`h-10 rounded-lg border bg-white px-3 grid items-center text-sm font-semibold tabular-nums ${predictedVariance !== null && predictedVariance < 0 ? "text-red-700" : predictedVariance !== null && predictedVariance > 0 ? "text-amber-700" : "text-[#222]"}`}>{predictedVariance === null || !Number.isFinite(predictedVariance) ? "—" : money(predictedVariance)}</div></div>
                  <button type="button" onClick={() => closeDay(row)} disabled={saving === `close-${row.id}`} className="h-10 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-60">{saving === `close-${row.id}` ? "Closing…" : "Close day"}</button>
                </div>
              </div>
            </div>
          </section>;
        })}

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Closed cash history</div><div className="text-xs text-[#777] mt-0.5">Closed figures are frozen snapshots. Reopening requires a reason and returns the day to live calculation.</div></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-sm">
              <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th right>Opening</Th><Th right>Cash sales</Th><Th right>Refunds</Th><Th right>Expenses</Th><Th right>Cash in/out</Th><Th right>Expected</Th><Th right>Actual</Th><Th right>Variance</Th><Th>Correction</Th></tr></thead>
              <tbody>{loading ? <Empty cols={10}>Loading cash history…</Empty> : closedDays.length ? closedDays.map((row) => <tr key={row.id} className="border-t border-[#eeeeee]"><Td strong>{displayDate(row.business_date)}</Td><Td right>{money(row.opening_cash)}</Td><Td right>{money(row.cash_sales)}</Td><Td right>{money(row.cash_refunds)}</Td><Td right>{money(row.cash_expenses)}</Td><Td right>{money(Number(row.cash_in || 0) - Number(row.cash_out || 0))}</Td><Td right>{money(row.expected_cash)}</Td><Td right>{money(row.actual_cash)}</Td><Td right><span className={Number(row.variance || 0) < 0 ? "text-red-700 font-semibold" : Number(row.variance || 0) > 0 ? "text-amber-700 font-semibold" : "font-semibold"}>{money(row.variance)}</span></Td><Td><div className="flex items-center gap-2"><input aria-label={`Reopen reason for ${row.business_date}`} value={reopenReasons[row.id] || ""} onChange={(e) => setReopenReasons((current) => ({ ...current, [row.id]: e.target.value }))} maxLength={500} placeholder="Reason to reopen" className="h-8 w-44 rounded-md border border-[#d8d8d8] px-2 text-xs" /><button type="button" onClick={() => reopenDay(row)} disabled={saving === `reopen-${row.id}` || !String(reopenReasons[row.id] || "").trim()} className="h-8 px-2.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><RotateCcw size={12} /> {saving === `reopen-${row.id}` ? "Reopening…" : "Reopen"}</button></div>{row.reopen_count > 0 && <div className="mt-1 text-[11px] text-[#777]">Reopened {row.reopen_count}× · {row.last_reopen_reason}</div>}</Td></tr>) : <Empty cols={10}>No closed cash days in this period.</Empty>}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><div className="text-xs font-medium text-[#555] mb-1.5">{label}</div>{children}</label>;
}

function MoneyField({ label, value, onChange }) {
  return <Field label={label}><input type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="input-control text-right" /></Field>;
}

function Metric({ label, value, sub = null, strong = false }) {
  return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div>{sub ? <div className="mt-1 text-xs text-[#888]">{sub}</div> : null}</div>;
}

function Badge({ children, tone = "slate" }) {
  const styles = tone === "amber" ? "border-amber-200 bg-amber-100 text-amber-900" : "border-slate-200 bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles}`}>{children}</span>;
}

function Th({ children, right = false }) {
  return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right = false, strong = false }) {
  return <td className={`px-3 py-3 align-top ${right ? "text-right tabular-nums" : ""} ${strong ? "font-medium" : ""}`}>{children}</td>;
}

function Empty({ cols, children }) {
  return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>;
}
