import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { adminDraftOrdersApi } from "@/lib/adminDraftOrdersApi";
import { adminCustomersApi } from "@/lib/adminCustomersApi";

const money = n => new Intl.NumberFormat("en-CA", {style:"currency",currency:"CAD"}).format(Number(n||0));
const round = n => Math.round((Number(n)+Number.EPSILON)*100)/100;
const emptyLine = () => ({name:"",quantity:1,unitPrice:0});
export default function CreateInvoiceEditor({onClose,onCreated,draft=null}) {
  const [documentMeta,setDocumentMeta]=useState(draft?.invoice_document_meta || {});
  const setMeta=(key,value)=>setDocumentMeta(old=>({...old,[key]:value}));
  const [customerMode,setCustomerMode]=useState("existing");
  const [customerPanel,setCustomerPanel]=useState(false);
  const [customerTab,setCustomerTab]=useState("Contact");
  const [customerSearch,setCustomerSearch]=useState("");
  const [customerOptions,setCustomerOptions]=useState([]);
  const [customerLoading,setCustomerLoading]=useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [discountEnabled,setDiscountEnabled]=useState(Number(draft?.discount||0)>0);
  const [shippingEnabled,setShippingEnabled]=useState(Number(draft?.shipping||0)>0);
  const [customerPhone,setCustomerPhone]=useState(draft?.customer_phone || "");
  const [billing,setBilling]=useState(draft?.billing_address || {});
  const [shippingAddress,setShippingAddress]=useState(draft?.shipping_address || {});
  const [customerName,setCustomerName]=useState(draft?.customer_name || "");
  const [customerEmail,setCustomerEmail]=useState(draft?.customer_email || "");
  const [province,setProvince]=useState(draft?.shipping_address?.province || draft?.billing_address?.province || "Saskatchewan");
  const [lines,setLines]=useState(draft?.order_items?.length ? draft.order_items.map(i=>({name:i.name,quantity:i.quantity,unitPrice:i.unit_price,productId:i.product_id,variantId:i.variant_id,variant:i.variant,size:i.size,color:i.color,image:i.image,fulfillmentMode:i.fulfillment_mode})) : [emptyLine()]);
  const [catalog,setCatalog]=useState([]);
  const [catalogSearch,setCatalogSearch]=useState("");
  const [catalogError,setCatalogError]=useState("");
  const [discount,setDiscount]=useState(draft?.discount || 0);
  const [shipping,setShipping]=useState(draft?.shipping || 0);
  const [notes,setNotes]=useState((draft?.notes || "").replace(/\n?INVOICE PREPARATION — NOT ISSUED/g,"").trim());
  const [dueDate,setDueDate]=useState(draft?.invoice_due_date || "");
  const [taxRules,setTaxRules]=useState([]);
  const [taxEnabled,setTaxEnabled]=useState({gst_hst:draft?.invoice_document_meta?.tax_flags?.gst_hst!==false,pst:draft?.invoice_document_meta?.tax_flags?.pst!==false});
  const [taxError,setTaxError]=useState("");
  const [busy,setBusy]=useState(false);
  const savingRef=useRef(false);
  const [error,setError]=useState("");
  useEffect(()=>{let mounted=true;setCustomerLoading(true);adminCustomersApi.list({pageSize:100}).then(result=>{if(mounted)setCustomerOptions(result.customers||[]);}).catch(()=>{}).finally(()=>{if(mounted)setCustomerLoading(false)});return()=>{mounted=false};},[]);
  const selectCustomer=(c)=>{setCustomerName(c.name||"");setCustomerEmail(c.email||"");setCustomerPhone(c.phone||"");setCustomerPanel(false);};
  const updateAddress=(kind,key,value)=>{const setter=kind==="billing"?setBilling:setShippingAddress;setter(old=>({...old,[key]:value}));if(kind==="shipping"&&key==="province")setProvince(value);};
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
  const effectiveDiscount=discountEnabled?Number(discount||0):0;
  const effectiveShipping=shippingEnabled?Number(shipping||0):0;
  const taxable=Math.max(0,subtotal-Math.min(subtotal,effectiveDiscount));
  const tax=supported?components.reduce((acc,c)=>{if(!taxEnabled[c.bucket])return acc;const v=round((taxable+(c.tax_shipping?effectiveShipping:0))*Number(c.rate||0));acc[c.bucket]=round(acc[c.bucket]+v);return acc;},{gst_hst:0,pst:0}):{gst_hst:0,pst:0};
  const total=round(taxable+effectiveShipping+tax.gst_hst+tax.pst);
  const update=(i,change)=>setLines(prev=>prev.map((line,n)=>i===n?{...line,...change}:line));
  async function save() {
    if(savingRef.current)return;
    setError("");
    if(!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()))return setError("Enter a valid customer email.");
    if(!supported)return setError("Tax rules for this province are unavailable. Use Draft Orders for manual tax review.");
    if(lines.some(x=>!x.name.trim()||!Number.isInteger(Number(x.quantity))||Number(x.quantity)<=0||!Number.isFinite(Number(x.unitPrice))||Number(x.unitPrice)<0))return setError("Each item needs a description, a positive whole-number quantity, and a valid nonnegative price.");
    if(!Number.isFinite(Number(discount))||Number(discount)<0||effectiveDiscount>subtotal||!Number.isFinite(Number(shipping))||Number(shipping)<0)return setError("Discount must be within the subtotal, and shipping must be nonnegative.");
    if(dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))return setError("Choose a valid due date.");
    savingRef.current=true;
    setBusy(true);
    try {
      await adminDraftOrdersApi.saveDraft(draft?.id || null,{
        customerName,customerEmail:customerEmail.trim(),shippingAddress:{...shippingAddress,province, country:"Canada"},
        items:lines.map(x=>({...x, quantity:Number(x.quantity), unitPrice:Number(x.unitPrice)})),
        discount:effectiveDiscount, shipping:effectiveShipping,customerPhone, billingAddress:billing,
        gstHstTax:tax.gst_hst,pstTax:tax.pst,tax:round(tax.gst_hst+tax.pst),
        notes:[notes.trim(),"INVOICE PREPARATION — NOT ISSUED"].filter(Boolean).join("\n"),
        invoiceDueDate:dueDate || null, invoicePaymentTerms:null,
        documentMeta:{...documentMeta,tax_flags:taxEnabled,tax_adjustment_reason:""}
      });
      onCreated();
    }catch(e){setError(e?.message||"Could not save invoice preparation.");}finally{savingRef.current=false;setBusy(false);}
  }
  const field="w-full rounded border border-transparent bg-transparent p-1 outline-none hover:border-slate-300 focus:border-blue-500 focus:bg-blue-50";
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label={draft?"Edit invoice draft":"Create invoice"}>
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center justify-between gap-4 rounded-lg bg-white p-3">
        <div><h2 className="text-lg font-semibold">{draft?"Edit invoice draft":"Create invoice"}</h2><p className="text-xs text-slate-500">Edit directly in the invoice. Saving preserves the draft; issuance and payment are separate.</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={()=>setPreviewOpen(true)} className="rounded border px-3 py-2">Preview</button><button type="button" onClick={onClose} className="rounded border px-3 py-2">Cancel</button><button type="button" disabled={busy||!supported} onClick={save} className="rounded bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?"Saving…":"Save and Continue"}</button><button onClick={onClose} aria-label="Close"><X/></button></div>
      </div>
      <div className="rounded-lg bg-white p-5 text-slate-900 shadow-xl sm:p-10">
        <div className="flex flex-wrap justify-between gap-5 border-b pb-5">
          <div className="shrink-0"><img src="/images/gdp-logo.webp" alt="GDP Clothing logo" className="h-24 w-32 object-contain object-left"/></div>
          <div className="ml-auto max-w-xs flex-1 space-y-2 text-right">
            <input aria-label="Invoice heading" className={field+" text-right text-2xl font-bold"} placeholder="INVOICE" value={documentMeta.header||""} onChange={e=>setMeta("header",e.target.value)}/>
            <input aria-label="Business name" className={field+" text-right text-base font-bold"} placeholder="GDP Clothing" value={documentMeta.business_name??"GDP Clothing"} onChange={e=>setMeta("business_name",e.target.value)}/>
            <textarea aria-label="Business address" rows={3} className={field+" resize-y text-right text-sm"} placeholder="601 Avenue S North, Saskatoon, Saskatchewan S7L 3A2, Canada" value={documentMeta.business_address??"601 Avenue S North\nSaskatoon, Saskatchewan S7L 3A2\nCanada"} onChange={e=>setMeta("business_address",e.target.value)}/>
            <label className="block text-xs font-semibold text-slate-700">P.O. / S.O.<input aria-label="P.O. / S.O. number" placeholder="Optional PO / SO number" className="mt-1 w-full rounded border border-slate-400 bg-white p-2 text-right text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" value={documentMeta.po_so_number||""} onChange={e=>setMeta("po_so_number",e.target.value)}/></label>
          </div>
        </div>
        <div className="grid gap-4 py-5 sm:grid-cols-2"><div><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Bill to</h3><button type="button" className="my-2 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800" onClick={()=>setCustomerPanel(true)}>Select existing / Add new customer</button><input aria-label="Customer name" placeholder="Customer name" className={field+" font-semibold"} value={customerName} onChange={e=>setCustomerName(e.target.value)}/><input aria-label="Customer email" type="email" placeholder="Email address" className={field} value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)}/><label className="mt-1 block text-xs text-slate-500">Province<select className={field} value={province} onChange={e=>setProvince(e.target.value)}>{Object.keys(provinceMap).map(p=><option key={p}>{p}</option>)}</select></label></div><div className="space-y-2 text-sm"><div className="flex items-center justify-between gap-3"><span className="whitespace-nowrap font-semibold">Invoice Number:</span><span className="text-right">{draft?.reserved_invoice_number||"Generated on save"}</span></div><div className="flex items-center justify-between gap-3"><label htmlFor="invoice-editor-date" className="whitespace-nowrap font-semibold">Invoice Date:</label><input id="invoice-editor-date" type="date" className="w-40 rounded border p-1 text-right" value={documentMeta.invoice_date||""} onChange={e=>setMeta("invoice_date",e.target.value)}/></div><div className="flex items-center justify-between gap-3"><label htmlFor="invoice-editor-due" className="whitespace-nowrap font-semibold">Payment Due:</label><input id="invoice-editor-due" type="date" className="w-40 rounded border p-1 text-right" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div><div className="flex items-center justify-between gap-3 bg-slate-100 px-2 py-2 font-semibold"><span className="whitespace-nowrap">Amount Due (CAD):</span><span>{money(total)}</span></div></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="bg-slate-800 text-white"><tr className="text-white"><th className="p-2 text-left font-bold text-white">Item / Description</th><th className="p-2 font-bold text-white">Qty</th><th className="p-2 font-bold text-white">Price</th><th className="p-2 text-right font-bold text-white">Amount</th><th aria-label="Remove" /></tr></thead><tbody>{lines.map((line,i)=><tr className="border-b" key={i}><td className="p-1"><input className={field} placeholder="Product / service description" value={line.name} onChange={e=>update(i,{name:e.target.value})}/></td><td className="w-20 p-1"><input type="number" min="1" step="1" aria-label="Quantity" className={field+" text-center"} value={line.quantity} onChange={e=>update(i,{quantity:e.target.value})}/></td><td className="w-28 p-1"><input type="number" min="0" step="0.01" aria-label="Unit price" className={field+" text-right"} value={line.unitPrice} onChange={e=>update(i,{unitPrice:e.target.value})}/></td><td className="p-2 text-right">{money(Number(line.quantity)*Number(line.unitPrice))}</td><td><button type="button" aria-label="Remove item" disabled={lines.length===1} onClick={()=>setLines(a=>a.filter((_,n)=>n!==i))}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
        <div className="mt-3"><button type="button" onClick={()=>setLines(a=>[...a,emptyLine()])} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"><Plus size={16}/> Add item</button><input className="mt-2 w-full rounded border p-2 text-sm" placeholder="Search GDP products or SKU" value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)}/>{catalogError&&<p className="text-xs text-amber-700">{catalogError}</p>}{catalogSearch&&<div className="max-h-36 overflow-y-auto rounded border">{matches.map(p=><div className="border-b p-2 text-sm" key={p.id}>{p.name} <div className="flex flex-wrap gap-2">{(p.product_variants||[]).filter(v=>v.active!==false).length?p.product_variants.filter(v=>v.active!==false).map(v=><button className="rounded border px-2" type="button" key={v.id} onClick={()=>addCatalog(p,v)}>{v.name||v.sku} · {money(v.price??p.price)}</button>):<button type="button" className="rounded border px-2" onClick={()=>addCatalog(p,null)}>Add · {money(p.price)}</button>}</div></div>)}</div>}</div>
        <div className="mt-4 ml-auto max-w-xs space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span>{money(subtotal)}</div><label className="flex items-center justify-between"><span><input type="checkbox" checked={discountEnabled} onChange={e=>setDiscountEnabled(e.target.checked)}/> Discount</span><input type="number" min="0" step=".01" disabled={!discountEnabled} className="w-24 rounded border p-1 text-right disabled:opacity-40" value={discount} onChange={e=>setDiscount(e.target.value)}/></label><label className="flex items-center justify-between"><span><input type="checkbox" checked={shippingEnabled} onChange={e=>setShippingEnabled(e.target.checked)}/> Shipping</span><input type="number" min="0" step=".01" disabled={!shippingEnabled} className="w-24 rounded border p-1 text-right disabled:opacity-40" value={shipping} onChange={e=>setShipping(e.target.value)}/></label><div className="flex items-center justify-between gap-2"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={taxEnabled.gst_hst} onChange={e=>setTaxEnabled(old=>({...old,gst_hst:e.target.checked}))}/>GST/HST</label><span>{money(tax.gst_hst)}</span></div><div className="flex items-center justify-between gap-2"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={taxEnabled.pst} onChange={e=>setTaxEnabled(old=>({...old,pst:e.target.checked}))}/>PST</label><span>{money(tax.pst)}</span></div><div className="flex justify-between border-t pt-2 text-lg font-bold"><label className="inline-flex items-center gap-2">Total <select aria-label="Invoice currency" defaultValue="CAD" className="rounded border bg-white p-1 text-sm"><option value="CAD">CAD ($)</option></select></label>{money(total)}</div></div>
        <div className="mt-6"><label className="text-sm font-semibold">Footer / customer notes<textarea rows={3} className="mt-1 w-full rounded border p-2 text-sm" value={documentMeta.footer||""} onChange={e=>setMeta("footer",e.target.value)} placeholder="Thank you for your business!"/></label><label className="mt-2 block text-xs text-slate-500">Internal order notes<textarea rows={2} className="mt-1 w-full rounded border p-2" value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>
        {customerPanel&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4"><div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-bold">{customerMode==="new"?"New customer":"Select existing customer"}</h3><button type="button" onClick={()=>setCustomerPanel(false)} aria-label="Close customer dialog"><X size={20}/></button></div><div className="my-3 flex gap-2"><button className="rounded border px-3 py-2" onClick={()=>setCustomerMode("existing")}>Existing customer</button><button className="rounded border px-3 py-2" onClick={()=>setCustomerMode("new")}>New customer</button></div>{customerMode==="existing"?<><input className="mb-3 w-full rounded border p-2" placeholder="Search by name or email" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)}/>{customerLoading&&<p>Loading customers…</p>}<div className="max-h-64 overflow-auto">{customerOptions.filter(c=>(c.name+" "+c.email).toLowerCase().includes(customerSearch.toLowerCase())).map(c=><button type="button" key={c.id} className="block w-full border-b p-3 text-left hover:bg-slate-50" onClick={()=>selectCustomer(c)}><strong>{c.name}</strong><span className="ml-2 text-slate-600">{c.email}</span></button>)}</div></>:<><div className="my-3 flex flex-wrap gap-2">{["Contact","Billing","Shipping","More"].map(tab=><button type="button" key={tab} onClick={()=>setCustomerTab(tab)} className={`rounded px-3 py-2 text-sm ${customerTab===tab?"bg-slate-900 text-white":"bg-slate-100"}`}>{tab}</button>)}</div>{customerTab==="Contact"?<div className="space-y-2">{[["Customer name",customerName,setCustomerName],["Email",customerEmail,setCustomerEmail],["Phone",customerPhone,setCustomerPhone]].map(([label,value,setter])=><label key={label} className="block text-xs">{label}<input className="mt-1 w-full rounded border p-2 text-sm" value={value} onChange={e=>setter(e.target.value)}/></label>)}</div>:customerTab==="Billing"||customerTab==="Shipping"?<div className="space-y-2">{["line1","line2","city","province","postal_code","country"].map(key=><label key={key} className="block text-xs">{key.replaceAll("_"," ")}<input className="mt-1 w-full rounded border p-2 text-sm" value={(customerTab==="Billing"?billing:shippingAddress)[key]||""} onChange={e=>updateAddress(customerTab.toLowerCase(),key,e.target.value)}/></label>)}</div>:<label className="block text-xs">Internal customer notes<textarea className="mt-1 w-full rounded border p-2" value={notes} onChange={e=>setNotes(e.target.value)}/></label>}<p className="my-3 text-xs text-slate-500">Customer information is saved with this invoice draft, not as a separate customer account.</p><button type="button" className="rounded bg-slate-900 px-4 py-2 text-white" onClick={()=>setCustomerPanel(false)}>Use customer details</button></>}</div></div>}
        {previewOpen&&<div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/75 p-5"><div className="mx-auto max-w-3xl rounded-xl bg-white p-8 text-slate-900"><div className="mb-5 flex justify-between"><h3 className="text-2xl font-bold">INVOICE — Preview</h3><button type="button" onClick={()=>setPreviewOpen(false)} aria-label="Close preview"><X/></button></div><p className="mb-4 text-xs text-amber-800">Unsaved preview — not issued, not a payment receipt.</p><div className="mb-6 flex items-start justify-between gap-6 border-b border-slate-200 pb-5"><img src="/images/gdp-logo.webp" alt="GDP Clothing logo" className="h-20 w-28 object-contain object-left"/><div className="text-right"><h3 className="text-2xl font-bold">{documentMeta.header||"INVOICE"}</h3><p className="mt-2 font-bold">{documentMeta.business_name??"GDP Clothing"}</p><p className="whitespace-pre-line text-sm">{documentMeta.business_address??"601 Avenue S North\nSaskatoon, Saskatchewan S7L 3A2\nCanada"}</p>{documentMeta.po_so_number&&<p className="mt-2 text-sm">P.O. / S.O.: {documentMeta.po_so_number}</p>}</div></div><div className="mb-6 grid gap-6 sm:grid-cols-2"><div><b className="text-xs uppercase text-slate-500">Bill to</b><p className="font-semibold">{customerName}</p><p>{customerEmail}</p>{customerPhone&&<p>{customerPhone}</p>}<p>{province}</p></div><div className="space-y-2 text-sm sm:text-right"><div><strong>Invoice Number:</strong> {draft?.reserved_invoice_number||"Generated on save"}</div><div><strong>Invoice Date:</strong> {documentMeta.invoice_date||"Not set"}</div><div><strong>Payment Due:</strong> {dueDate||"Not set"}</div><div className="rounded bg-slate-100 p-2 font-bold">Amount Due (CAD): {money(total)}</div></div></div><table className="w-full text-sm"><thead className="bg-slate-800 text-white"><tr>{["Item","Qty","Price","Amount"].map(x=><th key={x} className="p-3 text-left font-bold text-white">{x}</th>)}</tr></thead><tbody>{lines.map((line,i)=><tr key={i} className="border-b"><td className="p-2">{line.name}</td><td>{line.quantity}</td><td>{money(line.unitPrice)}</td><td>{money(Number(line.quantity)*Number(line.unitPrice))}</td></tr>)}</tbody></table><div className="mt-5 text-right"><p>Subtotal: {money(subtotal)}</p>{discountEnabled&&<p>Discount: {money(effectiveDiscount)}</p>}{shippingEnabled&&<p>Shipping: {money(effectiveShipping)}</p>}{tax.gst_hst>0&&<p>GST/HST: {money(tax.gst_hst)}</p>}{tax.pst>0&&<p>PST: {money(tax.pst)}</p>}<p className="mt-2 text-xl font-bold">Total CAD: {money(total)}</p></div><p className="mt-8 whitespace-pre-line">{documentMeta.footer||""}</p><button className="mt-6 rounded border px-4 py-2" onClick={()=>setPreviewOpen(false)}>Back to editing</button></div></div>}
        {!supported&&<p className="mt-3 text-sm text-amber-700">{taxError||"Tax rules unavailable. Save disabled to avoid incorrect tax."}</p>}{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  </div>;
}
