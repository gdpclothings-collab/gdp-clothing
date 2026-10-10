import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Printer, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const cad = (value) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(value || 0));
const paidStatus = (order) => String(order.payment_status || "").toLowerCase() === "paid";
const hasTaxSplit = (order) => Math.abs(Number(order.gst_hst_tax || 0) + Number(order.pst_tax || 0) - Number(order.tax || 0)) < 0.011;
const cleanDate = (value) => value ? new Date(value).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function InvoicesModule() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [issued, setIssued] = useState({});
  const [issuing, setIssuing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // Reuse existing orders and the admin's existing RLS grants; no duplicate accounting records.
      const { data, error: queryError } = await supabase.from("orders")
        .select("id,order_number,created_at,customer_name,customer_email,customer_phone,subtotal,discount,shipping,tax,gst_hst_tax,pst_tax,total,status,payment_status,billing_address,order_items(name,variant,size,color,quantity,unit_price)")
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
  const issue = async (order) => {
    if (!window.confirm("Issue an immutable invoice for this order? Its financial snapshot cannot be edited afterward.")) return;
    setIssuing(true);
    setError("");
    try {
      const { data, error: issueError } = await supabase.rpc("issue_admin_order_invoice", { p_order_id: order.id });
      if (issueError) throw issueError;
      setIssued((old) => ({ ...old, [order.id]: data }));
      setSelected((old) => old?.id === order.id ? { ...old, ...(data.snapshot || {}), order_items: data.snapshot?.items || old.order_items } : old);
    } catch (err) { setError(err?.message || "Invoice issuance failed."); }
    finally { setIssuing(false); }
  };
  useEffect(() => { load(); }, []);
  const visible = orders.filter((order) => [order.order_number, order.customer_name, order.customer_email].join(" ").toLowerCase().includes(filter.toLowerCase()));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Invoice previews</h2><p className="text-sm text-slate-500">Print order details for online and manually created orders. Only orders explicitly marked paid show a receipt; other orders show a pro forma document.</p></div>
      <div className="flex flex-wrap gap-2"><Link to="/admin/draft-orders" className="rounded-lg border px-3 py-2 text-sm">Create local draft order</Link><button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={15}/> Refresh</button></div>
    </div>
    <label className="block"><span className="sr-only">Find an order</span><input className="w-full max-w-lg rounded-lg border bg-transparent p-2" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search order number or customer" /></label>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {loading ? <p>Loading orders…</p> : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-800"><tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Payment</th><th className="p-3">Total</th><th className="p-3">Document</th></tr></thead><tbody>{visible.map((order) => <tr className="border-t" key={order.id}><td className="p-3">{order.order_number}</td><td className="p-3">{order.customer_name || order.customer_email || "Guest"}</td><td className="p-3">{order.payment_status || "Unknown"}</td><td className="p-3">{cad(order.total)}</td><td className="p-3"><button type="button" className="inline-flex items-center gap-1 underline" onClick={() => { const snapshot = issued[order.id]?.snapshot; setSelected(snapshot ? { ...order, ...snapshot, order_items: snapshot.items || order.order_items } : order); }}><FileText size={15}/> {issued[order.id] ? issued[order.id].invoice_number : "Preview"}</button></td></tr>)}{visible.length === 0 && <tr><td colSpan={5} className="p-6 text-center">No matching orders in the most recent 200.</td></tr>}</tbody></table></div>}
    {selected && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Order invoice preview">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex justify-end gap-2 print:hidden">{!issued[selected.id] && <button type="button" disabled={issuing || selected.status === "draft" || selected.status === "cancelled"} onClick={() => issue(selected)} className="rounded-lg bg-white px-4 py-2 text-black disabled:opacity-50">{issuing ? "Issuing…" : "Issue numbered invoice"}</button>}<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-black"><Printer size={16}/> Print / Save PDF</button><button type="button" onClick={() => setSelected(null)} aria-label="Close preview" className="rounded-lg bg-white p-2 text-black"><X size={20}/></button></div>
        <div id="gdp-invoice-print" className="rounded-xl bg-white p-6 text-slate-900 shadow-lg sm:p-10">
          <div className="flex justify-between gap-6 border-b pb-6"><div><h2 className="text-2xl font-bold">GDP Clothing</h2><p className="text-sm">Saskatoon, Saskatchewan, Canada</p></div><div className="text-right"><h3 className="text-xl font-bold">{issued[selected.id] ? "INVOICE (ORDER PREVIEW)" : (paidStatus(selected) ? "ORDER RECEIPT" : "PRO FORMA INVOICE")}</h3>{issued[selected.id] && <p className="text-sm font-bold">Invoice: {issued[selected.id].invoice_number}</p>}<p className="text-sm">Reference: {selected.order_number}</p><p className="text-sm">Order date: {cleanDate(selected.created_at)}</p></div></div>
          <div className="grid grid-cols-2 gap-4 py-6 text-sm"><div><p className="font-bold">Bill to</p><p>{selected.customer_name || "Customer"}</p><p>{selected.customer_email || ""}</p><p>{selected.customer_phone || ""}</p>{selected.billing_address && typeof selected.billing_address === "object" && <p>{[selected.billing_address.line1,selected.billing_address.city,selected.billing_address.province,selected.billing_address.postal_code].filter(Boolean).join(", ")}</p>}</div><div className="text-right"><p className="font-bold">Payment status</p><p>{selected.payment_status || "Unknown"}</p><p className="mt-2 text-xs text-slate-600">{issued[selected.id] ? "Issued invoice financial details come from its immutable saved snapshot." : "This document reflects the current order record, not a separately issued tax invoice."}</p></div></div>
          <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{(selected.order_items || []).map((item, i) => <tr key={i} className="border-b"><td className="py-2">{item.name}<div className="text-xs text-slate-500">{[item.variant, item.size, item.color].filter(Boolean).join(" · ")}</div></td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right">{cad(item.unit_price)}</td><td className="py-2 text-right">{cad(Number(item.unit_price || 0) * Number(item.quantity || 0))}</td></tr>)}</tbody></table>
          <div className="ml-auto mt-5 max-w-xs space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{cad(selected.subtotal)}</span></div><div className="flex justify-between"><span>Discount</span><span>−{cad(selected.discount)}</span></div><div className="flex justify-between"><span>Shipping</span><span>{cad(selected.shipping)}</span></div>{hasTaxSplit(selected) ? <><div className="flex justify-between"><span>GST/HST</span><span>{cad(selected.gst_hst_tax)}</span></div><div className="flex justify-between"><span>PST</span><span>{cad(selected.pst_tax)}</span></div></> : <div className="flex justify-between"><span>Tax (combined; breakdown unavailable)</span><span>{cad(selected.tax)}</span></div>}<div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total CAD</span><span>{cad(selected.total)}</span></div></div>
          <p className="mt-8 text-xs text-slate-500">For detailed GST/PST tax invoices, registration numbers, immutable issue numbers and credit notes, use the planned dedicated invoice ledger. Payment status is taken from the order record and is not independent confirmation of settlement.</p>
        </div>
      </div>
      <style>{`@media print { body * { visibility: hidden !important; } #gdp-invoice-print, #gdp-invoice-print * { visibility: visible !important; } #gdp-invoice-print { position: absolute !important; inset: 0 auto auto 0; width: 100%; box-shadow: none !important; padding: 20px !important; } @page { margin: 12mm; } }`}</style>
    </div>}
  </div>;
}
