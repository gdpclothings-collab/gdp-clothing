import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { adminDraftOrdersApi } from "@/lib/adminDraftOrdersApi";

const money = n => new Intl.NumberFormat("en-CA", {style:"currency",currency:"CAD"}).format(Number(n||0));
const round = n => Math.round((Number(n)+Number.EPSILON)*100)/100;
const emptyLine = () => ({name:"",quantity:1,unitPrice:0});
export default function CreateInvoiceEditor({onClose,onCreated,draft=null}) {
  const [documentMeta,setDocumentMeta]=useState(draft?.invoice_document_meta || {});
  const setMeta=(key,value)=>setDocumentMeta(old=>({...old,[key]:value}));
  const [customerName,setCustomerName]=useState(draft?.customer_name || "");
  const [customerEmail,setCustomerEmail]=useState(draft?.customer_email || "");
  const [province,setProvince]=useState(draft?.shipping_address?.province || "Saskatchewan");
  const [lines,setLines]=useState(draft?.order_items?.length ? draft.order_items.map(i=>({name:i.name,quantity:i.quantity,unitPrice:i.unit_price,productId:i.product_id,variantId:i.variant_id,variant:i.variant,size:i.size,color:i.color,image:i.image,fulfillmentMode:i.fulfillment_mode})) : [emptyLine()]);
  const [catalog,setCatalog]=useState([]);
  const [catalogSearch,setCatalogSearch]=useState("");
  const [catalogError,setCatalogError]=useState("");
  const [discount,setDiscount]=useState(draft?.discount || 0);
  const [shipping,setShipping]=useState(draft?.shipping || 0);
  const [notes,setNotes]=useState((draft?.notes || "").replace(/\n?INVOICE PREPARATION — NOT ISSUED/g,"").trim());
  const [dueDate,setDueDate]=useState(draft?.invoice_due_date || "");
  const [paymentTerms,setPaymentTerms]=useState(draft?.invoice_payment_terms || "Due on receipt");
  const [taxRules,setTaxRules]=useState([]);
  const [taxError,setTaxError]=useState("");
  const [busy,setBusy]=useState(false);
  const savingRef=useRef(false);
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
    if(savingRef.current)return;
    setError("");
    if(!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()))return setError("Enter a valid customer email.");
    if(!supported)return setError("Tax rules for this province are unavailable. Use Draft Orders for manual tax review.");
    if(lines.some(x=>!x.name.trim()||!Number.isInteger(Number(x.quantity))||Number(x.quantity)<=0||!Number.isFinite(Number(x.unitPrice))||Number(x.unitPrice)<0))return setError("Each item needs a description, a positive whole-number quantity, and a valid nonnegative price.");
    if(!Number.isFinite(Number(discount))||Number(discount)<0||Number(discount)>subtotal||!Number.isFinite(Number(shipping))||Number(shipping)<0)return setError("Discount must be within the subtotal, and shipping must be nonnegative.");
    if(dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return setError("Choose a valid due date.");
    savingRef.current=true;
    setBusy(true);
    try {
      await adminDraftOrdersApi.saveDraft(draft?.id || null,{
        customerName,customerEmail:customerEmail.trim(),shippingAddress:{province, country:"Canada"},
        items:lines.map(x=>({...x, quantity:Number(x.quantity), unitPrice:Number(x.unitPrice)})),
        discount:Number(discount), shipping:Number(shipping),
        gstHstTax:tax.gst_hst,pstTax:tax.pst,tax:round(tax.gst_hst+tax.pst),
        notes:[notes.trim(),"INVOICE PREPARATION — NOT ISSUED"].filter(Boolean).join("\n"),
        invoiceDueDate:dueDate || null, invoicePaymentTerms:paymentTerms,
        documentMeta
      });
      onCreated();
    }catch(e){setError(e?.message||"Could not save invoice preparation.");}finally{savingRef.current=false;setBusy(false);}
  }
  const field="w-full rounded border border-transparent bg-transparent p-1 outline-none hover:border-slate-300 focus:border-blue-500 focus:bg-blue-50";
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label={draft?"Edit invoice draft":"Create invoice"}>
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center justify-between gap-4 rounded-lg bg-white p-3">
        <div><h2 className="text-lg font-semibold">{draft?"Edit invoice draft":"Create invoice"}</h2><p className="text-xs text-slate-500">Edit directly in the invoice. Saving preserves the draft; issuance and payment are separate.</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={onClose} className="rounded border px-3 py-2">Cancel</button><button type="button" disabled={busy||!supported} onClick={save} className="rounded bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?"Saving…":draft?"Save changes":"Save draft"}</button><button onClick={onClose} aria-label="Close"><X/></button></div>
      </div>
      <div className="rounded-lg bg-white p-5 text-slate-900 shadow-xl sm:p-10">
        <div className="flex flex-wrap justify-between gap-5 border-b pb-5">
          <div className="max-w-xs flex-1"><input aria-label="Business name" className={field+" text-xl font-bold"} placeholder="GDP Clothing" value={documentMeta.business_name||""} onChange={e=>setMeta("business_name",e.target.value)}/><textarea aria-label="Business address" rows={3} className={field+" resize-y text-sm"} placeholder="Saskatoon, Saskatchewan, Canada" value={documentMeta.business_address||""} onChange={e=>setMeta("business_address",e.target.value)}/></div>
          <div className="max-w-xs flex-1 space-y-1 text-right"><input aria-label="Invoice heading" className={field+" text-right text-2xl font-bold"} placeholder="INVOICE" value={documentMeta.header||""} onChange={e=>setMeta("header",e.target.value)}/><p className="text-xs text-slate-500">Invoice number: assigned securely upon issuance</p><label className="block text-xs">Invoice date<input type="date" aria-label="Invoice date" className={field+" text-right"} value={documentMeta.invoice_date||""} onChange={e=>setMeta("invoice_date",e.target.value)}/></label><label className="block text-xs">P.O. / S.O.<input className={field+" text-right"} value={documentMeta.po_so_number||""} onChange={e=>setMeta("po_so_number",e.target.value)}/></label><label className="block text-xs">Payment due<input type="date" className={field+" text-right"} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label className="block text-xs">Payment terms<select className={field+" text-right"} value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)}><option>Due on receipt</option><option>Net 7</option><option>Net 15</option><option>Net 30</option><option>Custom</option></select></label></div>
        </div>
        <div className="grid gap-4 py-5 sm:grid-cols-2"><div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Bill to</h3><input aria-label="Customer name" placeholder="Customer name" className={field+" font-semibold"} value={customerName} onChange={e=>setCustomerName(e.target.value)}/><input aria-label="Customer email" type="email" placeholder="Email address" className={field} value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)}/><label className="mt-1 block text-xs text-slate-500">Province<select className={field} value={province} onChange={e=>setProvince(e.target.value)}>{Object.keys(provinceMap).map(p=><option key={p}>{p}</option>)}</select></label></div><div className="sm:text-right"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Invoice summary</h3><p className="font-semibold">Draft · Unpaid</p><p className="text-sm">Amount due: {money(total)}</p><p className="text-xs text-slate-500">This is not a payment confirmation.</p></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="bg-slate-800 text-white"><tr><th className="p-2 text-left">Item / Description</th><th className="p-2">Qty</th><th className="p-2">Price</th><th className="p-2 text-right">Amount</th><th aria-label="Remove" /></tr></thead><tbody>{lines.map((line,i)=><tr className="border-b" key={i}><td className="p-1"><input className={field} placeholder="Product / service description" value={line.name} onChange={e=>update(i,{name:e.target.value})}/></td><td className="w-20 p-1"><input type="number" min="1" step="1" aria-label="Quantity" className={field+" text-center"} value={line.quantity} onChange={e=>update(i,{quantity:e.target.value})}/></td><td className="w-28 p-1"><input type="number" min="0" step="0.01" aria-label="Unit price" className={field+" text-right"} value={line.unitPrice} onChange={e=>update(i,{unitPrice:e.target.value})}/></td><td className="p-2 text-right">{money(Number(line.quantity)*Number(line.unitPrice))}</td><td><button type="button" aria-label="Remove item" disabled={lines.length===1} onClick={()=>setLines(a=>a.filter((_,n)=>n!==i))}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
        <div className="mt-3"><button type="button" onClick={()=>setLines(a=>[...a,emptyLine()])} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"><Plus size={16}/> Add item</button><input className="mt-2 w-full rounded border p-2 text-sm" placeholder="Search GDP products or SKU" value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)}/>{catalogError&&<p className="text-xs text-amber-700">{catalogError}</p>}{catalogSearch&&<div className="max-h-36 overflow-y-auto rounded border">{matches.map(p=><div className="border-b p-2 text-sm" key={p.id}>{p.name} <div className="flex flex-wrap gap-2">{(p.product_variants||[]).filter(v=>v.active!==false).length?p.product_variants.filter(v=>v.active!==false).map(v=><button className="rounded border px-2" type="button" key={v.id} onClick={()=>addCatalog(p,v)}>{v.name||v.sku} · {money(v.price??p.price)}</button>):<button type="button" className="rounded border px-2" onClick={()=>addCatalog(p,null)}>Add · {money(p.price)}</button>}</div></div>)}</div>}</div>
        <div className="mt-4 ml-auto max-w-xs space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span>{money(subtotal)}</div><label className="flex items-center justify-between">Discount<input type="number" min="0" step=".01" className="w-24 rounded border p-1 text-right" value={discount} onChange={e=>setDiscount(e.target.value)}/></label><label className="flex items-center justify-between">Shipping<input type="number" min="0" step=".01" className="w-24 rounded border p-1 text-right" value={shipping} onChange={e=>setShipping(e.target.value)}/></label><div className="flex justify-between"><span>GST/HST</span>{money(tax.gst_hst)}</div><div className="flex justify-between"><span>PST</span>{money(tax.pst)}</div><div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total CAD</span>{money(total)}</div></div>
        <div className="mt-6"><label className="text-sm font-semibold">Footer / customer notes<textarea rows={3} className="mt-1 w-full rounded border p-2 text-sm" value={documentMeta.footer||""} onChange={e=>setMeta("footer",e.target.value)} placeholder="Thank you for your business!"/></label><label className="mt-2 block text-xs text-slate-500">Internal order notes<textarea rows={2} className="mt-1 w-full rounded border p-2" value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>
        {!supported&&<p className="mt-3 text-sm text-amber-700">{taxError||"Tax rules unavailable. Save disabled to avoid incorrect tax."}</p>}{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  </div>;
}
