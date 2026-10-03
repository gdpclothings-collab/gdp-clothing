import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Edit3, Eye, FileText, Paperclip, Plus, RefreshCw, ShieldCheck, Trash2, Undo2, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { adminExpenseControlsApi } from "@/lib/adminExpenseControlsApi";
import { adminExpenseReceiptApi } from "@/lib/adminExpenseReceiptApi";

const RANGE_OPTIONS = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["year", "This year"],
  ["all", "All time"],
];

const CATEGORIES = [
  ["garments", "Garments"], ["dtf_transfers", "DTF transfers"], ["ink", "Ink"],
  ["packaging", "Packaging"], ["shipping", "Shipping"], ["local_delivery", "Local delivery"],
  ["advertising", "Advertising"], ["website_hosting", "Website / hosting"], ["domain", "Domain"],
  ["software", "Software"], ["equipment", "Equipment"], ["supplies", "Supplies"],
  ["merchant_fees", "Merchant fees"], ["miscellaneous", "Miscellaneous"],
];

const PAYMENT_METHODS = ["Cash", "Debit", "Credit card", "e-Transfer", "Bank", "Other"];
const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

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

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryLabel(value) {
  return CATEGORIES.find(([id]) => id === value)?.[1] || String(value || "Miscellaneous").replaceAll("_", " ");
}

function blankExpense() {
  return {
    occurredOn: localDateValue(), vendor: "", category: "garments", description: "",
    amount: "", tax: "0", gstHstTax: "0", pstTax: "0", itcEligible: false,
    paymentMethod: "", receiptReference: "", notes: "",
  };
}

function expenseToForm(expense) {
  return {
    occurredOn: expense.occurred_on || localDateValue(),
    vendor: expense.vendor || "",
    category: expense.category || "miscellaneous",
    description: expense.description || "",
    amount: String(expense.amount ?? ""),
    tax: String(expense.tax ?? 0),
    gstHstTax: String(expense.gst_hst_tax ?? 0),
    pstTax: String(expense.pst_tax ?? 0),
    itcEligible: Boolean(expense.gst_hst_itc_eligible),
    paymentMethod: expense.payment_method || "",
    receiptReference: expense.receipt_reference || "",
    notes: expense.notes || "",
  };
}

export default function FinanceExpenses() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState({ summary: {}, expenses: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(blankExpense());
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(blankExpense());
  const [correctionReason, setCorrectionReason] = useState("");
  const [voidReasons, setVoidReasons] = useState({});

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminExpenseControlsApi.load({ ...rangeDates(selectedRange), limit: 1000 }));
    } catch (err) {
      console.error("Expense controls load failed:", err);
      setError(err?.message || "Could not load expense controls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
  const events = Array.isArray(data?.events) ? data.events : [];
  const summary = data?.summary || {};
  const active = useMemo(() => expenses.filter((row) => row.status !== "voided"), [expenses]);
  const voided = useMemo(() => expenses.filter((row) => row.status === "voided"), [expenses]);

  const run = async (key, action, message) => {
    setSaving(key);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      await load();
      return true;
    } catch (err) {
      setError(err?.message || "Expense action failed.");
      return false;
    } finally {
      setSaving("");
    }
  };

  const runReceiptAction = async (key, action, message) => {
    setSaving(key);
    setError("");
    setNotice("");
    try {
      const result = await action();
      setNotice(`${message}${result?.cleanupWarning ? ` ${result.cleanupWarning}` : ""}`);
      await load();
      return true;
    } catch (err) {
      setError(err?.message || "Receipt action failed.");
      return false;
    } finally {
      setSaving("");
    }
  };

  const createExpense = async (event) => {
    event.preventDefault();
    const ok = await run("create", () => adminExpenseControlsApi.create(createForm), "Expense recorded with an audit entry. You can now attach its receipt from the expense row.");
    if (ok) {
      setCreateForm(blankExpense());
      setShowCreate(false);
    }
  };

  const beginEdit = (expense) => {
    setEditing(expense);
    setEditForm(expenseToForm(expense));
    setCorrectionReason("");
    setError("");
    setNotice("");
  };

  const correctExpense = async (event) => {
    event.preventDefault();
    if (!editing) return;
    const ok = await run(`edit-${editing.id}`, () => adminExpenseControlsApi.correct(editing.id, editForm, correctionReason), "Expense correction saved and logged.");
    if (ok) {
      setEditing(null);
      setCorrectionReason("");
    }
  };

  const voidExpense = async (expense) => {
    const reason = String(voidReasons[expense.id] || "").trim();
    if (!reason) {
      setError("Enter a reason before voiding an expense.");
      return;
    }
    const ok = await run(`void-${expense.id}`, () => adminExpenseControlsApi.void(expense.id, reason), "Expense voided. It is excluded from live finance, tax and cash totals but remains in audit history.");
    if (ok) setVoidReasons((current) => ({ ...current, [expense.id]: "" }));
  };

  const uploadReceipt = async (expense, file) => {
    if (!file) return;
    await runReceiptAction(
      `receipt-upload-${expense.id}`,
      () => adminExpenseReceiptApi.upload(expense.id, file),
      expense.receipt_path ? "Receipt file replaced and audited." : "Receipt file attached and audited.",
    );
  };

  const openReceipt = async (expense) => {
    if (!expense.receipt_path) return;
    setSaving(`receipt-view-${expense.id}`);
    setError("");
    try {
      const url = await adminExpenseReceiptApi.createViewUrl(expense.receipt_path);
      const opened = window.open(url, "_blank");
      if (opened) opened.opener = null;
      else window.location.assign(url);
    } catch (err) {
      setError(err?.message || "Could not open receipt file.");
    } finally {
      setSaving("");
    }
  };

  const removeReceipt = async (expense) => {
    if (!expense.receipt_path) return;
    if (!window.confirm(`Remove the private receipt file “${expense.receipt_file_name || "receipt"}” from this expense? The removal will remain in the audit log.`)) return;
    await runReceiptAction(
      `receipt-remove-${expense.id}`,
      () => adminExpenseReceiptApi.remove(expense.id),
      "Receipt file removed from the expense and audited.",
    );
  };

  return (
    <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
        <div className="h-full px-3 md:px-5 flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
          <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><FileText size={16} /> Expense Controls</div>
          <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15} /> Finance</Link>
        </div>
      </header>

      <div className="border-b border-[#dedfe3] bg-white">
        <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
          <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 10</div>
          <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Expenses & Receipt Controls</h1>
              <p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Record expenses, taxes and receipt references, then securely attach the supporting receipt or invoice in GDP’s private Finance storage.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap rounded-lg border border-[#d9d9d9] bg-white p-1">{RANGE_OPTIONS.map(([id, label]) => <button key={id} type="button" onClick={() => setRange(id)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${range === id ? "bg-[#171717] text-white" : "text-[#666] hover:bg-[#f2f2f2]"}`}>{label}</button>)}</div>
              <button type="button" onClick={() => load()} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
              <button type="button" onClick={() => setShowCreate((value) => !value)} className="h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2"><Plus size={15} /> Expense</button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5" /><div><div className="font-semibold">Private, audit-safe receipt storage</div><div className="mt-1 text-xs">Receipt files are stored in a private bucket and require Admin + MFA access. Accepted files: PDF, JPG, PNG or WebP up to 10 MB. View links expire after 60 seconds. Replacements and removals are audited; expenses are never hard-deleted.</div></div></div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Metric label="Active expenses" value={loading ? "—" : String(summary.activeCount || 0)} />
          <Metric label="Active total" value={loading ? "—" : money(summary.activeTotal)} strong />
          <Metric label="Receipt files" value={loading ? "—" : String(summary.receiptFiles || 0)} />
          <Metric label="GST/HST" value={loading ? "—" : money(summary.gstHstTax)} />
          <Metric label="PST" value={loading ? "—" : money(summary.pstTax)} />
          <Metric label="Voided" value={loading ? "—" : String(summary.voidedCount || 0)} />
        </div>

        {showCreate && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Record expense</div><div className="text-xs text-[#777] mt-0.5">Enter the bookkeeping details first. After the expense is saved, attach the receipt or invoice from its row below.</div></div><ExpenseForm value={createForm} onChange={setCreateForm} onSubmit={createExpense} submitLabel={saving === "create" ? "Saving…" : "Save expense"} disabled={saving === "create"} onCancel={() => setShowCreate(false)} /></section>}

        {editing && <section className="rounded-xl border border-amber-200 bg-white overflow-hidden"><div className="px-4 py-3 border-b border-amber-100 bg-amber-50"><div className="text-sm font-semibold">Correct expense · {editing.description}</div><div className="text-xs text-amber-900/70 mt-0.5">A correction keeps the same ledger ID and records the previous snapshot plus your reason. Receipt file changes are handled separately and have their own audit events.</div></div><ExpenseForm value={editForm} onChange={setEditForm} onSubmit={correctExpense} submitLabel={saving === `edit-${editing.id}` ? "Saving…" : "Save correction"} disabled={saving === `edit-${editing.id}`} onCancel={() => setEditing(null)} correctionReason={correctionReason} onCorrectionReason={setCorrectionReason} /></section>}

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Active expenses</div><div className="text-xs text-[#777] mt-0.5">Attach or replace one private supporting receipt/invoice per expense.</div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1520px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Category</Th><Th>Vendor / description</Th><Th>Payment</Th><Th>Receipt / invoice</Th><Th right>Amount</Th><Th right>GST/HST</Th><Th right>PST</Th><Th right>Total</Th><Th>Audit action</Th></tr></thead><tbody>
            {loading ? <Empty cols={10}>Loading expenses…</Empty> : active.length ? active.map((expense) => <tr key={expense.id} className="border-t border-[#eeeeee]"><Td strong>{expense.occurred_on}</Td><Td>{categoryLabel(expense.category)}</Td><Td><div className="font-medium">{expense.vendor || "—"}</div><div className="text-xs text-[#777] mt-0.5 max-w-[270px]">{expense.description}</div>{expense.correction_count > 0 && <div className="text-[11px] text-amber-700 mt-1">Corrected {expense.correction_count}×</div>}</Td><Td>{expense.payment_method || "—"}</Td><Td><ReceiptControls expense={expense} saving={saving} onUpload={uploadReceipt} onView={openReceipt} onRemove={removeReceipt} readOnly={false} /></Td><Td right>{money(expense.amount)}</Td><Td right>{money(expense.gst_hst_tax)}{expense.gst_hst_itc_eligible && <div className="text-[10px] text-emerald-700">ITC eligible</div>}</Td><Td right>{money(expense.pst_tax)}</Td><Td right strong>{money(Number(expense.amount || 0) + Number(expense.tax || 0))}</Td><Td><div className="flex flex-col gap-2 min-w-[260px]"><button type="button" onClick={() => beginEdit(expense)} className="h-8 px-2.5 rounded-md border border-[#d8d8d8] bg-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"><Edit3 size={12} /> Correct</button><div className="flex gap-2"><input value={voidReasons[expense.id] || ""} maxLength={500} onChange={(e) => setVoidReasons((current) => ({ ...current, [expense.id]: e.target.value }))} placeholder="Reason to void" className="h-8 flex-1 rounded-md border border-[#d8d8d8] px-2 text-xs" /><button type="button" onClick={() => voidExpense(expense)} disabled={saving === `void-${expense.id}` || !String(voidReasons[expense.id] || "").trim()} className="h-8 px-2.5 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Undo2 size={12} /> {saving === `void-${expense.id}` ? "Voiding…" : "Void"}</button></div></div></Td></tr>) : <Empty cols={10}>No active expenses in this period.</Empty>}
          </tbody></table></div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Voided expense history</div><div className="text-xs text-[#777] mt-0.5">Voided records remain read-only for audit, including any receipt that was attached before the void.</div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Vendor / description</Th><Th>Receipt</Th><Th right>Original total</Th><Th>Voided</Th><Th>Reason</Th></tr></thead><tbody>{loading ? <Empty cols={6}>Loading history…</Empty> : voided.length ? voided.map((expense) => <tr key={expense.id} className="border-t border-[#eeeeee] text-[#666]"><Td>{expense.occurred_on}</Td><Td><div>{expense.vendor || "—"}</div><div className="text-xs mt-0.5">{expense.description}</div></Td><Td><ReceiptControls expense={expense} saving={saving} onUpload={uploadReceipt} onView={openReceipt} onRemove={removeReceipt} readOnly /></Td><Td right>{money(Number(expense.amount || 0) + Number(expense.tax || 0))}</Td><Td>{expense.voided_at ? new Date(expense.voided_at).toLocaleString("en-CA") : "—"}</Td><Td>{expense.void_reason || "—"}</Td></tr>) : <Empty cols={6}>No voided expenses in this period.</Empty>}</tbody></table></div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Recent expense audit events</div><div className="text-xs text-[#777] mt-0.5">Created, corrected, receipt attachment/replacement/removal and void actions are append-only.</div></div>
          <div className="divide-y divide-[#eeeeee]">{events.length ? events.slice(0, 25).map((event) => <div key={event.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm"><span className="font-semibold capitalize min-w-24">{String(event.event_type || "").replaceAll("_", " ")}</span><span className="text-[#555] flex-1">{event.reason || "Expense recorded"}</span><span className="text-xs text-[#888]">{event.created_at ? new Date(event.created_at).toLocaleString("en-CA") : ""}</span></div>) : <div className="px-4 py-8 text-center text-sm text-[#777]">No expense audit events in this period.</div>}</div>
        </section>
      </main>
    </div>
  );
}

function ReceiptControls({ expense, saving, onUpload, onView, onRemove, readOnly = false }) {
  const hasFile = Boolean(expense.receipt_path);
  const busy = saving === `receipt-upload-${expense.id}` || saving === `receipt-view-${expense.id}` || saving === `receipt-remove-${expense.id}`;
  const reference = expense.receipt_reference || "";

  return <div className="min-w-[245px] space-y-1.5">
    {reference && <div className="text-xs"><span className="text-[#888]">Ref:</span> {reference}</div>}
    {hasFile ? <div className="rounded-md border border-[#e2e2e2] bg-[#fafafa] p-2">
      <div className="flex items-start gap-1.5"><Paperclip size={13} className="mt-0.5 shrink-0" /><div className="min-w-0"><div className="font-medium text-xs truncate max-w-[190px]" title={expense.receipt_file_name || "Receipt file"}>{expense.receipt_file_name || "Receipt file"}</div><div className="text-[10px] text-[#888] mt-0.5">{formatBytes(expense.receipt_size_bytes)}{expense.receipt_mime_type ? ` · ${expense.receipt_mime_type === "application/pdf" ? "PDF" : "Image"}` : ""}</div></div></div>
      <div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => onView(expense)} disabled={busy} className="h-7 px-2 rounded border border-[#d6d6d6] bg-white text-[11px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Eye size={11} /> {saving === `receipt-view-${expense.id}` ? "Opening…" : "View"}</button>{!readOnly && <><label className={`h-7 px-2 rounded border border-[#d6d6d6] bg-white text-[11px] font-semibold inline-flex items-center gap-1 ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}><Upload size={11} /> {saving === `receipt-upload-${expense.id}` ? "Uploading…" : "Replace"}<input type="file" accept={RECEIPT_ACCEPT} disabled={busy} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUpload(expense, file); }} /></label><button type="button" onClick={() => onRemove(expense)} disabled={busy} className="h-7 px-2 rounded border border-red-200 bg-red-50 text-red-700 text-[11px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Trash2 size={11} /> {saving === `receipt-remove-${expense.id}` ? "Removing…" : "Remove"}</button></>}</div>
    </div> : readOnly ? <div className="text-xs text-[#999]">{reference || "No receipt file"}</div> : <label className={`h-8 px-2.5 rounded-md border border-[#d6d6d6] bg-white text-xs font-semibold inline-flex items-center gap-1.5 ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-[#f7f7f7]"}`}><Upload size={12} /> {saving === `receipt-upload-${expense.id}` ? "Uploading…" : "Attach file"}<input type="file" accept={RECEIPT_ACCEPT} disabled={busy} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUpload(expense, file); }} /></label>}
  </div>;
}

function ExpenseForm({ value, onChange, onSubmit, submitLabel, disabled, onCancel, correctionReason = null, onCorrectionReason = null }) {
  const totalTax = Number(value.gstHstTax || 0) + Number(value.pstTax || 0);
  const total = Number(value.amount || 0) + totalTax;
  const set = (key, next) => onChange((current) => ({ ...current, [key]: next }));
  return <form onSubmit={onSubmit} className="p-4 space-y-4">
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Field label="Expense date"><input type="date" max={localDateValue()} required value={value.occurredOn} onChange={(e) => set("occurredOn", e.target.value)} className="input-control" /></Field>
      <Field label="Vendor"><input value={value.vendor} maxLength={200} onChange={(e) => set("vendor", e.target.value)} placeholder="Supplier or store" className="input-control" /></Field>
      <Field label="Category"><select value={value.category} onChange={(e) => set("category", e.target.value)} className="input-control">{CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
      <Field label="Payment method"><select value={value.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className="input-control"><option value="">Not specified</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></Field>
    </div>
    <div className="grid lg:grid-cols-[1fr_160px_150px_150px_180px] gap-3 items-end">
      <Field label="Description"><input required value={value.description} maxLength={500} onChange={(e) => set("description", e.target.value)} placeholder="What was purchased?" className="input-control" /></Field>
      <MoneyField label="Pre-tax amount" value={value.amount} onChange={(next) => set("amount", next)} required />
      <MoneyField label="GST/HST" value={value.gstHstTax} onChange={(next) => set("gstHstTax", next)} />
      <MoneyField label="PST" value={value.pstTax} onChange={(next) => set("pstTax", next)} />
      <div><div className="text-xs font-medium text-[#555] mb-1.5">Expense total</div><div className="h-10 rounded-lg border border-[#d8d8d8] bg-[#fafafa] px-3 grid items-center text-right text-sm font-bold tabular-nums">{Number.isFinite(total) ? money(total) : "—"}</div></div>
    </div>
    <div className="grid lg:grid-cols-2 gap-3">
      <Field label="Receipt / invoice reference"><input value={value.receiptReference} maxLength={200} onChange={(e) => set("receiptReference", e.target.value)} placeholder="Receipt #, invoice #, or order #" className="input-control" /></Field>
      <Field label="Notes"><input value={value.notes} maxLength={1000} onChange={(e) => set("notes", e.target.value)} placeholder="Optional bookkeeping note" className="input-control" /></Field>
    </div>
    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={value.itcEligible} onChange={(e) => set("itcEligible", e.target.checked)} className="rounded border-[#bbb]" /><span>GST/HST amount is potentially ITC eligible</span></label>
    {correctionReason !== null && <Field label="Correction reason (required)"><input required value={correctionReason} maxLength={500} onChange={(e) => onCorrectionReason(e.target.value)} placeholder="Explain what was wrong and why this correction is needed" className="input-control" /></Field>}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg border border-[#d8d8d8] bg-white text-sm">Cancel</button><button type="submit" disabled={disabled} className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-60">{submitLabel}</button></div>
  </form>;
}

function MoneyField({ label, value, onChange, required = false }) {
  return <Field label={label}><input type="number" min="0" step="0.01" inputMode="decimal" required={required} value={value} onChange={(e) => onChange(e.target.value)} className="input-control text-right" /></Field>;
}

function Field({ label, children }) { return <label className="block"><div className="text-xs font-medium text-[#555] mb-1.5">{label}</div>{children}</label>; }
function Metric({ label, value, strong = false }) { return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div></div>; }
function Th({ children, right = false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-3 py-3 align-top ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
