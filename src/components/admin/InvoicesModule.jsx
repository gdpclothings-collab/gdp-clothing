import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Printer, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import CreateInvoiceEditor from "@/components/admin/CreateInvoiceEditor";

const cad = (value) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(value || 0));
const paidStatus = (order) => String(order.payment_status || "").toLowerCase() === "paid";
const hasTaxSplit = (order) => Math.abs(Number(order.gst_hst_tax || 0) + Number(order.pst_tax || 0) - Number(order.tax || 0)) < 0.011;
const cleanDate = (value) => value ? new Date(value).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "—";


const printInvoiceDocument = () => {
  const invoice = document.getElementById("gdp-invoice-print");
  if (!invoice) return;
  // An isolated frame avoids printing the Admin shell or duplicating its page flow.
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "GDP invoice print");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  // Print the saved values rather than controls from an unsaved editor session.
  const source = invoice.cloneNode(true);
  source.querySelectorAll("[data-print-value]").forEach((element) => {
    element.textContent = element.getAttribute("data-print-value") || "";
  });
  source.querySelectorAll("input,textarea,button").forEach(element => element.remove());
  const styles = [...document.head.querySelectorAll('style,link[rel="stylesheet"]')]
    .map((node) => node.outerHTML).join("");
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><base href="' +
    document.baseURI.replace(/"/g, "&quot;") + '">' + styles +
    '<style>@page{size:auto;margin:12mm}html,body{margin:0!important;padding:0!important;height:auto!important;min-height:0!important;overflow:visible!important}#gdp-invoice-print{position:static!important;width:100%!important;max-width:none!important;box-shadow:none!important;border-radius:0!important;padding:0!important;margin:0!important}tr{break-inside:avoid}</style>' +
    '</head><body>' + source.outerHTML + '</body></html>');
  doc.close();
  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  frame.onload = runPrint;
  setTimeout(runPrint, 700);
  frame.contentWindow?.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 1000), { once: true });
  setTimeout(() => frame.remove(), 120000);
};

export default function InvoicesModule() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [documentEditing,setDocumentEditing] = useState(false);
  const [savedDocumentMeta,setSavedDocumentMeta] = useState({});
  const [documentMeta,setDocumentMeta] = useState({});
  const [documentSaving,setDocumentSaving] = useState(false);
  const [editingDraft,setEditingDraft]=useState(null);
  const [issued, setIssued] = useState({});
  const [issuing, setIssuing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // Reuse existing orders and the admin's existing RLS grants; no duplicate accounting records.
      const { data, error: queryError } = await supabase.from("orders")
        .select("id,order_number,created_at,customer_name,customer_email,customer_phone,subtotal,discount,shipping,tax,gst_hst_tax,pst_tax,total,status,payment_status,billing_address,shipping_address,invoice_document_meta,notes,invoice_due_date,invoice_payment_terms,order_items(name,variant,size,color,quantity,unit_price,product_id,variant_id,image,fulfillment_mode)")
        .order("created_at", { ascending: false }).limit(200);
      if (queryError) throw queryError;
      setOrders(data || []);
      const { data: invoices, error: ledgerError } = await supabase.from("gdp_invoices").select("order_id,invoice_number,issued_at,snapshot").order("issued_at", { ascending: false }).limit(500);
      if (ledgerError) throw ledgerError;
      setIssued(Object.fromEntries((invoices || []).map((invoice) => [invoice.order_id, invoice])));
    } catch (err) {
      setError(err?.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };
  const saveDocumentMeta = async () => {
    if (!selected || selected.status !== "draft" || issued[selected.id]) return;
    setDocumentSaving(true); setError("");
    try {
      const { error: saveError } = await supabase.rpc("save_admin_invoice_document_meta", {p_order_id:selected.id,p_meta:documentMeta});
      if(saveError) throw saveError;
      setOrders(old=>old.map(o=>o.id===selected.id ? {...o,invoice_document_meta:documentMeta}:o));
      setSelected(old=>({...old,invoice_document_meta:documentMeta}));
      setSavedDocumentMeta(documentMeta);
      setDocumentEditing(false);
    } catch(err) {setError(err?.message||"Unable to save invoice document");}
    finally {setDocumentSaving(false);}
  };
  const issue = async (order) => {
    if (!window.confirm("Issue an immutable invoice for this order? Its financial snapshot cannot be edited afterward.")) return;
    setIssuing(true);
    setError("");
    try {
      const { data, error: issueError } = await supabase.rpc("issue_admin_order_invoice", { p_order_id: order.id });
      if (issueError) throw issueError;
      setIssued((old) => ({ ...old, [order.id]: data }));
      setSelected((old) => old?.id === order.id ? { ...old, ...(data.snapshot || {}), created_at: data.snapshot?.order_date || old.created_at, payment_status: data.snapshot?.payment_status_at_issue || old.payment_status, order_items: data.snapshot?.items || old.order_items } : old);
    } catch (err) { setError(err?.message || "Invoice issuance failed."); }
    finally { setIssuing(false); }
  };
  useEffect(() => { load(); }, []);
  const statusOf = (order) => issued[order.id] ? (paidStatus(order) ? "paid" : "issued") : order.status === "draft" ? "draft" : paidStatus(order) ? "paid" : "unpaid";
  const customers = [...new Set(orders.map(o => o.customer_email).filter(Boolean))].sort();
  const counts = {draft:0,unpaid:0,issued:0,paid:0};
  orders.forEach(o => {const status=statusOf(o);counts[status]=(counts[status]||0)+1;});
  const pendingAmount = orders.filter(o => ["unpaid","issued"].includes(statusOf(o))).reduce((n,o)=>n+Number(o.total||0),0);
  const visible = orders.filter(order => {
    const matchText = [order.order_number, issued[order.id]?.invoice_number, order.customer_name, order.customer_email].join(" ").toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter === "all" || statusOf(order) === statusFilter;
    const matchCustomer = customerFilter === "all" || order.customer_email === customerFilter;
    const date = String(order.created_at || "").slice(0,10);
    return matchText && matchStatus && matchCustomer && (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  });
  return <div className="space-y-6 px-4 py-5 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-semibold">Invoices</h2><p className="text-sm text-slate-500">Manage online and local orders, previews, and issued invoices.</p></div>
      <div className="flex gap-2"><button type="button" onClick={()=>{setEditingDraft(null);setEditorOpen(true);}} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create invoice</button><Link to="/admin/draft-orders" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create local draft order</Link><button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={15}/> Refresh</button></div>
    </div>
    <div className="grid grid-cols-2 gap-3 rounded-xl border bg-white p-4 lg:grid-cols-4">
      <div><p className="text-xs text-slate-500">Draft orders</p><p className="text-xl font-semibold">{counts.draft}</p></div>
      <div><p className="text-xs text-slate-500">Unpaid orders</p><p className="text-xl font-semibold">{counts.unpaid}</p></div>
      <div><p className="text-xs text-slate-500">Issued invoices</p><p className="text-xl font-semibold">{counts.issued + counts.paid}</p></div>
      <div><p className="text-xs text-slate-500">Open order value</p><p className="text-xl font-semibold">{cad(pendingAmount)}</p></div>
    </div>
    <div className="grid gap-2 md:grid-cols-4">
      <select aria-label="Filter customer" className="rounded-lg border p-2 text-sm" value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)}><option value="all">All customers</option>{customers.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <input aria-label="From date" type="date" className="rounded-lg border p-2 text-sm" value={fromDate} onChange={e=>setFromDate(e.target.value)}/>
      <input aria-label="To date" type="date" className="rounded-lg border p-2 text-sm" value={toDate} onChange={e=>setToDate(e.target.value)}/>
      <input aria-label="Search invoice, order or customer" className="rounded-lg border p-2 text-sm" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search invoice # or customer"/>
    </div>
    <div className="flex flex-wrap gap-2 border-b pb-3">{[{id:"all",name:"All"},{id:"unpaid",name:"Unpaid"},{id:"draft",name:"Draft"},{id:"issued",name:"Issued"},{id:"paid",name:"Paid"}].map(tab=><button key={tab.id} type="button" aria-pressed={statusFilter===tab.id} onClick={()=>setStatusFilter(tab.id)} className={`rounded-full px-4 py-2 text-sm ${statusFilter===tab.id?"bg-slate-900 text-white":"bg-slate-100 text-slate-700"}`}>{tab.name}{tab.id!=="all" ? ` (${counts[tab.id]})` : ""}</button>)}</div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {loading ? <p>Loading orders…</p> : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-800"><tr><th className="p-3">Status</th><th className="p-3">Date</th><th className="p-3">Order / Invoice #</th><th className="p-3">Customer</th><th className="p-3">Amount</th><th className="p-3">Actions</th></tr></thead><tbody>{visible.map((order) => <tr className="border-t" key={order.id}><td className="p-3 capitalize">{statusOf(order)}</td><td className="p-3">{cleanDate(order.created_at)}</td><td className="p-3">{issued[order.id]?.invoice_number || order.order_number}</td><td className="p-3">{order.customer_name || order.customer_email || "Guest"}</td><td className="p-3">{cad(order.total)}</td><td className="p-3"><button type="button" className="inline-flex items-center gap-1 underline" onClick={() => { const snapshot = issued[order.id]?.snapshot; setDocumentMeta(snapshot?.invoice_document_meta || order.invoice_document_meta || {}); setSavedDocumentMeta(snapshot?.invoice_document_meta || order.invoice_document_meta || {}); setDocumentEditing(false); setSelected(snapshot ? { ...order, ...snapshot, created_at: snapshot.order_date || order.created_at, payment_status: snapshot.payment_status_at_issue || order.payment_status, order_items: snapshot.items || order.order_items } : order); }}><FileText size={15}/> {issued[order.id] ? issued[order.id].invoice_number : "Preview"}</button>{order.status === "draft" && String(order.notes||"").includes("INVOICE PREPARATION — NOT ISSUED") && <button type="button" className="ml-3 underline" onClick={()=>{setEditingDraft(order);setEditorOpen(true);}}>Edit draft</button>}</td></tr>)}{visible.length === 0 && <tr><td colSpan={6} className="p-6 text-center">No matching orders in the most recent 200.</td></tr>}</tbody></table></div>}
    {editorOpen && <CreateInvoiceEditor draft={editingDraft} onClose={()=>{setEditorOpen(false);setEditingDraft(null);}} onCreated={()=>{setEditorOpen(false);setEditingDraft(null);load();}}/>}
    {selected && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Order invoice preview">
      <div className="mx-auto max-w-3xl space-y-3">{error && <p role="alert" className="rounded-lg bg-white p-3 text-sm text-red-700 print:hidden">{error}</p>}
        <div className="flex justify-end gap-2 print:hidden">{selected.status === "draft" && !issued[selected.id] && <button type="button" onClick={()=>setDocumentEditing(v=>!v)} className="rounded-lg bg-white px-3 py-2 text-black">Edit document layout</button>}{!issued[selected.id] && <button type="button" disabled={issuing || selected.status === "draft" || selected.status === "cancelled"} onClick={() => issue(selected)} className="rounded-lg bg-white px-4 py-2 text-black disabled:opacity-50">{issuing ? "Issuing…" : "Issue numbered invoice"}</button>}<button type="button" onClick={printInvoiceDocument} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-black"><Printer size={16}/> Print / Save PDF</button><button type="button" onClick={() => setSelected(null)} aria-label="Close preview" className="rounded-lg bg-white p-2 text-black"><X size={20}/></button></div>
        {documentEditing && <div className="rounded-lg bg-white p-3 text-sm text-slate-700 print:hidden">Edit the highlighted fields directly on the invoice. Changes are only saved when you select Save layout.</div>}
        {documentEditing && <div className="flex justify-end gap-2 print:hidden"><button onClick={()=>{setDocumentMeta(savedDocumentMeta);setDocumentEditing(false);}} className="rounded bg-white px-4 py-2 text-slate-900">Cancel</button><button disabled={documentSaving} onClick={saveDocumentMeta} className="rounded bg-white px-4 py-2 font-semibold text-slate-900 disabled:opacity-50">{documentSaving?"Saving…":"Save layout"}</button></div>}
        <div id="gdp-invoice-print" className="rounded-xl bg-white p-6 text-slate-900 shadow-lg sm:p-10">
          <div className="flex justify-between gap-6 border-b-2 border-slate-200 pb-6"><div><h2 className="text-2xl font-bold" data-print-value={savedDocumentMeta.business_name || "GDP Clothing"}>{documentEditing ? <input type="text" aria-label="GDP Clothing" className="w-full rounded border border-blue-400 bg-blue-50 p-1 text-slate-900" placeholder="GDP Clothing" value={documentMeta.business_name || ""} onChange={e=>setDocumentMeta(old=>({...old,business_name:e.target.value}))}/> : (documentMeta.business_name || "GDP Clothing")}</h2><p className="whitespace-pre-line text-sm" data-print-value={savedDocumentMeta.business_address || "Saskatoon, Saskatchewan, Canada"}>{documentEditing ? <textarea aria-label="Business address" rows={3} className="w-full rounded border border-blue-400 bg-blue-50 p-1 text-slate-900" value={documentMeta.business_address || ""} placeholder="Saskatoon, Saskatchewan, Canada" onChange={e=>setDocumentMeta(old=>({...old,business_address:e.target.value}))}/> : (documentMeta.business_address || "Saskatoon, Saskatchewan, Canada")}</p></div><div className="text-right"><h3 className="text-2xl font-bold tracking-wide" data-print-value={savedDocumentMeta.header || "INVOICE"}>{documentEditing ? <input aria-label="Invoice heading" className="w-full rounded border border-blue-400 bg-blue-50 p-1 text-right" value={documentMeta.header || ""} placeholder="PRO FORMA INVOICE" onChange={e=>setDocumentMeta(old=>({...old,header:e.target.value}))}/> : (documentMeta.header || (issued[selected.id] ? "INVOICE" : (paidStatus(selected) ? "ORDER RECEIPT" : "PRO FORMA INVOICE")))}</h3>{issued[selected.id] && <p className="text-sm font-bold">Invoice: {issued[selected.id].invoice_number}</p>}<p className="text-sm">Reference: {selected.order_number}</p><p className="text-sm">Invoice date: {documentEditing ? <input aria-label="Invoice date" type="date" className="rounded border border-blue-400 bg-blue-50 p-1" value={documentMeta.invoice_date || ""} onChange={e=>setDocumentMeta(old=>({...old,invoice_date:e.target.value}))}/> : (documentMeta.invoice_date || cleanDate(selected.created_at))}</p>{(documentEditing || documentMeta.po_so_number) && <p className="text-sm">P.O. / S.O.: {documentEditing ? <input aria-label="PO or SO number" className="rounded border border-blue-400 bg-blue-50 p-1" value={documentMeta.po_so_number || ""} onChange={e=>setDocumentMeta(old=>({...old,po_so_number:e.target.value}))}/> : documentMeta.po_so_number}</p>}{issued[selected.id] && <p className="text-sm">Issued: {cleanDate(issued[selected.id].issued_at)}</p>}</div></div>
          <div className="grid grid-cols-1 gap-5 py-6 text-sm sm:grid-cols-2"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bill to</p><p className="font-semibold">{selected.customer_name || "Customer"}</p><p>{selected.customer_email || ""}</p><p>{selected.customer_phone || ""}</p>{selected.billing_address && typeof selected.billing_address === "object" && <p>{[selected.billing_address.line1,selected.billing_address.city,selected.billing_address.province,selected.billing_address.postal_code].filter(Boolean).join(", ")}</p>}</div><div className="space-y-2 sm:text-right"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment summary</p><p><span className="font-semibold">Status: </span>{paidStatus(selected) ? "Paid" : ["pending","pending_payment","unpaid"].includes(String(selected.payment_status || "").toLowerCase()) ? "Unpaid" : (selected.payment_status || "Not confirmed")}</p><p><span className="font-semibold">Invoice total: </span>{cad(selected.total)}</p>{!paidStatus(selected) && <p><span className="font-semibold">Amount due: </span>{cad(selected.total)} <span className="text-xs text-slate-500">(assuming no partial payments)</span></p>}{selected.invoice_due_date && <p><span className="font-semibold">Due date: </span>{cleanDate(selected.invoice_due_date)}</p>}<p className="text-xs text-slate-500">{issued[selected.id] ? "Payment status shown as recorded when this invoice was issued; verify the payment ledger for current settlement." : "Payment status comes from the order; this preview is not proof of payment."}</p></div></div>
          <table className="w-full text-sm"><thead className="bg-slate-800 text-white"><tr className="text-left"><th className="px-3 py-3">Item</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-right">Price</th><th className="px-3 py-3 text-right">Amount</th></tr></thead><tbody>{(selected.order_items || []).map((item, i) => <tr key={i} className="border-b"><td className="py-2">{item.name}<div className="text-xs text-slate-500">{[item.variant, item.size, item.color].filter(Boolean).join(" · ")}</div></td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right">{cad(item.unit_price)}</td><td className="py-2 text-right">{cad(Number(item.unit_price || 0) * Number(item.quantity || 0))}</td></tr>)}</tbody></table>
          <div className="ml-auto mt-5 max-w-xs space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{cad(selected.subtotal)}</span></div><div className="flex justify-between"><span>Discount</span><span>−{cad(selected.discount)}</span></div><div className="flex justify-between"><span>Shipping</span><span>{cad(selected.shipping)}</span></div>{hasTaxSplit(selected) ? <><div className="flex justify-between"><span>GST/HST</span><span>{cad(selected.gst_hst_tax)}</span></div><div className="flex justify-between"><span>PST</span><span>{cad(selected.pst_tax)}</span></div></> : <div className="flex justify-between"><span>Tax (combined; breakdown unavailable)</span><span>{cad(selected.tax)}</span></div>}<div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total CAD</span><span>{cad(selected.total)}</span></div></div>
          {(selected.invoice_due_date || selected.invoice_payment_terms) && <div className="mt-5 space-y-1 border-t pt-3 text-sm">{selected.invoice_due_date && <p>Due date: {cleanDate(selected.invoice_due_date)}</p>}{selected.invoice_payment_terms && <p>Payment terms: {selected.invoice_payment_terms}</p>}</div>}
          {(documentEditing || documentMeta.footer) && (documentEditing ? <textarea aria-label="Invoice footer" rows={3} className="mt-7 w-full rounded border border-blue-400 bg-blue-50 p-2 text-sm" value={documentMeta.footer || ""} placeholder="Invoice notes / footer" onChange={e=>setDocumentMeta(old=>({...old,footer:e.target.value}))}/> : <p className="mt-7 whitespace-pre-line text-sm">{documentMeta.footer}</p>)}
          <p className="mt-8 text-xs text-slate-500">Tax registration numbers and credit notes are not yet supported in this invoice workflow. Verify applicable registration details before distributing this document as a tax invoice. Payment status is taken from the order record and is not independent confirmation of settlement.</p>
        </div>
      </div>
      <style>{`@media print { @page { size: auto; margin: 10mm; } html, body, #root { height: auto !important; min-height: 0 !important; overflow: visible !important; } body { margin: 0 !important; } body * { visibility: hidden !important; } #gdp-invoice-print, #gdp-invoice-print * { visibility: visible !important; } #gdp-invoice-print { position: absolute !important; top: 0 !important; left: 0 !important; width: calc(100% - 20mm) !important; max-width: none !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; break-inside: auto !important; } #gdp-invoice-print tr { break-inside: avoid; } }`}</style>
    </div>}
  </div>;
}
