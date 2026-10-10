import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { adminDraftOrdersApi } from "@/lib/adminDraftOrdersApi";

const money = n => new Intl.NumberFormat("en-CA", {style:"currency",currency:"CAD"}).format(Number(n||0));
const round = n => Math.round((Number(n)+Number.EPSILON)*100)/100;
const emptyLine = () => ({name:"",quantity:1,unitPrice:0});
export default function CreateInvoiceEditor({onClose,onCreated,draft=null}) {
  const [customerName,setCustomerName]=useState(draft?.customer_name || "");
  const [customerEmail,setCustomerEmail]=useState(draft?.customer_email || "");
  const [province,setProvince]=useState(draft?.shipping_address?.province || "Saskatchewan");
  const [lines,setLines]=useState(draft?.order_items?.length ? draft.order_items.map(i=>({name:i.name,quantity:i.quantity,unitPrice:i.unit_price,productId:i.product_id,variantId:i.variant_id,variant:i.variant,size:i.size,color:i.color,image:i.image,fulfillmentMode:i.fulfillment_mode})) : [emptyLine()]);
  const [catalog,setCatalog]=useState([]);
  const [catalogSearch,setCatalogSearch]=useState("");
  const [catalogError,setCatalogError]=useState("");
  const [discount,setDiscount]=useState(draft?.discount || 0);
  const [shipping,setShipping]=useState(draft?.shipping || 0);
  const [notes,setNotes]=useState(draft?.notes || "");
  const [dueDate,setDueDate]=useState(draft?.invoice_due_date || "");
  const [paymentTerms,setPaymentTerms]=useState(draft?.invoice_payment_terms || "Due on receipt");
  const [taxRules,setTaxRules]=useState([]);
  const [taxError,setTaxError]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{let mounted=true;supabase.from("tax_rules").select("region_code,config,priority").eq("country_code","CA").eq("active",true)
    .then(({data,error})=>{if(!mounted)return;if(error)setTaxError("Configured tax rules are unavailable.");else setTaxRules(data||[]);});return()=>{mounted=false};},[]);
  useEffect(()=>{let active=true;adminDraftOrdersApi.catalog().then(rows=>{if(active)setCatalog(rows);}).catch(()=>{if(active)setCatalogError("Catalog unavailable; manual line items remain available.");});return()=>{active=false};},[]);
  const matches=useMemo(()=>catalog.filter(p=>[p.name,...(p.product_variants||[]).map(v=>v.sku)].join(" ").toLowerCase().includes(catalogSearch.toLowerCase())).slice(0,12),[catalog,catalogSearch]);
  const addCatalog=(p,v)=>{
    setLines(prev=>{
      const item={name:p.name,quantity:1,unitPrice:Number(v?.price??p.price??0),productId:p.id,variantId:v?.id||null,variant:v?.name||"",size:v?.size||"",color:v?.color||"",image:p.images?.[0]||null,fulfillmentMode:p.fulfillment_mode||"in_house"};
      return prev.length===1&&!prev[0].name ? [item] : [...prev,item];
    });setCatalogSearch("");
  };
  const provinceMap={"Saskatchewan":"SK","Alberta":"AB","British Columbia":"BC","Manitoba":"MB","Ontario":"ON","Quebec":"QC","Nova Scotia":"NS","New Brunswick":"NB","Newfoundland and Labrador":"NL","Prince Edward Island":"PE"};
  const region=provinceMap[province];
  const rule=taxRules.filter(x=>x.region_code===region).sort((a,b)=>Number(a.priority||0)-Number(b.priority||0))[0];
  const components=Array.isArray(rule?.config?.components)?rule.config.components:null;
  const supported=Boolean(components?.length && components.every(c=>["gst_hst","pst"].includes(c.bucket)));
  const subtotal=round(lines.reduce((sum,x)=>sum+Number(x.quantity||0)*Number(x.unitPrice||0),0));
  const taxable=Math.max(0,subtotal-Math.min(subtotal,Number(discount||0)));
  const tax=supported?components.reduce((acc,c)=>{const v=round((taxable+(c.tax_shipping?Number(shipping||0):0))*Number(c.rate||0));acc[c.bucket]=round(acc[c.bucket]+v);return acc;},{gst_hst:0,pst:0}):{gst_hst:0,pst:0};
  const total=round(taxable+Number(shipping||0)+tax.gst_hst+tax.pst);
  const update=(i,change)=>setLines(prev=>prev.map((line,n)=>i===n?{...line,...change}:line));
  async function save() {
    setError("");
    if(!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()))return setError("Enter a valid customer email.");
    if(!supported)return setError("Tax rules for this province are unavailable. Use Draft Orders for manual tax review.");
    if(lines.some(x=>!x.name.trim()||Number(x.quantity)<=0||Number(x.unitPrice)<0))return setError("Check all invoice line items.");
    setBusy(true);
    try {
      await adminDraftOrdersApi.saveDraft(draft?.id || null,{
        customerName,customerEmail:customerEmail.trim(),shippingAddress:{province, country:"Canada"},
        items:lines.map(x=>({...x, quantity:Number(x.quantity), unitPrice:Number(x.unitPrice)})),
        discount:Number(discount), shipping:Number(shipping),
        gstHstTax:tax.gst_hst,pstTax:tax.pst,tax:round(tax.gst_hst+tax.pst),
        notes:[notes.trim(),"INVOICE PREPARATION — NOT ISSUED"].filter(Boolean).join("\n"),
        invoiceDueDate:dueDate || null, invoicePaymentTerms:paymentTerms
      });
      onCreated();
    }catch(e){setError(e?.message||"Could not save invoice preparation.");}finally{setBusy(false);}
  }
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Create invoice">
    <div className="mx-auto max-w-5xl rounded-xl bg-white p-5 text-slate-900 shadow-xl sm:p-8">
      <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{draft ? "Edit invoice draft" : "Create invoice"}</h2><p className="text-sm text-slate-600">Prepare an invoice from a local draft. No invoice number or payment is created until authorized issuance.</p></div><button onClick={onClose} aria-label="Close invoice editor"><X/></button></div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm">Customer name<input className="mt-1 w-full rounded border p-2" value={customerName} onChange={e=>setCustomerName(e.target.value)}/></label>
          <label className="block text-sm">Customer email<input type="email" className="mt-1 w-full rounded border p-2" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)}/></label>
          <label className="block text-sm">Province<select className="mt-1 w-full rounded border p-2" value={province} onChange={e=>setProvince(e.target.value)}>{Object.keys(provinceMap).map(p=><option key={p}>{p}</option>)}</select></label>
          <label className="block text-sm">Requested due date<input type="date" className="mt-1 w-full rounded border p-2" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
          <label className="block text-sm">Payment terms<select className="mt-1 w-full rounded border p-2" value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)}><option>Due on receipt</option><option>Net 7</option><option>Net 15</option><option>Net 30</option><option>Custom</option></select></label>
          <h3 className="font-semibold">Items</h3>
          <input className="w-full rounded border p-2 text-sm" placeholder="Search GDP products or SKU" value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)}/>
          {catalogError&&<p className="text-xs text-amber-700">{catalogError}</p>}
          {catalogSearch&&<div className="max-h-40 overflow-y-auto rounded border">{matches.map(p=><div className="border-b p-2 text-sm" key={p.id}><span>{p.name}</span><div className="mt-1 flex flex-wrap gap-1">{(p.product_variants||[]).filter(v=>v.active!==false).length ? p.product_variants.filter(v=>v.active!==false).map(v=><button className="rounded border px-2 py-1" key={v.id} type="button" onClick={()=>addCatalog(p,v)}>{v.name||v.sku} · {money(v.price??p.price)}</button>):<button type="button" className="rounded border px-2 py-1" onClick={()=>addCatalog(p,null)}>Add · {money(p.price)}</button>}</div></div>)}</div>}
          {lines.map((line,i)=><div className="grid grid-cols-12 gap-2" key={i}><input aria-label="Item description" placeholder="Product or service" className="col-span-6 rounded border p-2 text-sm" value={line.name} onChange={e=>update(i,{name:e.target.value})}/><input aria-label="Quantity" type="number" min="1" className="col-span-2 rounded border p-2 text-sm" value={line.quantity} onChange={e=>update(i,{quantity:e.target.value})}/><input aria-label="Unit price" type="number" min="0" step="0.01" className="col-span-3 rounded border p-2 text-sm" value={line.unitPrice} onChange={e=>update(i,{unitPrice:e.target.value})}/><button aria-label="Remove line" className="col-span-1" disabled={lines.length===1} onClick={()=>setLines(a=>a.filter((_,n)=>i!==n))}><Trash2 size={16}/></button></div>)}
          <button type="button" className="flex items-center gap-1 rounded border px-3 py-2 text-sm" onClick={()=>setLines(a=>[...a,emptyLine()])}><Plus size={16}/> Add line</button>
          <label className="block text-sm">Notes<textarea className="mt-1 w-full rounded border p-2" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        </div>
        <div className="space-y-4 rounded-lg border p-5"><h3 className="text-lg font-semibold">Invoice preview</h3><p>GDP Clothing · Saskatoon, Saskatchewan</p><div className="border-t pt-3">{customerName||"Customer"}</div>{lines.map((x,i)=><div className="flex justify-between text-sm" key={i}><span>{x.name||"Item"} × {x.quantity}</span><span>{money(Number(x.quantity)*Number(x.unitPrice))}</span></div>)}
        <label className="flex justify-between gap-3 text-sm">Discount <input type="number" min="0" step="0.01" className="w-28 rounded border p-1 text-right" value={discount} onChange={e=>setDiscount(e.target.value)}/></label>
        <label className="flex justify-between gap-3 text-sm">Shipping <input type="number" min="0" step="0.01" className="w-28 rounded border p-1 text-right" value={shipping} onChange={e=>setShipping(e.target.value)}/></label>
        <div className="flex justify-between text-sm"><span>Subtotal</span>{money(subtotal)}</div><div className="flex justify-between text-sm"><span>GST/HST</span>{money(tax.gst_hst)}</div><div className="flex justify-between text-sm"><span>PST</span>{money(tax.pst)}</div><div className="flex justify-between border-t pt-2 font-semibold"><span>Total CAD</span>{money(total)}</div>
        {!supported&&<p className="text-sm text-amber-700">{taxError||"No complete configured tax components for this province. Save is disabled to prevent inaccurate invoices."}</p>}
        <p className="text-xs text-slate-500">This is a preparation preview, not a numbered tax invoice or receipt. Confirm tax applicability and registration before issuance.</p></div>
      </div>
      {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button className="rounded border px-4 py-2" onClick={onClose}>Cancel</button><button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy||!supported} onClick={save}>{busy?"Saving…":"Save invoice draft"}</button></div>
    </div></div>;
}
