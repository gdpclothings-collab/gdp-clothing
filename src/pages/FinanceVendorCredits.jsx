import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, FileText, PackageMinus, Plus, RefreshCw, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { adminVendorCreditsApi } from "@/lib/adminVendorCreditsApi";

const money = (value) => Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const qty = (value) => Number(value || 0).toLocaleString("en-CA", { maximumFractionDigits: 3 });
const localDateValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};
const blankCredit = () => ({ issueDate: localDateValue(), supplierId: "", purchaseOrderId: "", vendor: "", creditNumber: "", description: "", amount: "", gstHstTax: "0", pstTax: "0", notes: "" });
const blankReturn = () => ({ receiptId: "", returnDate: localDateValue(), reason: "", notes: "", items: [] });

export default function FinanceVendorCredits() {
  const [data, setData] = useState({ summary: {}, credits: [], returns: [], returnableReceipts: [], openBills: [], suppliers: [], purchaseOrders: [], creditEvents: [], returnEvents: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCredit, setShowCredit] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [creditForm, setCreditForm] = useState(blankCredit());
  const [returnForm, setReturnForm] = useState(blankReturn());
  const [billSelections, setBillSelections] = useState({});
  const [applicationNotes, setApplicationNotes] = useState({});
  const [voidReasons, setVoidReasons] = useState({});
  const [applicationReasons, setApplicationReasons] = useState({});
  const [returnReasons, setReturnReasons] = useState({});

  const load = async () => {
    setLoading(true); setError("");
    try { setData(await adminVendorCreditsApi.load({ limit: 1000 })); }
    catch (err) { console.error("Vendor credits load failed:", err); setError(err?.message || "Could not load vendor credits and returns."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const summary = data.summary || {};
  const credits = Array.isArray(data.credits) ? data.credits : [];
  const returns = Array.isArray(data.returns) ? data.returns : [];
  const receipts = Array.isArray(data.returnableReceipts) ? data.returnableReceipts : [];
  const openBills = Array.isArray(data.openBills) ? data.openBills : [];
  const suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
  const purchaseOrders = Array.isArray(data.purchaseOrders) ? data.purchaseOrders : [];

  const run = async (key, action, success) => {
    setSaving(key); setError(""); setNotice("");
    try { await action(); setNotice(success); await load(); return true; }
    catch (err) { setError(err?.message || "Vendor credit / return action failed."); return false; }
    finally { setSaving(""); }
  };

  const saveCredit = async (event) => {
    event.preventDefault();
    const ok = await run("credit-create", () => adminVendorCreditsApi.createCredit(creditForm), "Vendor credit recorded. It has no cash impact until it is applied to an open bill.");
    if (ok) { setCreditForm(blankCredit()); setShowCredit(false); }
  };

  const selectReceipt = (receiptId) => {
    const receipt = receipts.find((row) => row.id === receiptId);
    setReturnForm({ receiptId, returnDate: localDateValue(), reason: "", notes: "", items: (receipt?.items || []).map((item) => ({ purchaseReceiptItemId: item.purchaseReceiptItemId, quantityReturned: "" })) });
  };

  const updateReturnQty = (itemId, value) => setReturnForm((current) => ({ ...current, items: current.items.map((item) => item.purchaseReceiptItemId === itemId ? { ...item, quantityReturned: value } : item) }));

  const postReturn = async (event) => {
    event.preventDefault();
    const ok = await run("return-create", () => adminVendorCreditsApi.postReturn(returnForm), "Purchase return posted. Stock was reduced only for mapped inventory lines and a vendor credit was created automatically.");
    if (ok) { setReturnForm(blankReturn()); setShowReturn(false); }
  };

  const applyCredit = async (credit) => {
    const billId = billSelections[credit.id];
    const ok = await run(`apply-${credit.id}`, () => adminVendorCreditsApi.applyCredit(credit.id, billId, applicationNotes[credit.id] || ""), "Vendor credit applied. The bill's net payable was recalculated; a fully covered bill is settled without cash movement.");
    if (ok) { setBillSelections((x) => ({ ...x, [credit.id]: "" })); setApplicationNotes((x) => ({ ...x, [credit.id]: "" })); }
  };

  const voidCredit = async (credit) => {
    const reason = voidReasons[credit.id] || "";
    const ok = await run(`void-${credit.id}`, () => adminVendorCreditsApi.voidCredit(credit.id, reason), "Vendor credit voided and preserved in audit history.");
    if (ok) setVoidReasons((x) => ({ ...x, [credit.id]: "" }));
  };

  const reverseApplication = async (application) => {
    const reason = applicationReasons[application.id] || "";
    const ok = await run(`app-reverse-${application.id}`, () => adminVendorCreditsApi.reverseApplication(application.id, reason), "Credit application reversed. The credit and bill balances were restored and audited.");
    if (ok) setApplicationReasons((x) => ({ ...x, [application.id]: "" }));
  };

  const reverseReturn = async (row) => {
    const reason = returnReasons[row.id] || "";
    const ok = await run(`return-reverse-${row.id}`, () => adminVendorCreditsApi.reverseReturn(row.id, reason), "Purchase return reversed. Returned stock was restored and its unused vendor credit was voided.");
    if (ok) setReturnReasons((x) => ({ ...x, [row.id]: "" }));
  };

  const selectedReceipt = receipts.find((row) => row.id === returnForm.receiptId);
  const compatibleBills = (credit) => openBills.filter((bill) => {
    if (credit.purchase_order_id) return bill.purchase_order_id === credit.purchase_order_id;
    if (credit.supplier_id && bill.supplier_id) return credit.supplier_id === bill.supplier_id;
    return String(credit.vendor || "").trim().toLowerCase() === String(bill.vendor || "").trim().toLowerCase();
  });
  const filteredPurchaseOrders = useMemo(() => purchaseOrders.filter((po) => !creditForm.supplierId || po.supplierId === creditForm.supplierId), [purchaseOrders, creditForm.supplierId]);

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm"><div className="h-full px-3 md:px-5 flex items-center gap-3">
      <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
      <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><PackageMinus size={16}/> Vendor Credits &amp; Purchase Returns</div>
      <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
    </div></header>

    <div className="border-b border-[#dedfe3] bg-white"><div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
      <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 19</div>
      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Vendor Credits &amp; Purchase Returns</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Return received goods safely, create supplier credits, and apply those credits against open payables without inventing cash movement or duplicate expenses.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button><button type="button" onClick={() => setShowReturn((v) => !v)} disabled={!receipts.length} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40"><PackageMinus size={14}/> Purchase Return</button><button type="button" onClick={() => setShowCredit((v) => !v)} className="h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2"><Plus size={14}/> Vendor Credit</button></div></div>
    </div></div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Credits reduce liabilities; they are not payments</div><div className="mt-1 text-xs">A vendor credit has no cash or expense impact by itself. Applying it reduces the open bill. If a bill becomes fully covered it is marked Settled with no payment. If a balance remains, the later bill payment creates exactly one Finance expense for only that net balance.</div></div></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3"><Metric label="Open credits" value={loading ? "—" : String(summary.openCreditCount || 0)}/><Metric label="Available credit" value={loading ? "—" : money(summary.availableCreditTotal)} strong/><Metric label="Applied credits" value={loading ? "—" : String(summary.appliedCreditCount || 0)}/><Metric label="Posted returns" value={loading ? "—" : String(summary.postedReturnCount || 0)}/><Metric label="Return credit value" value={loading ? "—" : money(summary.postedReturnCreditTotal)}/><Metric label="Returnable receipts" value={loading ? "—" : String(summary.returnableReceiptCount || 0)}/></div>

      {showCredit && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Record manual vendor credit</div><div className="text-xs text-[#777] mt-0.5">Use this for supplier credit memos or price adjustments not created by a GDP purchase return. Link a PO when the credit belongs to one.</div></div><form onSubmit={saveCredit} className="p-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3"><Field label="Issue date"><input type="date" required max={localDateValue()} className="input" value={creditForm.issueDate} onChange={(e) => setCreditForm({ ...creditForm, issueDate: e.target.value })}/></Field><Field label="Supplier (optional)"><select className="input" value={creditForm.supplierId} onChange={(e) => setCreditForm({ ...creditForm, supplierId: e.target.value, purchaseOrderId: "" })}><option value="">Manual vendor name</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Purchase order (optional)"><select className="input" value={creditForm.purchaseOrderId} onChange={(e) => setCreditForm({ ...creditForm, purchaseOrderId: e.target.value })}><option value="">No PO link</option>{filteredPurchaseOrders.map((po) => <option key={po.id} value={po.id}>{po.poNumber} · {po.supplierName}</option>)}</select></Field><Field label="Vendor name"><input className="input" value={creditForm.vendor} onChange={(e) => setCreditForm({ ...creditForm, vendor: e.target.value })} placeholder="Used when no supplier is selected"/></Field><Field label="Credit memo #"><input className="input" value={creditForm.creditNumber} onChange={(e) => setCreditForm({ ...creditForm, creditNumber: e.target.value })} placeholder="Optional; GDP can generate one"/></Field><Field label="Description"><input required className="input" value={creditForm.description} onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })}/></Field><Field label="Pre-tax credit"><input type="number" min="0" step="0.01" className="input" value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}/></Field><Field label="GST/HST credit"><input type="number" min="0" step="0.01" className="input" value={creditForm.gstHstTax} onChange={(e) => setCreditForm({ ...creditForm, gstHstTax: e.target.value })}/></Field><Field label="PST credit"><input type="number" min="0" step="0.01" className="input" value={creditForm.pstTax} onChange={(e) => setCreditForm({ ...creditForm, pstTax: e.target.value })}/></Field><Field label="Notes"><input className="input" value={creditForm.notes} onChange={(e) => setCreditForm({ ...creditForm, notes: e.target.value })}/></Field><div className="md:col-span-2 xl:col-span-4 flex justify-end gap-2"><button type="button" onClick={() => setShowCredit(false)} className="h-9 px-3 rounded-lg border border-[#d5d5d5]">Cancel</button><button disabled={saving === "credit-create"} className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-50">{saving === "credit-create" ? "Saving…" : "Save vendor credit"}</button></div></form></section>}

      {showReturn && <section className="rounded-xl border border-amber-200 bg-white overflow-hidden"><div className="px-4 py-3 border-b border-amber-100 bg-amber-50"><div className="text-sm font-semibold text-amber-950">Post purchase return</div><div className="text-xs text-amber-900/75 mt-0.5">Only quantities actually received and not previously returned are available. Stock-linked lines also require enough stock at the original receiving location.</div></div><form onSubmit={postReturn} className="p-4 space-y-4"><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3"><Field label="Purchase receipt"><select required className="input" value={returnForm.receiptId} onChange={(e) => selectReceipt(e.target.value)}><option value="">Select received goods</option>{receipts.map((r) => <option key={r.id} value={r.id}>{r.receipt_number} · {r.po_number} · {r.supplier_name}</option>)}</select></Field><Field label="Return date"><input type="date" required max={localDateValue()} min={selectedReceipt?.received_date || undefined} className="input" value={returnForm.returnDate} onChange={(e) => setReturnForm({ ...returnForm, returnDate: e.target.value })}/></Field><Field label="Reason"><input required className="input" value={returnForm.reason} onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })} placeholder="Damaged, wrong size, supplier return…"/></Field><Field label="Notes"><input className="input" value={returnForm.notes} onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}/></Field></div>{selectedReceipt && <div className="rounded-lg border border-[#e1e1e1] overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-[#fafafa] text-xs text-[#666]"><tr><Th>Line</Th><Th>SKU / Item</Th><Th>Received</Th><Th>Already returned</Th><Th>Returnable</Th><Th>Return now</Th><Th>Inventory</Th></tr></thead><tbody>{(selectedReceipt.items || []).map((item) => <tr key={item.purchaseReceiptItemId} className="border-t border-[#eee]"><Td>{item.lineNumber}</Td><Td><div className="font-medium">{item.sku || "—"}</div><div className="text-xs text-[#777]">{item.description}</div></Td><Td>{qty(item.quantityReceived)}</Td><Td>{qty(item.quantityReturned)}</Td><Td strong>{qty(item.returnableQuantity)}</Td><Td><input type="number" min="0" max={item.returnableQuantity} step={item.inventoryVariantId ? "1" : "0.001"} className="h-8 w-28 rounded border border-[#d5d5d5] px-2" value={returnForm.items.find((x) => x.purchaseReceiptItemId === item.purchaseReceiptItemId)?.quantityReturned || ""} onChange={(e) => updateReturnQty(item.purchaseReceiptItemId, e.target.value)}/></Td><Td>{item.inventoryVariant ? `${item.inventoryVariant.sku || ""} · stock ${item.inventoryVariant.stock}` : "Non-stock"}</Td></tr>)}</tbody></table></div>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setShowReturn(false)} className="h-9 px-3 rounded-lg border border-[#d5d5d5]">Cancel</button><button disabled={saving === "return-create" || !returnForm.receiptId} className="h-9 px-4 rounded-lg bg-amber-700 text-white text-sm font-semibold disabled:opacity-50">{saving === "return-create" ? "Posting…" : "Post return & create credit"}</button></div></form></section>}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Vendor credits</div><div className="text-xs text-[#777] mt-0.5">Apply uses the maximum compatible component amounts (pre-tax, GST/HST, PST) without exceeding either the credit or the bill.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Status</Th><Th>Credit / Vendor</Th><Th>Source</Th><Th right>Total</Th><Th right>Applied</Th><Th right>Available</Th><Th>Apply / Void</Th></tr></thead><tbody>{loading ? <Empty cols={7}>Loading credits…</Empty> : credits.length ? credits.map((credit) => { const bills = compatibleBills(credit); const applications = Array.isArray(credit.applications) ? credit.applications : []; return <React.Fragment key={credit.id}><tr className="border-t border-[#eee] align-top"><Td><Badge value={credit.status}/></Td><Td><div className="font-semibold">{credit.credit_number}</div><div className="text-xs text-[#777]">{credit.vendor} · {credit.issue_date}</div><div className="text-xs mt-1">{credit.description}</div></Td><Td><div className="capitalize">{String(credit.source_type || "manual").replaceAll("_", " ")}</div><div className="text-xs text-[#777]">{credit.purchase_order_number || "No PO"}</div></Td><Td right strong>{money(credit.total)}</Td><Td right>{money(credit.applied_total)}</Td><Td right strong>{money(credit.remaining_total)}</Td><Td><div className="min-w-[420px] space-y-2">{credit.status === "open" && Number(credit.remaining_total || 0) > 0 && <div className="grid grid-cols-[1fr_1fr_auto] gap-1"><select className="h-8 rounded border border-[#d5d5d5] px-2 text-xs" value={billSelections[credit.id] || ""} onChange={(e) => setBillSelections((x) => ({ ...x, [credit.id]: e.target.value }))}><option value="">Select compatible bill</option>{bills.map((b) => <option key={b.id} value={b.id}>{b.bill_number || b.id.slice(0, 8)} · Net {money(b.net_total)}</option>)}</select><input className="h-8 rounded border border-[#d5d5d5] px-2 text-xs" value={applicationNotes[credit.id] || ""} onChange={(e) => setApplicationNotes((x) => ({ ...x, [credit.id]: e.target.value }))} placeholder="Optional apply note"/><button type="button" onClick={() => applyCredit(credit)} disabled={!billSelections[credit.id] || saving === `apply-${credit.id}`} className="h-8 px-3 rounded bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40">Apply</button></div>}{credit.status === "open" && credit.source_type === "manual" && !applications.some((a) => a.status === "active") && <div className="flex gap-1"><input className="h-8 flex-1 rounded border border-red-200 px-2 text-xs" value={voidReasons[credit.id] || ""} onChange={(e) => setVoidReasons((x) => ({ ...x, [credit.id]: e.target.value }))} placeholder="Void reason"/><button type="button" onClick={() => voidCredit(credit)} disabled={!String(voidReasons[credit.id] || "").trim() || saving === `void-${credit.id}`} className="h-8 px-2 rounded border border-red-200 bg-red-50 text-red-700 text-xs disabled:opacity-40">Void</button></div>}</div></Td></tr>{applications.map((app) => <tr key={app.id} className="border-t border-dashed border-[#ececec] bg-[#fcfcfc]"><td colSpan={3} className="px-3 py-2 text-xs text-[#666]">Application → {app.bill_number || "Bill"} · {app.bill_status}</td><td className="px-3 py-2 text-right text-xs" colSpan={2}>{money(Number(app.amount || 0)+Number(app.gst_hst_tax || 0)+Number(app.pst_tax || 0))}</td><td className="px-3 py-2 text-xs"><Badge value={app.status}/></td><td className="px-3 py-2">{app.status === "active" && app.bill_status !== "paid" && <div className="flex gap-1 max-w-[420px]"><input className="h-7 flex-1 rounded border border-[#d5d5d5] px-2 text-xs" value={applicationReasons[app.id] || ""} onChange={(e) => setApplicationReasons((x) => ({ ...x, [app.id]: e.target.value }))} placeholder="Required reversal reason"/><button type="button" onClick={() => reverseApplication(app)} disabled={!String(applicationReasons[app.id] || "").trim() || saving === `app-reverse-${app.id}`} className="h-7 px-2 rounded border border-[#d5d5d5] text-xs disabled:opacity-40"><Undo2 size={12}/></button></div>}</td></tr>)}</React.Fragment>; }) : <Empty cols={7}>No vendor credits yet.</Empty>}</tbody></table></div></section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Purchase return history</div><div className="text-xs text-[#777] mt-0.5">Reversal is allowed only while the generated credit is unused. Stock is restored to the original receiving location.</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Return</Th><Th>PO / Receipt</Th><Th>Supplier</Th><Th>Lines</Th><Th right>Credit</Th><Th>Status</Th><Th>Reversal</Th></tr></thead><tbody>{loading ? <Empty cols={7}>Loading returns…</Empty> : returns.length ? returns.map((row) => <tr key={row.id} className="border-t border-[#eee] align-top"><Td><div className="font-semibold">{row.return_number}</div><div className="text-xs text-[#777]">{row.return_date}</div><div className="text-xs mt-1">{row.reason}</div></Td><Td><div>{row.po_number}</div><div className="text-xs text-[#777]">{row.receipt_number}</div></Td><Td>{row.supplier_name}</Td><Td><div className="space-y-1">{(row.items || []).map((item) => <div key={item.id} className="text-xs">#{item.lineNumber} {item.sku || ""} · {qty(item.quantityReturned)} returned</div>)}</div></Td><Td right strong>{money(row.credit_total)}<div className="text-xs text-[#777]">{row.credit_number}</div></Td><Td><Badge value={row.status}/><div className="mt-1"><Badge value={row.credit_status}/></div></Td><Td>{row.status === "posted" && row.credit_status === "open" ? <div className="flex gap-1 min-w-[330px]"><input className="h-8 flex-1 rounded border border-[#d5d5d5] px-2 text-xs" value={returnReasons[row.id] || ""} onChange={(e) => setReturnReasons((x) => ({ ...x, [row.id]: e.target.value }))} placeholder="Required reversal reason"/><button type="button" onClick={() => reverseReturn(row)} disabled={!String(returnReasons[row.id] || "").trim() || saving === `return-reverse-${row.id}`} className="h-8 px-2 rounded border border-[#d5d5d5] text-xs inline-flex items-center gap-1 disabled:opacity-40"><RotateCcw size={12}/> Reverse</button></div> : <span className="text-xs text-[#888]">{row.reverse_reason || (row.credit_status !== "open" ? "Reverse credit application first" : "Read only")}</span>}</Td></tr>) : <Empty cols={7}>No purchase returns yet.</Empty>}</tbody></table></div></section>

      <div className="grid lg:grid-cols-2 gap-5"><Activity title="Recent credit activity" items={data.creditEvents}/><Activity title="Recent return activity" items={data.returnEvents}/></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 flex gap-3"><AlertTriangle size={18} className="shrink-0"/><div><div className="font-semibold">Closed purchase orders stay frozen</div><div className="text-xs mt-1">To add/reverse a return, apply/reverse a PO-linked credit, or void a linked credit, reopen the PO first. After corrections, PO Closeout rechecks net bills against the PO value after credits.</div></div></div>
    </main>
  </div>;
}

function Activity({ title, items }) { const rows = Array.isArray(items) ? items.slice(0, 20) : []; return <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed] text-sm font-semibold">{title}</div><div className="divide-y divide-[#eee]">{rows.length ? rows.map((row) => <div key={row.id} className="px-4 py-3 text-xs flex gap-3"><span className="font-semibold capitalize">{String(row.event_type || "").replaceAll("_", " ")}</span><span className="flex-1 text-[#666]">{row.reason || "Recorded"}</span><span className="text-[#888]">{row.created_at ? new Date(row.created_at).toLocaleString("en-CA") : ""}</span></div>) : <div className="px-4 py-8 text-center text-sm text-[#777]">No activity yet.</div>}</div></section>; }
function Badge({ value }) { const clean = String(value || "").replaceAll("_", " "); const good = ["open","applied","posted","active","settled"].includes(String(value)); const bad = ["voided","reversed"].includes(String(value)); return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${bad ? "bg-slate-200 text-slate-700" : good ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{clean || "—"}</span>; }
function Metric({ label, value, strong=false }) { return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div></div>; }
function Field({ label, children }) { return <label><div className="text-xs font-medium text-[#666] mb-1">{label}</div>{children}</label>; }
function Th({ children, right=false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right=false, strong=false }) { return <td className={`px-3 py-3 ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
