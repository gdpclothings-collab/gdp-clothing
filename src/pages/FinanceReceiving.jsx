import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, FileText, Link2, RefreshCw, ShieldCheck, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { adminReceivingApi } from "@/lib/adminReceivingApi";

const CATEGORIES = [["garments","Garments"],["dtf_transfers","DTF transfers"],["ink","Ink"],["packaging","Packaging"],["shipping","Shipping"],["equipment","Equipment"],["supplies","Supplies"],["miscellaneous","Miscellaneous"]];
const money = (value) => Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const todayValue = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Regina", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Regina", year: "numeric", month: "short", day: "numeric" }).format(new Date(`${String(value).slice(0,10)}T12:00:00-06:00`)) : "—";
const addDays = (dateValue, days) => {
  const [y,m,d] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(y,m-1,d + Number(days || 0)));
  return date.toISOString().slice(0,10);
};
const blankBill = (po, supplier) => {
  const issueDate = todayValue();
  return {
    issueDate,
    dueDate: addDays(issueDate, supplier?.payment_terms_days || 0),
    billNumber: "",
    category: "garments",
    description: po ? `Purchase order ${po.po_number}` : "",
    amount: po ? String(po.subtotal || 0) : "",
    gstHstTax: po ? String(po.gst_hst_tax || 0) : "0",
    pstTax: po ? String(po.pst_tax || 0) : "0",
    itcEligible: false,
    notes: "",
  };
};

export default function FinanceReceiving() {
  const [data,setData] = useState({ summary:{}, suppliers:[], purchaseOrders:[], receipts:[], inventoryVariants:[], locations:[] });
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [selectedPoId,setSelectedPoId] = useState("");
  const [receiptDate,setReceiptDate] = useState(todayValue());
  const [locationId,setLocationId] = useState("");
  const [receiptNotes,setReceiptNotes] = useState("");
  const [receiveQty,setReceiveQty] = useState({});
  const [reverseReasons,setReverseReasons] = useState({});
  const [billForm,setBillForm] = useState(blankBill());

  const load = async () => {
    setLoading(true); setError("");
    try {
      const next = await adminReceivingApi.load({ limit:1000 });
      setData(next);
      const approved = (next.purchaseOrders || []).filter((po) => po.status === "approved");
      setSelectedPoId((current) => approved.some((po) => po.id === current) ? current : (approved[0]?.id || ""));
      const defaultLocation = (next.locations || []).find((loc) => loc.is_default) || (next.locations || [])[0];
      setLocationId((current) => current || defaultLocation?.id || "");
    } catch (err) {
      console.error("Receiving load failed:",err);
      setError(err?.message || "Could not load receiving data.");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const approvedPos = useMemo(() => (data.purchaseOrders || []).filter((po) => po.status === "approved"), [data.purchaseOrders]);
  const selectedPo = approvedPos.find((po) => po.id === selectedPoId) || null;
  const supplier = (data.suppliers || []).find((s) => s.id === selectedPo?.supplier_id) || null;
  const poReceipts = useMemo(() => (data.receipts || []).filter((r) => r.purchase_order_id === selectedPoId), [data.receipts,selectedPoId]);

  useEffect(() => {
    setReceiveQty({});
    setReceiptNotes("");
    setReceiptDate(todayValue());
    setBillForm(blankBill(selectedPo,supplier));
  }, [selectedPoId, selectedPo?.updated_at]);

  const run = async (key, action, success) => {
    setSaving(key); setError(""); setNotice("");
    try { await action(); setNotice(success); await load(); return true; }
    catch (err) { setError(err?.message || "Receiving action failed."); return false; }
    finally { setSaving(""); }
  };

  const linkVariant = async (item, variantId) => {
    await run(`link-${item.id}`, () => adminReceivingApi.linkInventoryVariant(item.id, variantId || null), variantId ? "Inventory variant linked to this PO line." : "Inventory link removed from this PO line.");
  };

  const fillRemaining = () => {
    const next = {};
    for (const item of selectedPo?.items || []) next[item.id] = Number(item.remaining_quantity || 0) > 0 ? String(item.remaining_quantity) : "0";
    setReceiveQty(next);
  };

  const postReceipt = async (event) => {
    event.preventDefault();
    if (!selectedPo) return;
    const items = (selectedPo.items || []).map((item) => ({ purchaseOrderItemId:item.id, quantityReceived:receiveQty[item.id] || "0" }));
    const ok = await run(`receive-${selectedPo.id}`, () => adminReceivingApi.postReceipt(selectedPo.id,{ receivedDate:receiptDate, locationId, notes:receiptNotes, items }), "Receipt posted. Linked stock lines were added to inventory; non-stock lines changed no inventory.");
    if (ok) setReceiveQty({});
  };

  const reverseReceipt = async (receipt) => {
    const reason = reverseReasons[receipt.id] || "";
    const ok = await run(`reverse-${receipt.id}`, () => adminReceivingApi.reverseReceipt(receipt.id,reason), "Receipt reversed. Linked stock was removed only after the inventory safety check passed.");
    if (ok) setReverseReasons((current) => ({ ...current, [receipt.id]:"" }));
  };

  const createBill = async (event) => {
    event.preventDefault();
    if (!selectedPo) return;
    const ok = await run(`bill-${selectedPo.id}`, () => adminReceivingApi.createLinkedBill(selectedPo.id,billForm), "PO-linked vendor bill created in Accounts Payable. No expense or cash movement occurs until the bill is marked paid.");
    if (ok) setBillForm(blankBill(selectedPo,supplier));
  };

  const summary = data.summary || {};

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm"><div className="h-full px-3 md:px-5 flex items-center gap-3">
      <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
      <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><Boxes size={16}/> Receiving &amp; PO Match</div>
      <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
    </div></header>

    <div className="border-b border-[#dedfe3] bg-white"><div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
      <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 17</div>
      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Receiving &amp; PO-to-Bill Matching</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Receive approved purchase orders safely, update inventory only for explicitly linked stock lines, and connect supplier invoices to the originating PO.</p></div><div className="flex gap-2"><button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading?"animate-spin":""}/> Refresh</button><Link to="/admin/finance/purchasing" className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2"><FileText size={14}/> Purchasing</Link><Link to="/admin/finance/payables" className="h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2"><FileText size={14}/> Bills / AP</Link></div></div>
    </div></div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Controlled receiving</div><div className="mt-1 text-xs">A PO line affects stock only after you explicitly link it to a product variant. Posting a receipt is audited and immutable; reversal requires a reason and is blocked if it would make available stock negative. Creating a linked bill records AP only—payment still uses the existing Phase 15 workflow.</div></div></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3"><Metric label="Approved POs" value={loading?"—":String(summary.approvedCount||0)}/><Metric label="Partial receipts" value={loading?"—":String(summary.partialReceiveCount||0)}/><Metric label="Fully received" value={loading?"—":String(summary.receivedCount||0)}/><Metric label="Posted receipts" value={loading?"—":String(summary.postedReceiptCount||0)}/><Metric label="Bill variances" value={loading?"—":String(summary.billVarianceCount||0)} alert={Number(summary.billVarianceCount||0)>0}/></div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Select approved purchase order</div></div><div className="p-4"><select className="input max-w-2xl" value={selectedPoId} onChange={(e)=>setSelectedPoId(e.target.value)}><option value="">No approved purchase order</option>{approvedPos.map((po)=><option key={po.id} value={po.id}>{po.po_number} · {po.supplier_name} · {money(po.total)} · {po.receiving_status}</option>)}</select></div></section>

      {selectedPo && <>
        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed] flex flex-col md:flex-row md:items-center md:justify-between gap-2"><div><div className="text-sm font-semibold">{selectedPo.po_number} · {selectedPo.supplier_name}</div><div className="text-xs text-[#777] mt-0.5">Ordered {dateLabel(selectedPo.order_date)} · Expected {dateLabel(selectedPo.expected_date)} · PO total {money(selectedPo.total)}</div></div><div className="flex gap-2"><Badge value={selectedPo.receiving_status}/><Badge value={`bill ${selectedPo.bill_match_status}`}/></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Line</Th><Th>SKU / Description</Th><Th right>Ordered</Th><Th right>Received</Th><Th right>Remaining</Th><Th>Inventory link</Th><Th right>Stock</Th></tr></thead><tbody>{(selectedPo.items||[]).map((item)=><tr key={item.id} className="border-t border-[#eee]"><Td>{item.line_number}</Td><Td><div className="font-medium">{item.sku||"No SKU"}</div><div className="text-xs text-[#777]">{item.description}</div></Td><Td right>{item.quantity}</Td><Td right>{item.received_quantity||0}</Td><Td right strong>{item.remaining_quantity||0}</Td><Td><select disabled={Number(item.received_quantity||0)>0 || Boolean(saving)} className="h-9 w-[330px] max-w-full rounded-md border border-[#d5d5d5] px-2 text-xs disabled:bg-[#f5f5f5]" value={item.inventory_variant_id||""} onChange={(e)=>linkVariant(item,e.target.value)}><option value="">Non-stock / no inventory movement</option>{(data.inventoryVariants||[]).map((variant)=><option key={variant.id} value={variant.id}>{variant.sku||"No SKU"} · {variant.name||"Variant"} · {variant.color||""} {variant.size||""}</option>)}</select></Td><Td right>{item.inventory_variant?.stock ?? "—"}</Td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed] flex items-center justify-between"><div><div className="text-sm font-semibold">Post receiving</div><div className="text-xs text-[#777] mt-0.5">Enter only the quantities physically received. Partial receipts are supported.</div></div><button type="button" onClick={fillRemaining} className="h-8 px-3 rounded-md border border-[#d5d5d5] text-xs font-semibold">Receive all remaining</button></div><form onSubmit={postReceipt} className="p-4 space-y-4"><div className="grid md:grid-cols-3 gap-3"><Field label="Received date"><input type="date" required max={todayValue()} min={selectedPo.order_date} className="input" value={receiptDate} onChange={(e)=>setReceiptDate(e.target.value)}/></Field><Field label="Inventory location"><select className="input" value={locationId} onChange={(e)=>setLocationId(e.target.value)}><option value="">No stock location</option>{(data.locations||[]).map((loc)=><option key={loc.id} value={loc.id}>{loc.name}{loc.is_default?" · Default":""}</option>)}</select></Field><Field label="Receipt notes"><input className="input" value={receiptNotes} onChange={(e)=>setReceiptNotes(e.target.value)} placeholder="Packing slip, condition, notes"/></Field></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{(selectedPo.items||[]).filter((item)=>Number(item.remaining_quantity||0)>0).map((item)=><label key={item.id} className="rounded-lg border border-[#e1e1e1] p-3"><div className="text-xs font-semibold">Line {item.line_number} · {item.sku||"No SKU"}</div><div className="text-xs text-[#777] mt-0.5 truncate">{item.description}</div><div className="mt-2 flex items-center gap-2"><input type="number" min="0" max={item.remaining_quantity} step={item.inventory_variant_id?"1":"0.001"} className="input" value={receiveQty[item.id]??"0"} onChange={(e)=>setReceiveQty((current)=>({...current,[item.id]:e.target.value}))}/><span className="text-xs text-[#777] whitespace-nowrap">of {item.remaining_quantity}</span></div><div className="text-[11px] mt-1 text-[#777]">{item.inventory_variant_id?"Stock-linked: inventory will increase":"Non-stock: Finance receiving only"}</div></label>)}</div><div className="flex justify-end"><button disabled={Boolean(saving)} className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-50">{saving===`receive-${selectedPo.id}`?"Posting…":"Post receipt"}</button></div></form></section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Create linked vendor bill</div><div className="text-xs text-[#777] mt-0.5">Defaults use the PO amounts. Change them to the supplier invoice if needed; a difference will show as a bill variance.</div></div><form onSubmit={createBill} className="p-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Field label="Issue date"><input required type="date" className="input" min={selectedPo.order_date} max={todayValue()} value={billForm.issueDate} onChange={(e)=>setBillForm({...billForm,issueDate:e.target.value})}/></Field><Field label="Due date"><input required type="date" className="input" min={billForm.issueDate||undefined} value={billForm.dueDate} onChange={(e)=>setBillForm({...billForm,dueDate:e.target.value})}/></Field><Field label="Invoice #"><input className="input" value={billForm.billNumber} onChange={(e)=>setBillForm({...billForm,billNumber:e.target.value})}/></Field><Field label="Category"><select className="input" value={billForm.category} onChange={(e)=>setBillForm({...billForm,category:e.target.value})}>{CATEGORIES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Field><Field label="Description"><input required className="input" value={billForm.description} onChange={(e)=>setBillForm({...billForm,description:e.target.value})}/></Field><Field label="Pre-tax amount"><input required type="number" min="0.01" step="0.01" className="input" value={billForm.amount} onChange={(e)=>setBillForm({...billForm,amount:e.target.value})}/></Field><Field label="GST/HST"><input type="number" min="0" step="0.01" className="input" value={billForm.gstHstTax} onChange={(e)=>setBillForm({...billForm,gstHstTax:e.target.value})}/></Field><Field label="PST"><input type="number" min="0" step="0.01" className="input" value={billForm.pstTax} onChange={(e)=>setBillForm({...billForm,pstTax:e.target.value})}/></Field><Field label="Notes"><input className="input" value={billForm.notes} onChange={(e)=>setBillForm({...billForm,notes:e.target.value})}/></Field><label className="flex items-center gap-2 text-sm md:pt-6"><input type="checkbox" checked={billForm.itcEligible} onChange={(e)=>setBillForm({...billForm,itcEligible:e.target.checked})}/> GST/HST ITC eligible</label><div className="md:col-span-2 xl:col-span-2 flex items-end justify-end"><button disabled={Boolean(saving)} className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Link2 size={14}/>{saving===`bill-${selectedPo.id}`?"Creating…":"Create linked AP bill"}</button></div></form>
          {(selectedPo.linked_bills||[]).length>0 && <div className="border-t border-[#eee] p-4"><div className="text-xs font-semibold text-[#666] mb-2">Linked bills · billed {money(selectedPo.billed_total)} vs PO {money(selectedPo.total)}</div><div className="flex flex-wrap gap-2">{selectedPo.linked_bills.map((bill)=><Link key={bill.id} to="/admin/finance/payables" className="rounded-lg border border-[#ddd] px-3 py-2 text-xs hover:bg-[#fafafa]"><span className="font-semibold">{bill.bill_number||"No invoice #"}</span> · {bill.status} · {money(bill.total)}</Link>)}</div></div>}
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Receipt history</div><div className="text-xs text-[#777] mt-0.5">Posted receipts are never hard-deleted. Reversal requires a reason and sufficient available stock.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Receipt</Th><Th>Date</Th><Th>Location</Th><Th>Lines</Th><Th>Status</Th><Th>Action / Reason</Th></tr></thead><tbody>{poReceipts.length?poReceipts.map((receipt)=><tr key={receipt.id} className="border-t border-[#eee] align-top"><Td strong>{receipt.receipt_number}</Td><Td>{dateLabel(receipt.received_date)}</Td><Td>{receipt.location_name||"Non-stock"}</Td><Td>{(receipt.items||[]).map((item)=><div key={item.id} className="text-xs">{item.quantity_received} × {item.sku||item.description}</div>)}</Td><Td><Badge value={receipt.status}/></Td><Td>{receipt.status==="posted"?<div className="flex gap-1 min-w-[280px]"><input className="h-8 flex-1 rounded-md border border-[#d5d5d5] px-2 text-xs" value={reverseReasons[receipt.id]||""} onChange={(e)=>setReverseReasons((current)=>({...current,[receipt.id]:e.target.value}))} placeholder="Reversal reason"/><button type="button" disabled={saving===`reverse-${receipt.id}`} onClick={()=>reverseReceipt(receipt)} className="h-8 px-2 rounded-md border border-red-200 text-red-700 disabled:opacity-40"><Undo2 size={14}/></button></div>:<div className="text-xs text-[#777]">{receipt.reverse_reason}</div>}</Td></tr>):<Empty cols={6}>No receipts for this purchase order.</Empty>}</tbody></table></div></section>
      </>}

      {!selectedPo && !loading && <div className="rounded-xl border border-dashed border-[#ccc] bg-white p-10 text-center text-sm text-[#777]">No approved purchase orders are ready for receiving.</div>}
    </main>
  </div>;
}

function Metric({label,value,alert=false}) { return <div className={`rounded-xl border bg-white p-4 ${alert?"border-amber-300":"border-[#dedede]"}`}><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl font-semibold tabular-nums ${alert?"text-amber-800":""}`}>{value}</div></div>; }
function Badge({value}) { const clean=String(value||"none").replaceAll("_"," "); const positive=["received","matched","posted"].some((key)=>clean.includes(key)); const warn=["partial","variance"].some((key)=>clean.includes(key)); return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${positive?"bg-emerald-100 text-emerald-800":warn?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-700"}`}>{clean}</span>; }
function Field({label,children}) { return <label><div className="text-xs font-medium text-[#666] mb-1">{label}</div>{children}</label>; }
function Th({children,right=false}) { return <th className={`px-3 py-2.5 font-medium ${right?"text-right":"text-left"}`}>{children}</th>; }
function Td({children,right=false,strong=false}) { return <td className={`px-3 py-3 ${right?"text-right tabular-nums":""} ${strong?"font-semibold":""}`}>{children}</td>; }
function Empty({cols,children}) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
