import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { adminPayablesApi } from "@/lib/adminPayablesApi";

const CATEGORIES = [
  ["garments", "Garments"], ["dtf_transfers", "DTF transfers"], ["ink", "Ink"], ["packaging", "Packaging"],
  ["shipping", "Shipping"], ["local_delivery", "Local delivery"], ["advertising", "Advertising"],
  ["website_hosting", "Website / hosting"], ["domain", "Domain"], ["software", "Software"],
  ["equipment", "Equipment"], ["supplies", "Supplies"], ["merchant_fees", "Merchant fees"], ["miscellaneous", "Miscellaneous"],
];
const PAYMENT_METHODS = ["Cash", "Debit", "Credit card", "e-Transfer", "Bank", "Cheque", "Other"];

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
function grossBillTotal(bill) { return Number(bill?.gross_total ?? (Number(bill?.amount || 0) + Number(bill?.gst_hst_tax || 0) + Number(bill?.pst_tax || 0))); }
function netBillTotal(bill) { return Number(bill?.net_total ?? grossBillTotal(bill)); }
function blankBill() {
  const today = localDateValue();
  return { issueDate: today, dueDate: today, vendor: "", billNumber: "", category: "garments", description: "", amount: "", gstHstTax: "0", pstTax: "0", itcEligible: false, notes: "" };
}
function blankPayment() { return { paidOn: localDateValue(), paymentMethod: "Bank", paymentReference: "", paymentNote: "" }; }
function categoryLabel(value) { return CATEGORIES.find(([id]) => id === value)?.[1] || String(value || "Miscellaneous").replaceAll("_", " "); }

export default function FinancePayables() {
  const [data, setData] = useState({ summary: {}, bills: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [billForm, setBillForm] = useState(blankBill());
  const [payingBill, setPayingBill] = useState(null);
  const [paymentForm, setPaymentForm] = useState(blankPayment());
  const [voidReasons, setVoidReasons] = useState({});

  const load = async () => {
    setLoading(true); setError("");
    try { setData(await adminPayablesApi.load({ limit: 1000 })); }
    catch (err) { console.error("Payables load failed:", err); setError(err?.message || "Could not load vendor bills."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const bills = Array.isArray(data?.bills) ? data.bills : [];
  const summary = data?.summary || {};
  const openBills = useMemo(() => bills.filter((row) => row.status === "open"), [bills]);
  const history = useMemo(() => bills.filter((row) => row.status !== "open"), [bills]);

  const run = async (key, action, successMessage) => {
    setSaving(key); setError(""); setNotice("");
    try { await action(); setNotice(successMessage); await load(); return true; }
    catch (err) { setError(err?.message || "Accounts payable action failed."); return false; }
    finally { setSaving(""); }
  };

  const createBill = async (event) => {
    event.preventDefault();
    const ok = await run("create", () => adminPayablesApi.create(billForm), "Vendor bill recorded as an open payable. It is not an expense until you mark it paid.");
    if (ok) { setBillForm(blankBill()); setShowCreate(false); }
  };

  const markPaid = async (event) => {
    event.preventDefault();
    if (!payingBill) return;
    const ok = await run(`pay-${payingBill.id}`, () => adminPayablesApi.markPaid(payingBill.id, paymentForm), "Bill marked paid and exactly one linked Finance expense was created for the remaining net balance.");
    if (ok) { setPayingBill(null); setPaymentForm(blankPayment()); }
  };

  const voidBill = async (bill) => {
    const reason = String(voidReasons[bill.id] || "").trim();
    if (!reason) { setError("Enter a reason before voiding the bill."); return; }
    const ok = await run(`void-${bill.id}`, () => adminPayablesApi.void(bill.id, reason), "Bill voided and preserved in audit history. No expense was created.");
    if (ok) setVoidReasons((current) => ({ ...current, [bill.id]: "" }));
  };

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm"><div className="h-full px-3 md:px-5 flex items-center gap-3">
      <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
      <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><FileText size={16}/> Bills &amp; Accounts Payable</div>
      <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
    </div></header>

    <div className="border-b border-[#dedfe3] bg-white"><div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
      <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 15 + Phase 19 Credits</div>
      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Bills &amp; Accounts Payable</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Track vendor bills before payment, apply supplier credits, monitor net obligations, then create one linked Finance expense only for the remaining amount actually paid.</p></div><div className="flex flex-wrap gap-2"><Link to="/admin/finance/vendor-credits" className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2"><FileText size={14}/> Returns / Credits</Link><button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button><button type="button" onClick={() => setShowCreate((value) => !value)} className="h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2"><Plus size={15}/> Bill</button></div></div>
    </div></div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Credits reduce AP without inventing cash</div><div className="mt-1 text-xs">Open bills remain planning liabilities. Vendor credits reduce the net payable. A fully credited bill becomes Settled with no payment and no expense. Paying a partially credited bill creates exactly one Finance expense for only the remaining net pre-tax/GST/PST components.</div></div></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <Metric label="Open bills" value={loading ? "—" : String(summary.openCount || 0)} />
        <Metric label="Net open payable" value={loading ? "—" : money(summary.openTotal)} strong />
        <Metric label="Credits on open" value={loading ? "—" : money(summary.creditsAppliedToOpen)} />
        <Metric label="Overdue net" value={loading ? "—" : `${summary.overdueCount || 0} · ${money(summary.overdueTotal)}`} alert={Number(summary.overdueCount || 0) > 0}/>
        <Metric label="Due next 30 days" value={loading ? "—" : money(summary.due30Total)} />
        <Metric label="Credit-settled" value={loading ? "—" : String(summary.settledCount || 0)} />
      </div>

      {showCreate && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Record vendor bill</div><div className="text-xs text-[#777] mt-0.5">This records a payable only. Nothing enters the expense ledger until payment is confirmed.</div></div><BillForm value={billForm} onChange={setBillForm} onSubmit={createBill} disabled={saving === "create"} onCancel={() => setShowCreate(false)}/></section>}

      {payingBill && <section className="rounded-xl border border-emerald-200 bg-white overflow-hidden"><div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50"><div className="text-sm font-semibold">Record payment · {payingBill.vendor}</div><div className="text-xs text-emerald-900/70 mt-0.5">Gross bill {money(grossBillTotal(payingBill))} · Vendor credits {money(payingBill.credit_total)} · <strong>Net payable {money(netBillTotal(payingBill))}</strong>. A successful payment creates one linked Finance expense for this net balance.</div></div><PaymentForm value={paymentForm} onChange={setPaymentForm} onSubmit={markPaid} disabled={saving === `pay-${payingBill.id}`} onCancel={() => setPayingBill(null)}/></section>}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Open payables</div><div className="text-xs text-[#777] mt-0.5">Oldest due dates first. Gross bill value remains preserved while credits reduce only Net due.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Due</Th><Th>Vendor / Bill</Th><Th>Description</Th><Th>Category</Th><Th right>Gross</Th><Th right>Credits</Th><Th right>Net due</Th><Th>Action</Th></tr></thead><tbody>{openBills.length ? openBills.map((bill) => <OpenBillRow key={bill.id} bill={bill} saving={saving} onPay={() => { setPayingBill(bill); setPaymentForm(blankPayment()); }} voidReason={voidReasons[bill.id] || ""} onVoidReason={(value) => setVoidReasons((current) => ({ ...current, [bill.id]: value }))} onVoid={() => voidBill(bill)}/>) : <Empty cols={8}>{loading ? "Loading bills…" : "No open vendor bills."}</Empty>}</tbody></table></div></section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Paid, settled &amp; voided history</div><div className="text-xs text-[#777] mt-0.5">Paid rows link to a Finance expense. Credit-settled bills have no cash transaction or expense. Voided rows remain for audit history.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Status</Th><Th>Vendor / Bill</Th><Th>Due</Th><Th>Settlement / Reason</Th><Th right>Gross</Th><Th right>Credits</Th><Th right>Net</Th><Th>Expense</Th></tr></thead><tbody>{history.length ? history.map((bill) => <tr key={bill.id} className="border-t border-[#eeeeee]"><Td><StatusBadge bill={bill}/></Td><Td><div className="font-medium">{bill.vendor}</div><div className="text-xs text-[#777]">{bill.bill_number || "No bill number"}</div></Td><Td>{dateLabel(bill.due_date)}</Td><Td>{bill.status === "paid" ? <><div>{dateLabel(bill.paid_on)} · {bill.payment_method}</div><div className="text-xs text-[#777]">{bill.payment_reference || "No payment reference"}</div></> : bill.status === "settled" ? <><div>Settled by vendor credit</div><div className="text-xs text-[#777]">No payment / no expense</div></> : <div className="text-xs text-[#777]">{bill.void_reason}</div>}</Td><Td right>{money(grossBillTotal(bill))}</Td><Td right>{money(bill.credit_total)}</Td><Td right strong>{money(netBillTotal(bill))}</Td><Td>{bill.expense_id ? <Link to="/admin/finance/expenses" className="text-[#a70f2d] font-semibold hover:underline">View Expenses</Link> : "—"}</Td></tr>) : <Empty cols={8}>No paid, settled or voided bills yet.</Empty>}</tbody></table></div></section>
    </main>
  </div>;
}

function BillForm({ value, onChange, onSubmit, disabled, onCancel }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return <form onSubmit={onSubmit} className="p-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Field label="Issue date"><input type="date" required value={value.issueDate} max={localDateValue()} onChange={(e) => set("issueDate", e.target.value)} className="input"/></Field><Field label="Due date"><input type="date" required value={value.dueDate} min={value.issueDate || undefined} onChange={(e) => set("dueDate", e.target.value)} className="input"/></Field><Field label="Vendor"><input required value={value.vendor} onChange={(e) => set("vendor", e.target.value)} className="input" placeholder="Supplier or vendor"/></Field><Field label="Bill / invoice #"><input value={value.billNumber} onChange={(e) => set("billNumber", e.target.value)} className="input" placeholder="Optional"/></Field><Field label="Category"><select value={value.category} onChange={(e) => set("category", e.target.value)} className="input">{CATEGORIES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="Description"><input required value={value.description} onChange={(e) => set("description", e.target.value)} className="input" placeholder="What is this bill for?"/></Field><Field label="Pre-tax amount"><input required type="number" min="0.01" step="0.01" value={value.amount} onChange={(e) => set("amount", e.target.value)} className="input"/></Field><Field label="GST/HST"><input type="number" min="0" step="0.01" value={value.gstHstTax} onChange={(e) => set("gstHstTax", e.target.value)} className="input"/></Field><Field label="PST"><input type="number" min="0" step="0.01" value={value.pstTax} onChange={(e) => set("pstTax", e.target.value)} className="input"/></Field><label className="flex items-center gap-2 text-sm pt-7"><input type="checkbox" checked={value.itcEligible} onChange={(e) => set("itcEligible", e.target.checked)}/> GST/HST ITC eligible</label><Field label="Notes" wide><textarea rows={2} value={value.notes} onChange={(e) => set("notes", e.target.value)} className="input" placeholder="Optional notes"/></Field><div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2 pt-1"><button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm">Cancel</button><button disabled={disabled} className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-60">{disabled ? "Saving…" : "Save bill"}</button></div></form>;
}

function PaymentForm({ value, onChange, onSubmit, disabled, onCancel }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return <form onSubmit={onSubmit} className="p-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Field label="Payment date"><input type="date" required max={localDateValue()} value={value.paidOn} onChange={(e) => set("paidOn", e.target.value)} className="input"/></Field><Field label="Payment method"><select required value={value.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className="input">{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Payment reference"><input value={value.paymentReference} onChange={(e) => set("paymentReference", e.target.value)} className="input" placeholder="e-Transfer, cheque, bank ref…"/></Field><Field label="Payment note"><input value={value.paymentNote} onChange={(e) => set("paymentNote", e.target.value)} className="input" placeholder="Optional"/></Field><div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2"><button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm">Cancel</button><button disabled={disabled} className="h-9 px-4 rounded-lg bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60">{disabled ? "Recording…" : "Mark paid & create net expense"}</button></div></form>;
}

function OpenBillRow({ bill, saving, onPay, voidReason, onVoidReason, onVoid }) {
  const today = localDateValue(); const overdue = bill.due_date < today; const dueSoon = !overdue && bill.due_date <= new Date(Date.now() + 7*86400000).toISOString().slice(0,10);
  return <tr className="border-t border-[#eeeeee] align-top"><Td><div className="font-medium">{dateLabel(bill.due_date)}</div>{overdue ? <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">Overdue</span> : dueSoon ? <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Due soon</span> : null}</Td><Td><div className="font-medium">{bill.vendor}</div><div className="text-xs text-[#777]">{bill.bill_number || "No bill number"}</div>{bill.purchase_order_number && <div className="text-[11px] text-[#888]">{bill.purchase_order_number}</div>}</Td><Td>{bill.description}</Td><Td>{categoryLabel(bill.category)}</Td><Td right>{money(grossBillTotal(bill))}</Td><Td right>{money(bill.credit_total)}</Td><Td right strong>{money(netBillTotal(bill))}</Td><Td><div className="flex flex-col gap-2 min-w-[260px]"><button type="button" onClick={onPay} className="h-8 px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1"><CheckCircle2 size={13}/> Pay net due</button><div className="flex gap-1"><input value={voidReason} onChange={(e) => onVoidReason(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-[#d5d5d5] px-2 text-xs" placeholder="Reason to void"/><button type="button" disabled={saving === `void-${bill.id}`} onClick={onVoid} className="h-8 px-2 rounded-md border border-red-200 text-red-700 text-xs disabled:opacity-50"><Trash2 size={13}/></button></div></div></Td></tr>;
}

function StatusBadge({ bill }) { if (bill.status === "paid") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 size={12}/> Paid</span>; if (bill.status === "settled") return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800"><CheckCircle2 size={12}/> Settled</span>; return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"><AlertTriangle size={12}/> Voided</span>; }
function Metric({ label, value, strong=false, alert=false }) { return <div className={`rounded-xl border bg-white p-4 ${alert ? "border-red-200" : "border-[#dedede]"}`}><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"} ${alert ? "text-red-700" : ""}`}>{value}</div></div>; }
function Field({ label, children, wide=false }) { return <label className={wide ? "md:col-span-2 xl:col-span-2" : ""}><div className="text-xs font-medium text-[#666] mb-1">{label}</div>{children}</label>; }
function Th({ children, right=false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right=false, strong=false }) { return <td className={`px-3 py-3 ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
