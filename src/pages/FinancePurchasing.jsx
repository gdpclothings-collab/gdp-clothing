import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UsersRound, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { adminPurchasingApi } from "@/lib/adminPurchasingApi";

const money = (value) => Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const todayValue = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : "—";
const blankSupplier = () => ({ name: "", contactName: "", email: "", phone: "", website: "", accountNumber: "", paymentTermsDays: "0", notes: "" });
const blankItem = () => ({ sku: "", description: "", quantity: "1", unitCost: "0", gstHstTax: "0", pstTax: "0" });
const blankPo = () => ({ supplierId: "", orderDate: todayValue(), expectedDate: "", notes: "", items: [blankItem()] });
const lineSubtotal = (item) => Number(item.quantity || 0) * Number(item.unitCost || 0);
const lineTotal = (item) => lineSubtotal(item) + Number(item.gstHstTax || 0) + Number(item.pstTax || 0);

export default function FinancePurchasing() {
  const [data, setData] = useState({ summary: {}, suppliers: [], purchaseOrders: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [supplierForm, setSupplierForm] = useState(blankSupplier());
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [archiveReasons, setArchiveReasons] = useState({});
  const [poForm, setPoForm] = useState(blankPo());
  const [editingPo, setEditingPo] = useState(null);
  const [showPoForm, setShowPoForm] = useState(false);
  const [cancelReasons, setCancelReasons] = useState({});

  const load = async () => {
    setLoading(true); setError("");
    try { setData(await adminPurchasingApi.load({ limit: 1000 })); }
    catch (err) { console.error("Purchasing load failed:", err); setError(err?.message || "Could not load purchasing data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.status === "active"), [suppliers]);
  const purchaseOrders = Array.isArray(data.purchaseOrders) ? data.purchaseOrders : [];
  const openPos = useMemo(() => purchaseOrders.filter((po) => po.status !== "cancelled"), [purchaseOrders]);
  const cancelledPos = useMemo(() => purchaseOrders.filter((po) => po.status === "cancelled"), [purchaseOrders]);
  const summary = data.summary || {};

  const run = async (key, action, success) => {
    setSaving(key); setError(""); setNotice("");
    try { await action(); setNotice(success); await load(); return true; }
    catch (err) { setError(err?.message || "Purchasing action failed."); return false; }
    finally { setSaving(""); }
  };

  const startSupplier = (supplier = null) => {
    setEditingSupplier(supplier);
    setSupplierForm(supplier ? {
      name: supplier.name || "", contactName: supplier.contact_name || "", email: supplier.email || "", phone: supplier.phone || "",
      website: supplier.website || "", accountNumber: supplier.account_number || "", paymentTermsDays: String(supplier.payment_terms_days || 0), notes: supplier.notes || "",
    } : blankSupplier());
    setShowSupplierForm(true);
  };

  const saveSupplier = async (event) => {
    event.preventDefault();
    const key = editingSupplier ? `supplier-${editingSupplier.id}` : "supplier-create";
    const action = editingSupplier ? () => adminPurchasingApi.updateSupplier(editingSupplier.id, supplierForm) : () => adminPurchasingApi.createSupplier(supplierForm);
    const ok = await run(key, action, editingSupplier ? "Supplier updated." : "Supplier added.");
    if (ok) { setShowSupplierForm(false); setEditingSupplier(null); setSupplierForm(blankSupplier()); }
  };

  const archiveSupplier = async (supplier) => {
    const reason = archiveReasons[supplier.id] || "";
    const ok = await run(`archive-${supplier.id}`, () => adminPurchasingApi.archiveSupplier(supplier.id, reason), "Supplier archived and preserved in purchasing history.");
    if (ok) setArchiveReasons((current) => ({ ...current, [supplier.id]: "" }));
  };

  const startPo = (po = null) => {
    setEditingPo(po);
    setPoForm(po ? {
      supplierId: po.supplier_id, orderDate: po.order_date, expectedDate: po.expected_date || "", notes: po.notes || "",
      items: (Array.isArray(po.items) && po.items.length ? po.items : [blankItem()]).map((item) => ({
        sku: item.sku || "", description: item.description || "", quantity: String(item.quantity ?? 1), unitCost: String(item.unit_cost ?? 0), gstHstTax: String(item.gst_hst_tax ?? 0), pstTax: String(item.pst_tax ?? 0),
      })),
    } : blankPo());
    setShowPoForm(true);
  };

  const savePo = async (event) => {
    event.preventDefault();
    const key = editingPo ? `po-${editingPo.id}` : "po-create";
    const action = editingPo ? () => adminPurchasingApi.updatePurchaseOrder(editingPo.id, poForm) : () => adminPurchasingApi.createPurchaseOrder(poForm);
    const ok = await run(key, action, editingPo ? "Draft purchase order updated." : "Draft purchase order created. It has no accounting or inventory impact yet.");
    if (ok) { setShowPoForm(false); setEditingPo(null); setPoForm(blankPo()); }
  };

  const approvePo = (po) => run(`approve-${po.id}`, () => adminPurchasingApi.approvePurchaseOrder(po.id), `${po.po_number} approved as a purchasing commitment. No expense, payable, or inventory movement was created.`);
  const cancelPo = async (po) => {
    const reason = cancelReasons[po.id] || "";
    const ok = await run(`cancel-${po.id}`, () => adminPurchasingApi.cancelPurchaseOrder(po.id, reason), `${po.po_number} cancelled and preserved in audit history.`);
    if (ok) setCancelReasons((current) => ({ ...current, [po.id]: "" }));
  };

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm"><div className="h-full px-3 md:px-5 flex items-center gap-3">
      <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
      <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><ClipboardList size={16}/> Suppliers &amp; Purchase Orders</div>
      <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
    </div></header>

    <div className="border-b border-[#dedfe3] bg-white"><div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
      <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 16</div>
      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Suppliers &amp; Purchase Orders</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Manage supplier records and purchasing commitments before receiving goods or recording a vendor bill.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button><button type="button" onClick={() => startSupplier()} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2"><UsersRound size={15}/> Supplier</button><button type="button" onClick={() => startPo()} disabled={!activeSuppliers.length} className="h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40"><Plus size={15}/> Purchase Order</button></div></div>
    </div></div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Purchasing commitment only</div><div className="mt-1 text-xs">Draft and approved purchase orders do not change expenses, AP, GST/PST filing totals, cash, bank balances, COGS or inventory. Phase 16 only records the supplier and intended purchase. Receiving and vendor-bill matching remain separate controlled steps.</div></div></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3"><Metric label="Active suppliers" value={loading ? "—" : String(summary.activeSuppliers || 0)}/><Metric label="Draft POs" value={loading ? "—" : `${summary.draftCount || 0} · ${money(summary.draftTotal)}`}/><Metric label="Approved POs" value={loading ? "—" : String(summary.approvedCount || 0)}/><Metric label="Approved commitment" value={loading ? "—" : money(summary.approvedTotal)} strong/><Metric label="Expected ≤ 7 days" value={loading ? "—" : money(summary.expected7Total)}/><Metric label="Expected ≤ 30 days" value={loading ? "—" : money(summary.expected30Total)}/></div>

      {showSupplierForm && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">{editingSupplier ? "Edit supplier" : "Add supplier"}</div><div className="text-xs text-[#777] mt-0.5">Supplier records are reusable across purchase orders and remain preserved after archive.</div></div><SupplierForm value={supplierForm} onChange={setSupplierForm} onSubmit={saveSupplier} disabled={Boolean(saving)} onCancel={() => { setShowSupplierForm(false); setEditingSupplier(null); }}/></section>}

      {showPoForm && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">{editingPo ? `Edit ${editingPo.po_number}` : "Create purchase order draft"}</div><div className="text-xs text-[#777] mt-0.5">Only draft POs can be edited. Approval locks the purchasing commitment.</div></div><PurchaseOrderForm value={poForm} onChange={setPoForm} suppliers={activeSuppliers} onSubmit={savePo} disabled={Boolean(saving)} onCancel={() => { setShowPoForm(false); setEditingPo(null); }}/></section>}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed] flex items-center justify-between"><div><div className="text-sm font-semibold">Suppliers</div><div className="text-xs text-[#777] mt-0.5">Archive is blocked while a supplier has draft or approved purchase orders.</div></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Supplier</Th><Th>Contact</Th><Th>Terms</Th><Th>Account</Th><Th>Status</Th><Th>Actions</Th></tr></thead><tbody>{suppliers.length ? suppliers.map((supplier) => <tr key={supplier.id} className="border-t border-[#eeeeee] align-top"><Td><div className="font-medium">{supplier.name}</div>{supplier.website && <div className="text-xs text-[#777] break-all">{supplier.website}</div>}</Td><Td><div>{supplier.contact_name || "—"}</div><div className="text-xs text-[#777]">{supplier.email || supplier.phone || "No contact details"}</div></Td><Td>{Number(supplier.payment_terms_days || 0) ? `Net ${supplier.payment_terms_days}` : "Due immediately"}</Td><Td>{supplier.account_number || "—"}</Td><Td><Status status={supplier.status}/></Td><Td>{supplier.status === "active" ? <div className="flex flex-col gap-2 min-w-[260px]"><button type="button" onClick={() => startSupplier(supplier)} className="h-8 px-3 rounded-md border border-[#d5d5d5] text-xs inline-flex items-center justify-center gap-1"><Pencil size={13}/> Edit</button><div className="flex gap-1"><input className="h-8 flex-1 min-w-0 rounded-md border border-[#d5d5d5] px-2 text-xs" value={archiveReasons[supplier.id] || ""} onChange={(e) => setArchiveReasons((c) => ({ ...c, [supplier.id]: e.target.value }))} placeholder="Archive reason"/><button type="button" onClick={() => archiveSupplier(supplier)} disabled={saving === `archive-${supplier.id}`} className="h-8 px-2 rounded-md border border-red-200 text-red-700 disabled:opacity-40"><Trash2 size={13}/></button></div></div> : <div className="text-xs text-[#777] max-w-[260px]">{supplier.archive_reason}</div>}</Td></tr>) : <Empty cols={6}>{loading ? "Loading suppliers…" : "No suppliers yet. Add a supplier before creating a purchase order."}</Empty>}</tbody></table></div></section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Purchase orders</div><div className="text-xs text-[#777] mt-0.5">Drafts are editable. Approved POs are locked commitments. Cancellation always requires a reason.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>PO</Th><Th>Supplier</Th><Th>Order / Expected</Th><Th>Items</Th><Th right>Total</Th><Th>Status</Th><Th>Actions</Th></tr></thead><tbody>{openPos.length ? openPos.map((po) => <PoRow key={po.id} po={po} saving={saving} onEdit={() => startPo(po)} onApprove={() => approvePo(po)} cancelReason={cancelReasons[po.id] || ""} onCancelReason={(value) => setCancelReasons((c) => ({ ...c, [po.id]: value }))} onCancel={() => cancelPo(po)}/>) : <Empty cols={7}>{loading ? "Loading purchase orders…" : "No draft or approved purchase orders."}</Empty>}</tbody></table></div></section>

      {cancelledPos.length > 0 && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Cancelled PO history</div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>PO</Th><Th>Supplier</Th><Th>Date</Th><Th right>Total</Th><Th>Reason</Th></tr></thead><tbody>{cancelledPos.map((po) => <tr key={po.id} className="border-t border-[#eeeeee]"><Td strong>{po.po_number}</Td><Td>{po.supplier_name}</Td><Td>{dateLabel(po.order_date)}</Td><Td right strong>{money(po.total)}</Td><Td>{po.cancel_reason}</Td></tr>)}</tbody></table></div></section>}
    </main>
  </div>;
}

function SupplierForm({ value, onChange, onSubmit, disabled, onCancel }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return <form onSubmit={onSubmit} className="p-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Field label="Supplier name"><input required className="input" value={value.name} onChange={(e) => set("name", e.target.value)}/></Field><Field label="Contact name"><input className="input" value={value.contactName} onChange={(e) => set("contactName", e.target.value)}/></Field><Field label="Email"><input type="email" className="input" value={value.email} onChange={(e) => set("email", e.target.value)}/></Field><Field label="Phone"><input className="input" value={value.phone} onChange={(e) => set("phone", e.target.value)}/></Field><Field label="Website"><input className="input" value={value.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…"/></Field><Field label="Account #"><input className="input" value={value.accountNumber} onChange={(e) => set("accountNumber", e.target.value)}/></Field><Field label="Payment terms (days)"><input type="number" min="0" max="365" className="input" value={value.paymentTermsDays} onChange={(e) => set("paymentTermsDays", e.target.value)}/></Field><Field label="Notes"><input className="input" value={value.notes} onChange={(e) => set("notes", e.target.value)}/></Field><div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2"><button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm">Cancel</button><button disabled={disabled} className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-60">{disabled ? "Saving…" : "Save supplier"}</button></div></form>;
}

function PurchaseOrderForm({ value, onChange, suppliers, onSubmit, disabled, onCancel }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  const updateItem = (index, key, next) => set("items", value.items.map((item, i) => i === index ? { ...item, [key]: next } : item));
  const removeItem = (index) => set("items", value.items.length > 1 ? value.items.filter((_, i) => i !== index) : value.items);
  const subtotal = value.items.reduce((sum, item) => sum + lineSubtotal(item), 0);
  const gst = value.items.reduce((sum, item) => sum + Number(item.gstHstTax || 0), 0);
  const pst = value.items.reduce((sum, item) => sum + Number(item.pstTax || 0), 0);
  return <form onSubmit={onSubmit} className="p-4 space-y-4"><div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Field label="Supplier"><select required className="input" value={value.supplierId} onChange={(e) => set("supplierId", e.target.value)}><option value="">Select supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Order date"><input required type="date" max={todayValue()} className="input" value={value.orderDate} onChange={(e) => set("orderDate", e.target.value)}/></Field><Field label="Expected date"><input type="date" min={value.orderDate || undefined} className="input" value={value.expectedDate} onChange={(e) => set("expectedDate", e.target.value)}/></Field><Field label="Notes"><input className="input" value={value.notes} onChange={(e) => set("notes", e.target.value)}/></Field></div><div className="rounded-lg border border-[#e3e3e3] overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-[#fafafa] text-xs text-[#666]"><tr><Th>#</Th><Th>SKU</Th><Th>Description</Th><Th>Qty</Th><Th>Unit cost</Th><Th>GST/HST</Th><Th>PST</Th><Th right>Line total</Th><Th/></tr></thead><tbody>{value.items.map((item, index) => <tr key={index} className="border-t border-[#eee]"><Td>{index + 1}</Td><Td><input className="h-8 w-28 rounded border border-[#d5d5d5] px-2" value={item.sku} onChange={(e) => updateItem(index, "sku", e.target.value)}/></Td><Td><input required className="h-8 w-full min-w-[220px] rounded border border-[#d5d5d5] px-2" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)}/></Td><Td><input required type="number" min="0.001" step="0.001" className="h-8 w-24 rounded border border-[#d5d5d5] px-2" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)}/></Td><Td><input required type="number" min="0" step="0.0001" className="h-8 w-28 rounded border border-[#d5d5d5] px-2" value={item.unitCost} onChange={(e) => updateItem(index, "unitCost", e.target.value)}/></Td><Td><input type="number" min="0" step="0.01" className="h-8 w-24 rounded border border-[#d5d5d5] px-2" value={item.gstHstTax} onChange={(e) => updateItem(index, "gstHstTax", e.target.value)}/></Td><Td><input type="number" min="0" step="0.01" className="h-8 w-24 rounded border border-[#d5d5d5] px-2" value={item.pstTax} onChange={(e) => updateItem(index, "pstTax", e.target.value)}/></Td><Td right strong>{money(lineTotal(item))}</Td><Td><button type="button" onClick={() => removeItem(index)} disabled={value.items.length === 1} className="text-red-700 disabled:opacity-30"><Trash2 size={14}/></button></Td></tr>)}</tbody></table></div><div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between"><button type="button" onClick={() => set("items", [...value.items, blankItem()])} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center justify-center gap-2"><Plus size={14}/> Add line</button><div className="text-sm text-right"><span className="text-[#777]">Subtotal {money(subtotal)} · GST/HST {money(gst)} · PST {money(pst)}</span><div className="font-bold text-lg mt-0.5">Total {money(subtotal + gst + pst)}</div></div></div><div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm">Cancel</button><button disabled={disabled} className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-60">{disabled ? "Saving…" : "Save draft PO"}</button></div></form>;
}

function PoRow({ po, saving, onEdit, onApprove, cancelReason, onCancelReason, onCancel }) {
  const items = Array.isArray(po.items) ? po.items : [];
  return <tr className="border-t border-[#eeeeee] align-top"><Td><div className="font-semibold">{po.po_number}</div><div className="text-xs text-[#777]">{po.currency}</div></Td><Td>{po.supplier_name}</Td><Td><div>{dateLabel(po.order_date)}</div><div className="text-xs text-[#777]">Expected {dateLabel(po.expected_date)}</div></Td><Td><div className="font-medium">{items.length} line{items.length === 1 ? "" : "s"}</div><div className="text-xs text-[#777] max-w-[300px] truncate">{items.map((i) => i.description).join(", ")}</div></Td><Td right strong>{money(po.total)}</Td><Td><Status status={po.status}/></Td><Td><div className="flex flex-col gap-2 min-w-[280px]">{po.status === "draft" && <div className="grid grid-cols-2 gap-1"><button type="button" onClick={onEdit} className="h-8 px-2 rounded-md border border-[#d5d5d5] text-xs inline-flex items-center justify-center gap-1"><Pencil size={13}/> Edit</button><button type="button" onClick={onApprove} disabled={saving === `approve-${po.id}`} className="h-8 px-2 rounded-md bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-40"><CheckCircle2 size={13}/> Approve</button></div>}<div className="flex gap-1"><input className="h-8 flex-1 min-w-0 rounded-md border border-[#d5d5d5] px-2 text-xs" value={cancelReason} onChange={(e) => onCancelReason(e.target.value)} placeholder="Cancellation reason"/><button type="button" onClick={onCancel} disabled={saving === `cancel-${po.id}`} className="h-8 px-2 rounded-md border border-red-200 text-red-700 disabled:opacity-40"><XCircle size={14}/></button></div></div></Td></tr>;
}

function Status({ status }) { const style = status === "approved" ? "bg-emerald-100 text-emerald-800" : status === "draft" || status === "active" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"; return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${style}`}>{status}</span>; }
function Metric({ label, value, strong=false }) { return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div></div>; }
function Field({ label, children }) { return <label><div className="text-xs font-medium text-[#666] mb-1">{label}</div>{children}</label>; }
function Th({ children, right=false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right=false, strong=false }) { return <td className={`px-3 py-3 ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
