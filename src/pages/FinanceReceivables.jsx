import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, Ban, FileText, Pencil, Plus, RefreshCw, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { adminReceivablesApi } from "@/lib/adminReceivablesApi";

const PAYMENT_METHODS = [
  ["cash", "Cash"], ["e_transfer", "e-Transfer"], ["debit", "Debit"],
  ["credit_card", "Credit card"], ["cheque", "Cheque"], ["other", "Other"],
];
const BUTTON_LIGHT = "h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#f7f7f8] disabled:opacity-60";
const BUTTON_DARK = "h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-black disabled:opacity-60";

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}
function money(value) { return Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" }); }
function dateLabel(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(y, m - 1, d));
}
function blankInvoice() {
  const today = localDateValue();
  return { issueDate: today, dueDate: today, customerName: "", customerEmail: "", customerPhone: "", reference: "", subtotal: "", discount: "0", shipping: "0", gstHstTax: "0", pstTax: "0", cogs: "0", notes: "" };
}
function invoiceToForm(row) {
  return {
    issueDate: String(row.issue_date || "").slice(0, 10), dueDate: String(row.due_date || "").slice(0, 10),
    customerName: row.customer_name || "", customerEmail: row.customer_email || "", customerPhone: row.customer_phone || "", reference: row.reference || "",
    subtotal: String(row.subtotal ?? ""), discount: String(row.discount ?? 0), shipping: String(row.shipping ?? 0), gstHstTax: String(row.gst_hst_tax ?? 0), pstTax: String(row.pst_tax ?? 0), cogs: String(row.cogs ?? 0), notes: row.notes || "",
  };
}
function blankPayment(balance = 0) { return { paidOn: localDateValue(), paymentMethod: "cash", amount: Number(balance || 0).toFixed(2), paymentReference: "", paymentNote: "" }; }
function activePayments(invoice) { return (Array.isArray(invoice?.payments) ? invoice.payments : []).filter((payment) => payment.status === "active"); }

export default function FinanceReceivables() {
  const [data, setData] = useState({ summary: {}, invoices: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(blankInvoice());
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(blankInvoice());
  const [paying, setPaying] = useState(null);
  const [paymentForm, setPaymentForm] = useState(blankPayment());
  const [voidReasons, setVoidReasons] = useState({});
  const [reverseReasons, setReverseReasons] = useState({});

  const load = async () => {
    setLoading(true); setError("");
    try { setData(await adminReceivablesApi.load({ limit: 1000 })); }
    catch (err) { console.error("Receivables load failed:", err); setError(err?.message || "Could not load customer invoices."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const invoices = Array.isArray(data?.invoices) ? data.invoices : [];
  const summary = data?.summary || {};
  const drafts = useMemo(() => invoices.filter((row) => row.status === "draft"), [invoices]);
  const outstanding = useMemo(() => invoices.filter((row) => row.status === "open" || row.status === "partially_paid"), [invoices]);
  const history = useMemo(() => invoices.filter((row) => row.status === "paid" || row.status === "void"), [invoices]);

  const run = async (key, action, successMessage) => {
    setSaving(key); setError(""); setNotice("");
    try { await action(); setNotice(successMessage); await load(); return true; }
    catch (err) { setError(err?.message || "Accounts receivable action failed."); return false; }
    finally { setSaving(""); }
  };

  const createInvoice = async (event) => {
    event.preventDefault();
    const ok = await run("create", () => adminReceivablesApi.create(invoiceForm), "Draft invoice created. It is not revenue and not yet an open receivable.");
    if (ok) { setInvoiceForm(blankInvoice()); setShowCreate(false); }
  };
  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editing) return;
    const ok = await run(`edit-${editing.id}`, () => adminReceivablesApi.update(editing.id, editForm), "Draft invoice updated.");
    if (ok) setEditing(null);
  };
  const issueInvoice = (invoice) => run(`issue-${invoice.id}`, () => adminReceivablesApi.issue(invoice.id), "Invoice issued as an open receivable. Revenue is still unchanged until payment is recorded.");
  const voidInvoice = async (invoice) => {
    const reason = String(voidReasons[invoice.id] || "").trim();
    if (!reason) { setError("Enter a reason before voiding the invoice."); return; }
    const ok = await run(`void-${invoice.id}`, () => adminReceivablesApi.void(invoice.id, reason), "Invoice voided and preserved in audit history.");
    if (ok) setVoidReasons((current) => ({ ...current, [invoice.id]: "" }));
  };
  const startPayment = (invoice) => { setPaying(invoice); setPaymentForm(blankPayment(invoice.balance_due)); };
  const recordPayment = async (event) => {
    event.preventDefault();
    if (!paying) return;
    const ok = await run(`pay-${paying.id}`, () => adminReceivablesApi.recordPayment(paying.id, paymentForm), "Payment recorded. A linked Finance sale now recognizes only this actual payment amount.");
    if (ok) { setPaying(null); setPaymentForm(blankPayment()); }
  };
  const reversePayment = async (payment) => {
    const reason = String(reverseReasons[payment.id] || "").trim();
    if (!reason) { setError("Enter a reason before reversing the payment."); return; }
    const ok = await run(`reverse-${payment.id}`, () => adminReceivablesApi.reversePayment(payment.id, reason), "Payment reversed. Its linked Finance sale was voided and the receivable balance was restored.");
    if (ok) setReverseReasons((current) => ({ ...current, [payment.id]: "" }));
  };

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm"><div className="h-full px-3 md:px-5 flex items-center gap-3">
      <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
      <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><FileText size={16}/> Customer Invoices &amp; Accounts Receivable</div>
      <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
    </div></header>

    <div className="border-b border-[#dedfe3] bg-white"><div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
      <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 20</div>
      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Customer Invoices &amp; Accounts Receivable</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Track money customers owe without inflating sales. Draft and issued invoices remain planning receivables; Finance recognizes revenue, tax and COGS only as customer payments are actually recorded.</p></div><div className="flex flex-wrap gap-2"><Link to="/admin/finance/local-sales" className={BUTTON_LIGHT}><Banknote size={14}/> Local Sales</Link><button type="button" onClick={load} disabled={loading} className={BUTTON_LIGHT}><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button><button type="button" onClick={() => setShowCreate((value) => !value)} className={BUTTON_DARK}><Plus size={15}/> Invoice</button></div></div>
    </div></div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Receivable is not cash or revenue</div><div className="mt-1 text-xs">Issuing an invoice only records what a customer owes. Recording a payment creates exactly one linked Finance sale for the amount actually received. Partial payments are recognized proportionally; reversing a payment voids that linked Finance sale and restores the balance.</div></div></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3"><Metric label="Outstanding" value={loading ? "—" : money(summary.outstandingTotal)} strong/><Metric label="Open invoices" value={loading ? "—" : String(summary.outstandingCount || 0)}/><Metric label="Overdue" value={loading ? "—" : `${summary.overdueCount || 0} · ${money(summary.overdueTotal)}`} alert={Number(summary.overdueCount || 0) > 0}/><Metric label="Due next 30 days" value={loading ? "—" : money(summary.due30Total)}/><Metric label="Drafts" value={loading ? "—" : String(summary.draftCount || 0)}/><Metric label="Paid invoices" value={loading ? "—" : `${summary.paidCount || 0} · ${money(summary.paidTotal)}`}/></div>
      {showCreate && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><SectionHeader title="Create draft invoice" subtitle="A draft has no accounting impact until it is issued and later paid."/><InvoiceForm value={invoiceForm} onChange={setInvoiceForm} onSubmit={createInvoice} disabled={saving === "create"} submitLabel="Create draft" onCancel={() => setShowCreate(false)}/></section>}
      {editing && <section className="rounded-xl border border-amber-200 bg-white overflow-hidden"><SectionHeader title={`Edit draft · ${editing.invoice_number}`} subtitle="Only drafts can be edited. Once issued, preserve the invoice and use payments or void/reversal controls."/><InvoiceForm value={editForm} onChange={setEditForm} onSubmit={saveEdit} disabled={saving === `edit-${editing.id}`} submitLabel="Save draft" onCancel={() => setEditing(null)}/></section>}
      {paying && <section className="rounded-xl border border-emerald-200 bg-white overflow-hidden"><SectionHeader title={`Record payment · ${paying.invoice_number}`} subtitle={`Customer ${paying.customer_name} · Balance ${money(paying.balance_due)}. Payment cannot exceed the remaining balance.`}/><PaymentForm value={paymentForm} onChange={setPaymentForm} balance={paying.balance_due} onSubmit={recordPayment} disabled={saving === `pay-${paying.id}`} onCancel={() => setPaying(null)}/></section>}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><SectionHeader title="Draft invoices" subtitle="Prepare and review before issuing. Issuing opens the receivable but does not recognize revenue."/><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Invoice</Th><Th>Customer</Th><Th>Dates</Th><Th>Reference</Th><Th right>Total</Th><Th right>COGS plan</Th><Th>Actions</Th></tr></thead><tbody>{drafts.length ? drafts.map((invoice) => <tr key={invoice.id} className="border-t border-[#eeeeee]"><Td><div className="font-semibold">{invoice.invoice_number}</div><div className="text-xs text-[#777]">Draft</div></Td><Td><CustomerCell invoice={invoice}/></Td><Td><div>{dateLabel(invoice.issue_date)}</div><div className="text-xs text-[#777]">Due {dateLabel(invoice.due_date)}</div></Td><Td>{invoice.reference || "—"}</Td><Td right strong>{money(invoice.total)}</Td><Td right>{money(invoice.cogs)}</Td><Td><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setEditing(invoice); setEditForm(invoiceToForm(invoice)); }} className={BUTTON_LIGHT}><Pencil size={13}/> Edit</button><button type="button" onClick={() => issueInvoice(invoice)} disabled={saving === `issue-${invoice.id}`} className={BUTTON_DARK}><Send size={13}/> Issue</button></div><VoidControl value={voidReasons[invoice.id] || ""} onChange={(value) => setVoidReasons((current) => ({ ...current, [invoice.id]: value }))} onVoid={() => voidInvoice(invoice)} disabled={saving === `void-${invoice.id}`}/></Td></tr>) : <Empty cols={7}>{loading ? "Loading invoices…" : "No draft invoices."}</Empty>}</tbody></table></div></section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><SectionHeader title="Outstanding receivables" subtitle="Balances due from issued invoices. Oldest due dates are shown first by the server read model."/><div className="overflow-x-auto"><table className="w-full min-w-[1280px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Status / Due</Th><Th>Invoice / Customer</Th><Th>Reference</Th><Th right>Invoice total</Th><Th right>Paid</Th><Th right>Balance</Th><Th>Payments</Th><Th>Action</Th></tr></thead><tbody>{outstanding.length ? outstanding.map((invoice) => <OutstandingRow key={invoice.id} invoice={invoice} saving={saving} reverseReasons={reverseReasons} setReverseReasons={setReverseReasons} onReverse={reversePayment} onPay={() => startPayment(invoice)} voidReason={voidReasons[invoice.id] || ""} setVoidReason={(value) => setVoidReasons((current) => ({ ...current, [invoice.id]: value }))} onVoid={() => voidInvoice(invoice)}/>) : <Empty cols={8}>{loading ? "Loading receivables…" : "No outstanding customer invoices."}</Empty>}</tbody></table></div></section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><SectionHeader title="Paid & voided history" subtitle="Paid invoices preserve their linked payment history. Voided invoices remain visible for audit."/><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Status</Th><Th>Invoice</Th><Th>Customer</Th><Th>Issued / Due</Th><Th right>Total</Th><Th right>Paid</Th><Th>Payment history / reason</Th></tr></thead><tbody>{history.length ? history.map((invoice) => <tr key={invoice.id} className="border-t border-[#eeeeee]"><Td><StatusBadge invoice={invoice}/></Td><Td><div className="font-semibold">{invoice.invoice_number}</div><div className="text-xs text-[#777]">{invoice.reference || "No reference"}</div></Td><Td><CustomerCell invoice={invoice}/></Td><Td><div>{dateLabel(invoice.issue_date)}</div><div className="text-xs text-[#777]">Due {dateLabel(invoice.due_date)}</div></Td><Td right strong>{money(invoice.total)}</Td><Td right>{money(invoice.paid_total)}</Td><Td>{invoice.status === "void" ? <div className="text-xs text-[#777]">{invoice.void_reason}</div> : <PaymentHistory invoice={invoice} saving={saving} reverseReasons={reverseReasons} setReverseReasons={setReverseReasons} onReverse={reversePayment}/>}</Td></tr>) : <Empty cols={7}>No paid or voided invoices yet.</Empty>}</tbody></table></div></section>
    </main>
  </div>;
}

function InvoiceForm({ value, onChange, onSubmit, disabled, submitLabel, onCancel }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return <form onSubmit={onSubmit} className="p-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Field label="Issue date"><input type="date" required max={localDateValue()} value={value.issueDate} onChange={(e) => set("issueDate", e.target.value)} className="input"/></Field><Field label="Due date"><input type="date" required min={value.issueDate || undefined} value={value.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="input"/></Field><Field label="Customer"><input required maxLength={200} value={value.customerName} onChange={(e) => set("customerName", e.target.value)} className="input" placeholder="Customer or company"/></Field><Field label="Reference"><input maxLength={120} value={value.reference} onChange={(e) => set("reference", e.target.value)} className="input" placeholder="PO, quote, job #"/></Field><Field label="Email"><input type="email" maxLength={254} value={value.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} className="input"/></Field><Field label="Phone"><input maxLength={80} value={value.customerPhone} onChange={(e) => set("customerPhone", e.target.value)} className="input"/></Field><MoneyField label="Subtotal" value={value.subtotal} onChange={(next) => set("subtotal", next)} required/><MoneyField label="Discount" value={value.discount} onChange={(next) => set("discount", next)}/><MoneyField label="Shipping" value={value.shipping} onChange={(next) => set("shipping", next)}/><MoneyField label="GST/HST" value={value.gstHstTax} onChange={(next) => set("gstHstTax", next)}/><MoneyField label="PST" value={value.pstTax} onChange={(next) => set("pstTax", next)}/><MoneyField label="Planned COGS" value={value.cogs} onChange={(next) => set("cogs", next)}/><Field label="Notes" className="md:col-span-2 xl:col-span-4"><textarea maxLength={1500} rows={3} value={value.notes} onChange={(e) => set("notes", e.target.value)} className="input py-2"/></Field><div className="md:col-span-2 xl:col-span-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className={BUTTON_LIGHT}>Cancel</button><button type="submit" disabled={disabled} className={BUTTON_DARK}>{disabled ? "Saving…" : submitLabel}</button></div></form>;
}
function PaymentForm({ value, onChange, balance, onSubmit, disabled, onCancel }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return <form onSubmit={onSubmit} className="p-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Field label="Payment date"><input type="date" required max={localDateValue()} value={value.paidOn} onChange={(e) => set("paidOn", e.target.value)} className="input"/></Field><Field label="Payment method"><select value={value.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className="input">{PAYMENT_METHODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><MoneyField label={`Amount · max ${money(balance)}`} value={value.amount} onChange={(next) => set("amount", next)} required max={Number(balance || 0)}/><Field label="Reference"><input maxLength={120} value={value.paymentReference} onChange={(e) => set("paymentReference", e.target.value)} className="input"/></Field><Field label="Payment note" className="md:col-span-2 xl:col-span-4"><textarea rows={2} maxLength={1000} value={value.paymentNote} onChange={(e) => set("paymentNote", e.target.value)} className="input py-2"/></Field><div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2"><button type="button" onClick={onCancel} className={BUTTON_LIGHT}>Cancel</button><button type="submit" disabled={disabled} className={BUTTON_DARK}><Banknote size={14}/>{disabled ? "Recording…" : "Record payment"}</button></div></form>;
}
function OutstandingRow({ invoice, saving, reverseReasons, setReverseReasons, onReverse, onPay, voidReason, setVoidReason, onVoid }) {
  const overdue = String(invoice.due_date || "").slice(0, 10) < localDateValue();
  const payments = activePayments(invoice);
  return <tr className="border-t border-[#eeeeee] align-top"><Td><StatusBadge invoice={invoice}/><div className={`mt-1 text-xs ${overdue ? "text-red-700 font-semibold" : "text-[#777]"}`}>{overdue ? "Overdue · " : "Due "}{dateLabel(invoice.due_date)}</div></Td><Td><div className="font-semibold">{invoice.invoice_number}</div><CustomerCell invoice={invoice}/></Td><Td>{invoice.reference || "—"}</Td><Td right>{money(invoice.total)}</Td><Td right>{money(invoice.paid_total)}</Td><Td right strong>{money(invoice.balance_due)}</Td><Td><PaymentHistory invoice={invoice} saving={saving} reverseReasons={reverseReasons} setReverseReasons={setReverseReasons} onReverse={onReverse}/></Td><Td><button type="button" onClick={onPay} className={BUTTON_DARK}><Banknote size={13}/> Payment</button>{invoice.status === "open" && payments.length === 0 && <VoidControl value={voidReason} onChange={setVoidReason} onVoid={onVoid} disabled={saving === `void-${invoice.id}`}/>}</Td></tr>;
}
function PaymentHistory({ invoice, saving, reverseReasons, setReverseReasons, onReverse }) {
  const payments = Array.isArray(invoice?.payments) ? invoice.payments : [];
  if (!payments.length) return <span className="text-xs text-[#777]">No payments yet</span>;
  return <div className="space-y-2 min-w-[260px]">{payments.map((payment) => <div key={payment.id} className={`rounded-lg border p-2 ${payment.status === "reversed" ? "border-slate-200 bg-slate-50 opacity-75" : "border-emerald-100 bg-emerald-50"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold text-xs">{money(payment.amount)} · {dateLabel(payment.paid_on)}</span><span className="text-[10px] uppercase font-bold">{payment.status}</span></div><div className="text-[11px] text-[#666] mt-0.5">{PAYMENT_METHODS.find(([id]) => id === payment.payment_method)?.[1] || payment.payment_method}{payment.payment_reference ? ` · ${payment.payment_reference}` : ""}</div>{payment.status === "reversed" ? <div className="text-[11px] text-[#777] mt-1">{payment.reverse_reason}</div> : <div className="mt-2 flex gap-1"><input value={reverseReasons[payment.id] || ""} onChange={(e) => setReverseReasons((current) => ({ ...current, [payment.id]: e.target.value }))} placeholder="Reversal reason" maxLength={500} className="h-8 min-w-0 flex-1 rounded-md border border-[#d5d5d5] px-2 text-xs"/><button type="button" onClick={() => onReverse(payment)} disabled={saving === `reverse-${payment.id}`} className="h-8 px-2 rounded-md border border-[#d5d5d5] bg-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-60"><RotateCcw size={11}/> Reverse</button></div>}</div>)}</div>;
}
function VoidControl({ value, onChange, onVoid, disabled }) { return <div className="mt-2 flex gap-1 min-w-[260px]"><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Void reason" maxLength={500} className="h-8 min-w-0 flex-1 rounded-md border border-[#d5d5d5] px-2 text-xs"/><button type="button" onClick={onVoid} disabled={disabled} className="h-8 px-2 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-60"><Ban size={11}/> Void</button></div>; }
function StatusBadge({ invoice }) { const map = { draft: ["Draft", "bg-slate-100 text-slate-700"], open: ["Open", "bg-blue-100 text-blue-800"], partially_paid: ["Partially paid", "bg-amber-100 text-amber-800"], paid: ["Paid", "bg-emerald-100 text-emerald-800"], void: ["Void", "bg-red-100 text-red-700"] }; const [label, cls] = map[invoice.status] || [invoice.status, "bg-slate-100 text-slate-700"]; return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${cls}`}>{label}</span>; }
function CustomerCell({ invoice }) { return <div><div className="font-medium">{invoice.customer_name}</div>{invoice.customer_email && <div className="text-xs text-[#777]">{invoice.customer_email}</div>}{invoice.customer_phone && <div className="text-xs text-[#777]">{invoice.customer_phone}</div>}</div>; }
function SectionHeader({ title, subtitle }) { return <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">{title}</div><div className="text-xs text-[#777] mt-0.5">{subtitle}</div></div>; }
function Metric({ label, value, strong = false, alert = false }) { return <div className={`rounded-xl border bg-white p-4 ${alert ? "border-red-200" : "border-[#dedede]"}`}><div className="text-xs text-[#777]">{label}</div><div className={`mt-1 text-lg ${strong ? "font-bold" : "font-semibold"} ${alert ? "text-red-700" : ""}`}>{value}</div></div>; }
function Field({ label, className = "", children }) { return <label className={`block ${className}`}><span className="text-xs font-semibold text-[#555]">{label}</span><div className="mt-1">{children}</div></label>; }
function MoneyField({ label, value, onChange, required = false, max = undefined }) { return <Field label={label}><input type="number" min="0" max={Number.isFinite(max) ? max : undefined} step="0.01" required={required} value={value} onChange={(e) => onChange(e.target.value)} className="input"/></Field>; }
function Th({ children, right = false }) { return <th className={`px-3 py-2 text-left font-semibold ${right ? "text-right" : ""}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-3 py-3 ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
