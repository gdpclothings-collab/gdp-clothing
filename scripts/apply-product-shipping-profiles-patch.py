from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


Path("src/lib/shippingAdminApi.js").write_text(r'''import { supabase } from "@/lib/supabaseClient";
const unwrap=({data,error})=>{if(error)throw error;return data;};
const uiRate=(r)=>({...r,label:r.name||"Standard Shipping",description:r.min_delivery_days!=null&&r.max_delivery_days!=null?`${r.min_delivery_days}–${r.max_delivery_days} business days`:""});
const profilePayload=(p)=>({name:p.name||"Shipping profile",description:p.description||null,active:p.active!==false,product_scope:p.product_scope||"selected",origin_location:p.origin_location||{},product_ids:Array.isArray(p.product_ids)?p.product_ids:[],priority:Number(p.priority||100),updated_at:new Date().toISOString()});
export const shippingAdminApi={
 async load(){const [profiles,rates,packages,settings,products]=await Promise.all([supabase.from("shipping_profiles").select("*").order("priority",{ascending:true}),supabase.from("shipping_rates").select("*").order("priority",{ascending:true}),supabase.from("shipping_packages").select("*").order("is_default",{ascending:false}).order("name"),supabase.from("delivery_settings").select("*").eq("id",1).maybeSingle(),supabase.from("products").select("id,name,slug,category,status,requires_shipping,selling_mode").eq("requires_shipping",true).order("name")]);return{profiles:unwrap(profiles)||[],rates:(unwrap(rates)||[]).map(uiRate),packages:unwrap(packages)||[],settings:unwrap(settings)||null,products:unwrap(products)||[]};},
 async saveSettings(d){return unwrap(await supabase.from("delivery_settings").upsert({id:1,local_pickup_enabled:Boolean(d.local_pickup_enabled),pickup_name:d.pickup_name||"Local Pickup",pickup_location:d.pickup_location||"GDP Clothing — Saskatoon",pickup_instructions:d.pickup_instructions||null,processing_min_days:Math.max(0,Number(d.processing_min_days||0)),processing_max_days:Math.max(0,Number(d.processing_max_days||0)),carrier_rates_enabled:Boolean(d.carrier_rates_enabled),carrier_name:d.carrier_name||"Canada Post",fallback_rate_enabled:Boolean(d.fallback_rate_enabled),fallback_rate:Math.max(0,Number(d.fallback_rate||0)),updated_at:new Date().toISOString()}).select().single());},
 async saveProfile(p){const x=profilePayload(p);if(p.id)return unwrap(await supabase.from("shipping_profiles").update(x).eq("id",p.id).select().single());return unwrap(await supabase.from("shipping_profiles").insert(x).select().single());},
 async saveProfiles(profiles){const saved=[];for(const profile of profiles||[]){saved.push(await this.saveProfile(profile));}return saved;},
 async saveRate(r){let minDays=r.min_delivery_days,maxDays=r.max_delivery_days;const m=String(r.description||"").match(/(\d+)\D+(\d+)/);if(m){minDays=Number(m[1]);maxDays=Number(m[2]);}const x={profile_id:r.profile_id,method_code:r.method_code||"standard",name:r.label||r.name||"Standard Shipping",price:Math.max(0,Number(r.price||0)),min_order:r.min_order===""||r.min_order==null?null:Number(r.min_order),max_order:r.max_order===""||r.max_order==null?null:Number(r.max_order),min_delivery_days:Math.max(0,Number(minDays??3)),max_delivery_days:Math.max(0,Number(maxDays??7)),conditions:r.conditions||{},zone_name:r.zone_name||"Canada",country_codes:r.country_codes?.length?r.country_codes:["CA"],province_codes:r.province_codes||[],postal_patterns:r.postal_patterns||[],min_weight_grams:r.min_weight_grams===""||r.min_weight_grams==null?null:Number(r.min_weight_grams),max_weight_grams:r.max_weight_grams===""||r.max_weight_grams==null?null:Number(r.max_weight_grams),rate_source:r.rate_source||"manual",fallback_price:r.fallback_price===""||r.fallback_price==null?null:Number(r.fallback_price),priority:Number(r.priority||100),active:r.active!==false,updated_at:new Date().toISOString()};if(r.id)return unwrap(await supabase.from("shipping_rates").update(x).eq("id",r.id).select().single());return unwrap(await supabase.from("shipping_rates").insert(x).select().single());},
 async deleteRate(id){return unwrap(await supabase.from("shipping_rates").delete().eq("id",id));},
 async savePackage(p){const x={name:p.name||"Package",package_type:p.package_type||"mailer",length_cm:Math.max(0,Number(p.length_cm||0)),width_cm:Math.max(0,Number(p.width_cm||0)),height_cm:Math.max(0,Number(p.height_cm||0)),empty_weight_grams:Math.max(0,Number(p.empty_weight_grams||0)),is_default:Boolean(p.is_default),active:p.active!==false,updated_at:new Date().toISOString()};if(p.is_default)await supabase.from("shipping_packages").update({is_default:false}).neq("id",p.id||"00000000-0000-0000-0000-000000000000");if(p.id)return unwrap(await supabase.from("shipping_packages").update(x).eq("id",p.id).select().single());return unwrap(await supabase.from("shipping_packages").insert(x).select().single());}
};
''')

Path("src/components/admin/ShippingDeliveryManager.jsx").write_text(r'''import React, { useEffect, useMemo, useState } from "react";
import { Package, Plus, Save, Truck, MapPin, Trash2 } from "lucide-react";
import { shippingAdminApi } from "@/lib/shippingAdminApi";

const box = "bg-white border border-[#e1e3e5] rounded-xl";
const input = "w-full border border-[#c9cccf] rounded-lg px-3 py-2 text-sm bg-white";
const provinces = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];
const csv = value => String(value || "").split(",").map(x => x.trim().toUpperCase()).filter(Boolean);

function RateEditor({ rate, patchRate, saveRate, removeRate }) {
  return <div className="border rounded-xl p-4 grid lg:grid-cols-12 gap-3 items-end">
    <label className="lg:col-span-2 text-xs">Rate name<input className={input} value={rate.label || ""} onChange={e=>patchRate(rate.id,{label:e.target.value})}/></label>
    <label className="lg:col-span-2 text-xs">Zone<input className={input} value={rate.zone_name || "Canada"} onChange={e=>patchRate(rate.id,{zone_name:e.target.value})}/></label>
    <label className="lg:col-span-2 text-xs">Provinces<input className={input} placeholder="SK, AB or blank=all" value={(rate.province_codes||[]).join(", ")} onChange={e=>patchRate(rate.id,{province_codes:csv(e.target.value).filter(x=>provinces.includes(x))})}/></label>
    <label className="lg:col-span-2 text-xs">Postal patterns<input className={input} placeholder="S7*, S0K*" value={(rate.postal_patterns||[]).join(", ")} onChange={e=>patchRate(rate.id,{postal_patterns:csv(e.target.value)})}/></label>
    <label className="lg:col-span-1 text-xs">Min $<input type="number" className={input} value={rate.min_order ?? ""} onChange={e=>patchRate(rate.id,{min_order:e.target.value})}/></label>
    <label className="lg:col-span-1 text-xs">Max $<input type="number" className={input} value={rate.max_order ?? ""} onChange={e=>patchRate(rate.id,{max_order:e.target.value})}/></label>
    <label className="lg:col-span-1 text-xs">Price<input type="number" step="0.01" className={input} value={rate.price ?? 0} onChange={e=>patchRate(rate.id,{price:e.target.value})}/></label>
    <div className="lg:col-span-1 flex gap-2"><button onClick={()=>saveRate(rate)} className="border rounded-lg p-2" aria-label={`Save ${rate.label || "shipping rate"}`}><Save size={16}/></button><button onClick={()=>removeRate(rate)} className="border rounded-lg p-2 text-red-600" aria-label={`Remove ${rate.label || "shipping rate"}`}><Trash2 size={16}/></button></div>
    <label className="lg:col-span-3 text-xs">Delivery description<input className={input} value={rate.description || ""} onChange={e=>patchRate(rate.id,{description:e.target.value})}/></label>
    <label className="lg:col-span-2 text-xs">Min weight (g)<input type="number" className={input} value={rate.min_weight_grams ?? ""} onChange={e=>patchRate(rate.id,{min_weight_grams:e.target.value})}/></label>
    <label className="lg:col-span-2 text-xs">Max weight (g)<input type="number" className={input} value={rate.max_weight_grams ?? ""} onChange={e=>patchRate(rate.id,{max_weight_grams:e.target.value})}/></label>
    <label className="lg:col-span-2 text-xs">Source<select className={input} value={rate.rate_source || "manual"} onChange={e=>patchRate(rate.id,{rate_source:e.target.value})}><option value="manual">Manual</option><option value="carrier">Carrier calculated</option></select></label>
    <label className="lg:col-span-2 text-xs flex items-center gap-2 pb-2"><input type="checkbox" checked={rate.active!==false} onChange={e=>patchRate(rate.id,{active:e.target.checked})}/> Active</label>
  </div>;
}

export default function ShippingDeliveryManager({ notify = (message) => void message }) {
  const [data, setData] = useState({ profiles: [], rates: [], packages: [], settings: null, products: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const load = async () => { setLoading(true); try { setData(await shippingAdminApi.load()); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const settings = data.settings || { local_pickup_enabled:true, pickup_name:"Local Pickup", pickup_location:"GDP Clothing — Saskatoon", processing_min_days:1, processing_max_days:2, carrier_rates_enabled:false, carrier_name:"Canada Post", fallback_rate_enabled:true, fallback_rate:12.99 };
  const general = useMemo(() => data.profiles.find(p => p.product_scope === "all" && p.active !== false) || data.profiles.find(p => p.product_scope === "all") || null, [data.profiles]);
  const customProfiles = useMemo(() => data.profiles.filter(p => p.product_scope !== "all"), [data.profiles]);
  const visibleProducts = useMemo(() => { const term=productSearch.trim().toLowerCase(); return data.products.filter(p=>p.status!=="archived"&&(!term||`${p.name} ${p.slug||""} ${p.category||""}`.toLowerCase().includes(term))); }, [data.products, productSearch]);
  const assignedByProduct = useMemo(() => { const map=new Map(); for(const profile of [...customProfiles].sort((a,b)=>Number(a.priority||100)-Number(b.priority||100))){for(const id of profile.product_ids||[]){if(!map.has(id))map.set(id,profile);}} return map; }, [customProfiles]);
  const ratesFor = profileId => data.rates.filter(r => r.profile_id === profileId);
  const patchSettings = patch => setData(d => ({ ...d, settings: { ...(d.settings || settings), ...patch } }));
  const patchRate = (id, patch) => setData(d => ({ ...d, rates: d.rates.map(r => r.id === id ? { ...r, ...patch } : r) }));
  const patchProfile = (id, patch) => setData(d => ({ ...d, profiles: d.profiles.map(p => p.id === id ? { ...p, ...patch } : p) }));
  const patchPackage = (id, patch) => setData(d => ({ ...d, packages:d.packages.map(p => p.id === id ? { ...p, ...patch } : p) }));
  const saveSettings = async () => { setSaving(true); try { await shippingAdminApi.saveSettings(settings); notify("Shipping settings saved."); await load(); } finally { setSaving(false); } };
  const saveProfile = async profile => { setSaving(true); try { if(profile.product_scope === "all") await shippingAdminApi.saveProfile(profile); else await shippingAdminApi.saveProfiles(data.profiles.filter(p=>p.product_scope!=="all")); notify("Shipping profile saved."); await load(); } finally { setSaving(false); } };
  const toggleProduct = (profileId, productId, checked) => setData(d => ({ ...d, profiles:d.profiles.map(profile => { if(profile.product_scope === "all") return profile; const current=new Set(profile.product_ids||[]); if(profile.id===profileId && checked) current.add(productId); else if(profile.id===profileId || checked) current.delete(productId); return { ...profile, product_ids:[...current] }; }) }));
  const addRate = async profileId => { setSaving(true); try { await shippingAdminApi.saveRate({ profile_id:profileId, method_code:"standard", label:"Standard Shipping", description:"3–7 business days", price:12.99, min_order:0, max_order:null, zone_name:"Canada", country_codes:["CA"], province_codes:[], postal_patterns:[], rate_source:"manual", priority:100, active:true }); notify("Shipping rate added."); await load(); } finally { setSaving(false); } };
  const addProfile = async () => { setSaving(true); try { const profile=await shippingAdminApi.saveProfile({ name:"New custom profile", description:"Assign products, adjust rates, then activate.", product_scope:"selected", product_ids:[], priority:100+customProfiles.length*10, active:false }); await shippingAdminApi.saveRate({profile_id:profile.id,method_code:"standard",label:"Standard Shipping",description:"3–7 business days",price:12.99,min_order:0,max_order:149.99,zone_name:"Canada",country_codes:["CA"],province_codes:[],postal_patterns:[],rate_source:"manual",priority:100,active:true}); await shippingAdminApi.saveRate({profile_id:profile.id,method_code:"standard",label:"Free Standard Shipping",description:"3–7 business days",price:0,min_order:150,max_order:null,zone_name:"Canada",country_codes:["CA"],province_codes:[],postal_patterns:[],rate_source:"manual",priority:100,active:true}); notify("Custom shipping profile created. It is inactive until you enable it."); await load(); } finally { setSaving(false); } };
  const saveRate = async rate => { setSaving(true); try { await shippingAdminApi.saveRate(rate); notify("Shipping rate saved."); await load(); } finally { setSaving(false); } };
  const removeRate = async rate => { setSaving(true); try { await shippingAdminApi.deleteRate(rate.id); notify("Shipping rate removed."); await load(); } finally { setSaving(false); } };
  const addPackage = async () => { setSaving(true); try { await shippingAdminApi.savePackage({ name:"New package", package_type:"mailer", active:true }); notify("Package added."); await load(); } finally { setSaving(false); } };
  const savePackage = async pkg => { setSaving(true); try { await shippingAdminApi.savePackage(pkg); notify("Package saved."); await load(); } finally { setSaving(false); } };

  if (loading) return <div className="py-10 text-sm text-[#6d7175]">Loading Shipping & Delivery…</div>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Shipping & Delivery</h2><p className="text-sm text-[#6d7175] mt-1">Shopify-style profiles, zones, rates, pickup, packages and carrier fallback controls.</p></div><button disabled={saving} onClick={saveSettings} className="bg-[#202223] text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"><Save size={15}/> Save settings</button></div>

    {general && <section className={`${box} p-5`}><div className="flex items-center gap-2 font-semibold"><Truck size={18}/> General shipping profile</div><p className="text-xs text-[#6d7175] mt-1">Unassigned shippable products use <strong>{general.name}</strong>. Custom profiles below override it only for their assigned products.</p><div className="mt-4 space-y-3">{ratesFor(general.id).map(rate=><RateEditor key={rate.id} rate={rate} patchRate={patchRate} saveRate={saveRate} removeRate={removeRate}/>)}<button onClick={()=>addRate(general.id)} className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Plus size={15}/> Add general rate</button></div></section>}

    <section className={`${box} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">Custom product shipping profiles</div><p className="text-xs text-[#6d7175] mt-1">Assign products to a custom profile. Mixed carts combine the applicable profile shipping charges.</p></div><button disabled={saving} onClick={addProfile} className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Plus size={15}/> Add custom profile</button></div>
      {!customProfiles.length && <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-[#6d7175]">No custom product profiles yet. All shippable products use the general profile.</div>}
      <div className="mt-4 space-y-5">{customProfiles.map(profile => <div key={profile.id} className="rounded-xl border p-4 space-y-4">
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-3 items-end"><label className="text-xs">Profile name<input className={input} value={profile.name||""} onChange={e=>patchProfile(profile.id,{name:e.target.value})}/></label><label className="text-xs">Description<input className={input} value={profile.description||""} onChange={e=>patchProfile(profile.id,{description:e.target.value})}/></label><button disabled={saving} onClick={()=>saveProfile(profile)} className="bg-[#202223] text-white rounded-lg px-3 py-2 text-sm flex items-center justify-center gap-2"><Save size={14}/> Save profile</button></div>
        <div className="flex flex-wrap items-center gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={profile.active!==false} onChange={e=>patchProfile(profile.id,{active:e.target.checked})}/> Active</label><span className="text-xs text-[#6d7175]">{(profile.product_ids||[]).length} product(s) assigned</span><span className="text-xs text-[#6d7175]">Deactivate to return assigned products to General shipping without deleting this setup.</span></div>
        <div className="rounded-lg bg-[#f6f6f7] p-4"><div className="font-medium text-sm">Product assignments</div><input className={`${input} mt-2`} placeholder="Search products" value={productSearch} onChange={e=>setProductSearch(e.target.value)}/><div className="mt-3 grid md:grid-cols-2 gap-2 max-h-56 overflow-y-auto">{visibleProducts.map(product=>{const checked=(profile.product_ids||[]).includes(product.id);const owner=assignedByProduct.get(product.id);return <label key={product.id} className={`flex gap-3 rounded-lg border bg-white p-3 text-sm ${checked?"border-[#202223]":"border-[#e1e3e5]"}`}><input type="checkbox" checked={checked} onChange={e=>toggleProduct(profile.id,product.id,e.target.checked)}/><span className="min-w-0"><span className="font-medium block truncate">{product.name}</span><span className="text-[11px] text-[#6d7175]">{product.category||product.selling_mode||"Product"}{owner&&!checked?` · Currently ${owner.name}`:""}</span></span></label>;})}</div></div>
        <div><div className="font-medium text-sm mb-2">Profile rates</div><div className="space-y-3">{ratesFor(profile.id).map(rate=><RateEditor key={rate.id} rate={rate} patchRate={patchRate} saveRate={saveRate} removeRate={removeRate}/>)}<button onClick={()=>addRate(profile.id)} className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Plus size={15}/> Add profile rate</button></div></div>
      </div>)}</div>
    </section>

    <div className="grid lg:grid-cols-2 gap-5"><section className={`${box} p-5`}><div className="flex items-center gap-2 font-semibold"><MapPin size={18}/> Local pickup</div><div className="space-y-3 mt-4"><label className="flex gap-2 text-sm"><input type="checkbox" checked={settings.local_pickup_enabled} onChange={e=>patchSettings({local_pickup_enabled:e.target.checked})}/> Enable local pickup</label><input className={input} value={settings.pickup_name||""} onChange={e=>patchSettings({pickup_name:e.target.value})}/><input className={input} value={settings.pickup_location||""} onChange={e=>patchSettings({pickup_location:e.target.value})}/><textarea className={input} placeholder="Pickup instructions" value={settings.pickup_instructions||""} onChange={e=>patchSettings({pickup_instructions:e.target.value})}/></div></section><section className={`${box} p-5`}><div className="font-semibold">Delivery estimates & carrier fallback</div><div className="grid grid-cols-2 gap-3 mt-4"><label className="text-xs">Processing min days<input type="number" className={input} value={settings.processing_min_days} onChange={e=>patchSettings({processing_min_days:e.target.value})}/></label><label className="text-xs">Processing max days<input type="number" className={input} value={settings.processing_max_days} onChange={e=>patchSettings({processing_max_days:e.target.value})}/></label></div><label className="flex gap-2 text-sm mt-4"><input type="checkbox" checked={settings.carrier_rates_enabled} onChange={e=>patchSettings({carrier_rates_enabled:e.target.checked})}/> Enable carrier-calculated rates when integration is configured</label><input className={`${input} mt-3`} value={settings.carrier_name||"Canada Post"} onChange={e=>patchSettings({carrier_name:e.target.value})}/><label className="flex gap-2 text-sm mt-3"><input type="checkbox" checked={settings.fallback_rate_enabled} onChange={e=>patchSettings({fallback_rate_enabled:e.target.checked})}/> Use fallback rate if carrier is unavailable</label><label className="block text-xs mt-3">Fallback CAD<input type="number" step="0.01" className={input} value={settings.fallback_rate} onChange={e=>patchSettings({fallback_rate:e.target.value})}/></label></section></div>
    <section className={`${box} p-5`}><div className="flex items-center justify-between"><div className="flex items-center gap-2 font-semibold"><Package size={18}/> Packages</div><button onClick={addPackage} className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Plus size={15}/> Add package</button></div><div className="grid lg:grid-cols-2 gap-3 mt-4">{data.packages.map(pkg=><div key={pkg.id} className="border rounded-xl p-4 space-y-3"><input className={input} value={pkg.name} onChange={e=>patchPackage(pkg.id,{name:e.target.value})}/><div className="grid grid-cols-4 gap-2">{[["length_cm","L cm"],["width_cm","W cm"],["height_cm","H cm"],["empty_weight_grams","Weight g"]].map(([k,l])=><label key={k} className="text-[10px]">{l}<input type="number" className={input} value={pkg[k]} onChange={e=>patchPackage(pkg.id,{[k]:e.target.value})}/></label>)}</div><label className="flex gap-2 text-sm"><input type="checkbox" checked={pkg.is_default} onChange={e=>patchPackage(pkg.id,{is_default:e.target.checked})}/> Default package</label><button onClick={()=>savePackage(pkg)} className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Save size={14}/> Save package</button></div>)}</div></section>
  </div>;
}
''')

Path("supabase/functions/checkout/shipping-profile-rules.mjs").write_text(r'''import { selectShippingRate } from "./shipping-zone-rules.mjs";

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const asList = (value) => Array.isArray(value) ? value : [];
const priority = (profile) => Number.isFinite(Number(profile?.priority)) ? Number(profile.priority) : 100;
const activeProfiles = (profiles) => asList(profiles).filter((profile) => profile?.active !== false);
const sortProfiles = (profiles) => [...profiles].sort((a, b) => priority(a) - priority(b) || String(a?.name || "").localeCompare(String(b?.name || "")));

export function resolveProfileForProduct(profiles, productId) {
  const active = sortProfiles(activeProfiles(profiles));
  const custom = active.find((profile) => profile?.product_scope !== "all" && asList(profile?.product_ids).map(String).includes(String(productId)));
  if (custom) return custom;
  return active.find((profile) => profile?.product_scope === "all") || null;
}

function fallbackRule(amount) {
  return Number(amount || 0) >= 150
    ? { name:"Free Standard Shipping", price:0, min_order:150, max_order:null, min_delivery_days:3, max_delivery_days:7 }
    : { name:"Standard Shipping", price:12.99, min_order:0, max_order:149.99, min_delivery_days:3, max_delivery_days:7 };
}

export function calculateProfileShipping({ profiles = [], rates = [], items = [], amount = 0, destination = {} } = {}) {
  const safeAmount = Math.max(0, roundMoney(amount));
  const active = sortProfiles(activeProfiles(profiles));
  const general = active.find((profile) => profile?.product_scope === "all") || null;
  const cleanItems = asList(items).filter((item) => String(item?.productId || "").trim());
  const groups = new Map();

  const addToGroup = (profile, itemAmount) => {
    const key = String(profile?.id || "__general_fallback__");
    const existing = groups.get(key) || { profile, rawAmount:0 };
    existing.rawAmount += Math.max(0, Number(itemAmount || 0));
    groups.set(key, existing);
  };

  for (const item of cleanItems) addToGroup(resolveProfileForProduct(active, item.productId), item.amount);
  if (!groups.size) addToGroup(general, safeAmount);

  const groupList = [...groups.values()].sort((a, b) => priority(a.profile) - priority(b.profile) || String(a.profile?.name || "").localeCompare(String(b.profile?.name || "")));
  const rawTotal = groupList.reduce((sum, group) => sum + Math.max(0, Number(group.rawAmount || 0)), 0);
  let allocated = 0;
  const quoted = groupList.map((group, index) => {
    const groupAmount = index === groupList.length - 1
      ? roundMoney(Math.max(0, safeAmount - allocated))
      : roundMoney(rawTotal > 0 ? safeAmount * (Math.max(0, Number(group.rawAmount || 0)) / rawTotal) : safeAmount / groupList.length);
    allocated = roundMoney(allocated + groupAmount);
    const profileId = group.profile?.id || null;
    const profileRates = asList(rates).filter((rate) => rate?.active !== false && String(rate?.method_code || "standard") === "standard" && profileId && String(rate?.profile_id || "") === String(profileId));
    let rule = selectShippingRate(profileRates, { ...destination, amount:groupAmount });
    let rateProfile = group.profile;
    if (!rule && general && String(general.id) !== String(profileId)) {
      const generalRates = asList(rates).filter((rate) => rate?.active !== false && String(rate?.method_code || "standard") === "standard" && String(rate?.profile_id || "") === String(general.id));
      rule = selectShippingRate(generalRates, { ...destination, amount:groupAmount });
      rateProfile = general;
    }
    if (!rule) rule = fallbackRule(groupAmount);
    return {
      profileId,
      profileName: group.profile?.name || general?.name || "General shipping",
      rateProfileId: rateProfile?.id || null,
      amount: groupAmount,
      name: rule.name || "Standard Shipping",
      price: roundMoney(Number(rule.price || 0)),
      minOrder: rule.min_order == null ? null : Number(rule.min_order),
      minDeliveryDays: Number(rule.min_delivery_days ?? 3),
      maxDeliveryDays: Number(rule.max_delivery_days ?? 7),
    };
  });

  const shipping = roundMoney(quoted.reduce((sum, group) => sum + group.price, 0));
  const single = quoted.length === 1 ? quoted[0] : null;
  return {
    shipping,
    shippingName: single ? single.name : `Combined shipping (${quoted.length} profiles)`,
    minDeliveryDays: quoted.length ? Math.max(...quoted.map((group) => group.minDeliveryDays)) : 3,
    maxDeliveryDays: quoted.length ? Math.max(...quoted.map((group) => group.maxDeliveryDays)) : 7,
    freeShippingThreshold: single && single.price === 0 && single.minOrder != null ? single.minOrder : 150,
    groups: quoted,
  };
}
''')

customer_api = "src/lib/customerApi.js"
replace_once(
    customer_api,
    '  async getCheckoutConfig({ amount, province, postalCode = "", shippingMethod, freeShipping = false }) {',
    '  async getCheckoutConfig({ amount, province, postalCode = "", shippingMethod, freeShipping = false, shippingItems = [] }) {',
)
replace_once(
    customer_api,
    '        freeShipping,\n      },',
    '        freeShipping,\n        shippingItems,\n      },',
)

checkout_page = "src/pages/CheckoutTwoStep.jsx"
old_pricing = '  const pricing = calculateCartQuantityDiscount(items); const subtotal = pricing.subtotal; const quantityDiscount = pricing.discount; const discounted = pricing.afterDiscount; const coupon = appliedDiscount ? (appliedDiscount.type === "fixed" ? appliedDiscount.value : discounted * appliedDiscount.value / 100) : 0; const afterCoupon = Math.max(0, discounted - coupon); const checkoutPostalCode = normalizePostal(form.postalCode); const checkoutConfigKey = `${afterCoupon.toFixed(2)}|${form.province}|${checkoutPostalCode}|${form.shippingMethod}|${appliedDiscount?.type === "free_shipping" ? 1 : 0}`; const activeConfig = config?.requestKey === checkoutConfigKey ? config : null; const fallbackShipping = form.shippingMethod === "pickup" || appliedDiscount?.type === "free_shipping" ? 0 : (afterCoupon >= 150 ? 0 : 12.99); const shipping = activeConfig?.shipping ?? fallbackShipping; const taxRate = activeConfig?.taxRate ?? (FALLBACK_TAX_RATES[form.province] ?? .05); const tax = (afterCoupon + ((activeConfig?.taxShipping ?? true) ? shipping : 0)) * taxRate; const total = afterCoupon + shipping + tax;'
new_pricing = '  const pricing = calculateCartQuantityDiscount(items); const subtotal = pricing.subtotal; const quantityDiscount = pricing.discount; const discounted = pricing.afterDiscount; const coupon = appliedDiscount ? (appliedDiscount.type === "fixed" ? appliedDiscount.value : discounted * appliedDiscount.value / 100) : 0; const afterCoupon = Math.max(0, discounted - coupon); const checkoutPostalCode = normalizePostal(form.postalCode); const checkoutShippingItems = items.map(item => ({ productId:item.productId, amount:Math.max(0, Number(item.price || 0)) * Math.max(1, Number(item.quantity || 1)) })); const checkoutShippingKey = checkoutShippingItems.map(item => `${item.productId}:${Number(item.amount || 0).toFixed(2)}`).sort().join(","); const checkoutConfigKey = `${afterCoupon.toFixed(2)}|${form.province}|${checkoutPostalCode}|${form.shippingMethod}|${appliedDiscount?.type === "free_shipping" ? 1 : 0}|${checkoutShippingKey}`; const activeConfig = config?.requestKey === checkoutConfigKey ? config : null; const fallbackShipping = form.shippingMethod === "pickup" || appliedDiscount?.type === "free_shipping" ? 0 : (afterCoupon >= 150 ? 0 : 12.99); const shipping = activeConfig?.shipping ?? fallbackShipping; const taxRate = activeConfig?.taxRate ?? (FALLBACK_TAX_RATES[form.province] ?? .05); const tax = (afterCoupon + ((activeConfig?.taxShipping ?? true) ? shipping : 0)) * taxRate; const total = afterCoupon + shipping + tax;'
replace_once(checkout_page, old_pricing, new_pricing)
replace_once(
    checkout_page,
    'customerApi.getCheckoutConfig({ amount:afterCoupon, province:form.province, postalCode:checkoutPostalCode, shippingMethod:form.shippingMethod, freeShipping:appliedDiscount?.type === "free_shipping" })',
    'customerApi.getCheckoutConfig({ amount:afterCoupon, province:form.province, postalCode:checkoutPostalCode, shippingMethod:form.shippingMethod, freeShipping:appliedDiscount?.type === "free_shipping", shippingItems:checkoutShippingItems })',
)
replace_once(
    checkout_page,
    '{form.shippingMethod === "pickup" ? "Local Pickup" : "Standard Shipping"}',
    '{form.shippingMethod === "pickup" ? "Local Pickup" : (activeConfig?.shippingName || "Standard Shipping")}',
)

checkout = "supabase/functions/checkout/index.ts"
replace_once(
    checkout,
    'import { selectShippingRate } from "./shipping-zone-rules.mjs";\n',
    'import { calculateProfileShipping } from "./shipping-profile-rules.mjs";\n',
)
old_shipping = '''async function getShippingRule(service: any, amount: number, province: unknown, postalCode: unknown) {
  const safeAmount = Math.max(0, roundMoney(amount));
  const { data, error } = await service
    .from("shipping_rates")
    .select("id,name,method_code,price,min_order,max_order,min_delivery_days,max_delivery_days,zone_name,country_codes,province_codes,postal_patterns,priority")
    .eq("active", true)
    .eq("method_code", "standard");

  if (error) throw error;
  const matched = selectShippingRate(data || [], {
    amount: safeAmount,
    countryCode: "CA",
    provinceCode: normalizeProvinceCode(province),
    postalCode: normalizeCanadianPostalCode(postalCode),
  });
  if (matched) return matched;

  return safeAmount >= 150
    ? {
        name: "Free Standard Shipping",
        method_code: "standard",
        price: 0,
        min_order: 150,
        max_order: null,
        min_delivery_days: 3,
        max_delivery_days: 7,
      }
    : {
        name: "Standard Shipping",
        method_code: "standard",
        price: 12.99,
        min_order: 0,
        max_order: 149.99,
        min_delivery_days: 3,
        max_delivery_days: 7,
      };
}'''
new_shipping = '''async function getShippingQuote(service: any, amount: number, province: unknown, postalCode: unknown, shippingItems: any[] = []) {
  const safeAmount = Math.max(0, roundMoney(amount));
  const [profilesResult, ratesResult] = await Promise.all([
    service.from("shipping_profiles").select("id,name,active,product_scope,product_ids,priority").eq("active", true),
    service.from("shipping_rates").select("id,profile_id,name,method_code,price,min_order,max_order,min_delivery_days,max_delivery_days,zone_name,country_codes,province_codes,postal_patterns,priority,active").eq("active", true).eq("method_code", "standard"),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (ratesResult.error) throw ratesResult.error;
  return calculateProfileShipping({
    profiles: profilesResult.data || [],
    rates: ratesResult.data || [],
    items: shippingItems,
    amount: safeAmount,
    destination: {
      countryCode: "CA",
      provinceCode: normalizeProvinceCode(province),
      postalCode: normalizeCanadianPostalCode(postalCode),
    },
  });
}'''
replace_once(checkout, old_shipping, new_shipping)
replace_once(
    checkout,
    '''  amountAfterDiscounts: number,
  freeShipping = false,
) {''',
    '''  amountAfterDiscounts: number,
  freeShipping = false,
  shippingItems: any[] = [],
) {''',
)
replace_once(
    checkout,
    '''  const shippingMethod = customer?.shippingMethod === "pickup" ? "pickup" : "standard";
  const shippingRule = await getShippingRule(service, amount, customer?.province, customer?.postalCode);
  const shipping =
    shippingMethod === "pickup" || freeShipping
      ? 0
      : roundMoney(Number(shippingRule?.price || 0));''',
    '''  const shippingMethod = customer?.shippingMethod === "pickup" ? "pickup" : "standard";
  const shippingQuote = await getShippingQuote(service, amount, customer?.province, customer?.postalCode, shippingItems);
  const shipping =
    shippingMethod === "pickup" || freeShipping
      ? 0
      : roundMoney(Number(shippingQuote?.shipping || 0));''',
)
replace_once(
    checkout,
    '''    shippingName: shippingMethod === "pickup" ? "Local Pickup" : shippingRule?.name || "Standard Shipping",
    minDeliveryDays: shippingMethod === "pickup" ? 0 : shippingRule?.min_delivery_days ?? 3,
    maxDeliveryDays: shippingMethod === "pickup" ? 0 : shippingRule?.max_delivery_days ?? 7,
    freeShippingThreshold:
      shippingRule?.price === 0 && shippingRule?.min_order != null
        ? Number(shippingRule.min_order)
        : 150,''',
    '''    shippingName: shippingMethod === "pickup" ? "Local Pickup" : shippingQuote?.shippingName || "Standard Shipping",
    minDeliveryDays: shippingMethod === "pickup" ? 0 : shippingQuote?.minDeliveryDays ?? 3,
    maxDeliveryDays: shippingMethod === "pickup" ? 0 : shippingQuote?.maxDeliveryDays ?? 7,
    freeShippingThreshold: shippingQuote?.freeShippingThreshold ?? 150,
    shippingProfileCount: shippingQuote?.groups?.length || 1,''',
)
replace_once(
    checkout,
    '''      const rules = await getCheckoutRules(
        service,
        customer,
        amount,
        Boolean(body?.freeShipping),
      );''',
    '''      const shippingItems = Array.isArray(body?.shippingItems)
        ? body.shippingItems.slice(0, 100).map((item: any) => ({
            productId: String(item?.productId || ""),
            amount: Math.max(0, Math.min(1000000, Number(item?.amount || 0))),
          }))
        : [];
      const rules = await getCheckoutRules(
        service,
        customer,
        amount,
        Boolean(body?.freeShipping),
        shippingItems,
      );''',
)
replace_once(
    checkout,
    '''    const afterCoupon = roundMoney(Math.max(0, discounted - couponAmount));
    const checkoutRules = await getCheckoutRules(service, customer, afterCoupon, freeShipping);''',
    '''    const afterCoupon = roundMoney(Math.max(0, discounted - couponAmount));
    const shippingItems = normalizedItems
      .filter((item) => item.product?.requires_shipping !== false)
      .map((item) => ({
        productId: String(item.product?.id || ""),
        amount: roundMoney(Number(item.unitPrice || 0) * Number(item.quantity || 1)),
      }));
    const checkoutRules = await getCheckoutRules(service, customer, afterCoupon, freeShipping, shippingItems);''',
)

Path("scripts/verify-checkout-shipping-zones.mjs").write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import { postalPatternMatches, selectShippingRate } from "../supabase/functions/checkout/shipping-zone-rules.mjs";

const generalPaid = { name:"Standard", price:12.99, min_order:0, max_order:149.99, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100 };
const generalFree = { name:"Free", price:0, min_order:150, max_order:null, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100 };
const skPaid = { name:"SK", price:10.99, min_order:0, max_order:149.99, country_codes:["CA"], province_codes:["SK"], postal_patterns:[], priority:100 };
const s7Paid = { name:"Saskatoon", price:8.99, min_order:0, max_order:149.99, country_codes:["CA"], province_codes:["SK"], postal_patterns:["S7*"], priority:100 };
const rates = [generalPaid, generalFree, skPaid, s7Paid];

assert.equal(selectShippingRate(rates, { amount:50, countryCode:"CA", provinceCode:"AB", postalCode:"T2P 1J9" })?.price, 12.99, "Canada-wide fallback rate must remain available");
assert.equal(selectShippingRate(rates, { amount:160, countryCode:"CA", provinceCode:"AB", postalCode:"T2P 1J9" })?.price, 0, "$150+ free-shipping threshold must remain available");
assert.equal(selectShippingRate(rates, { amount:50, countryCode:"CA", provinceCode:"SK", postalCode:"S4P 3Y2" })?.price, 10.99, "province zone must outrank a Canada-wide rate");
assert.equal(selectShippingRate(rates, { amount:50, countryCode:"CA", provinceCode:"SK", postalCode:"S7K 1J5" })?.price, 8.99, "postal zone must outrank a province-wide rate");
assert.equal(selectShippingRate(rates, { amount:160, countryCode:"CA", provinceCode:"SK", postalCode:"S7K 1J5" })?.price, 0, "expired price range must fall through to the matching higher threshold");
assert.equal(postalPatternMatches("S7*", "s7k 1j5"), true, "postal wildcard matching must be case/space insensitive");
assert.equal(postalPatternMatches("S7*", "S4P 3Y2"), false, "postal wildcard must not match another region");

const edge = fs.readFileSync("supabase/functions/checkout/index.ts", "utf8");
const profileRules = fs.readFileSync("supabase/functions/checkout/shipping-profile-rules.mjs", "utf8");
const page = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const api = fs.readFileSync("src/lib/customerApi.js", "utf8");
assert(profileRules.includes('import { selectShippingRate } from "./shipping-zone-rules.mjs";'), "profile engine must preserve the tested zone selector");
assert(edge.includes('import { calculateProfileShipping } from "./shipping-profile-rules.mjs";'), "checkout must use the profile-aware zone selector");
assert(edge.includes('postalCode: body?.postalCode || ""'), "checkoutConfig must accept postal code");
assert(edge.includes('getShippingQuote(service, amount, customer?.province, customer?.postalCode, shippingItems)'), "authoritative checkout must pass destination into profile-aware rate selection");
assert(page.includes("checkoutPostalCode = normalizePostal(form.postalCode)"), "client config key must include normalized postal code");
assert(page.includes("postalCode:checkoutPostalCode"), "client must send postal code to checkoutConfig");
assert(api.includes('postalCode = ""'), "customer API must accept postal code for checkoutConfig");
console.log("PASS checkout shipping zones: destination matching, fallback thresholds, and client/server wiring verified");
''')

Path("scripts/verify-checkout-shipping-profiles.mjs").write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateProfileShipping, resolveProfileForProduct } from "../supabase/functions/checkout/shipping-profile-rules.mjs";

const general = { id:"general", name:"Canada Standard", active:true, product_scope:"all", product_ids:[], priority:10 };
const custom = { id:"custom", name:"DTF Profile", active:true, product_scope:"selected", product_ids:["dtf"], priority:50 };
const inactive = { id:"inactive", name:"Inactive", active:false, product_scope:"selected", product_ids:["inactive-product"], priority:1 };
const profiles = [general, custom, inactive];
const rates = [
  { profile_id:"general", name:"Standard Shipping", method_code:"standard", price:12.99, min_order:0, max_order:149.99, active:true, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100, min_delivery_days:3, max_delivery_days:7 },
  { profile_id:"general", name:"Free Standard Shipping", method_code:"standard", price:0, min_order:150, max_order:null, active:true, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100, min_delivery_days:3, max_delivery_days:7 },
  { profile_id:"custom", name:"DTF Flat", method_code:"standard", price:6.99, min_order:0, max_order:null, active:true, country_codes:["CA"], province_codes:[], postal_patterns:[], priority:100, min_delivery_days:2, max_delivery_days:5 },
  { profile_id:"custom", name:"Saskatoon DTF", method_code:"standard", price:4.99, min_order:0, max_order:null, active:true, country_codes:["CA"], province_codes:["SK"], postal_patterns:["S7*"], priority:90, min_delivery_days:1, max_delivery_days:3 },
];
const destination = { countryCode:"CA", provinceCode:"AB", postalCode:"T2P1J9" };

assert.equal(resolveProfileForProduct(profiles, "plain")?.id, "general", "unassigned products must use General shipping");
assert.equal(resolveProfileForProduct(profiles, "dtf")?.id, "custom", "assigned products must use their active custom profile");
assert.equal(resolveProfileForProduct(profiles, "inactive-product")?.id, "general", "inactive custom profiles must be ignored");

const generalQuote = calculateProfileShipping({ profiles, rates, items:[{productId:"plain",amount:50}], amount:50, destination });
assert.equal(generalQuote.shipping, 12.99, "general profile must preserve the current paid rate");
const customQuote = calculateProfileShipping({ profiles, rates, items:[{productId:"dtf",amount:50}], amount:50, destination });
assert.equal(customQuote.shipping, 6.99, "single custom profile must use its own rate");
const mixedQuote = calculateProfileShipping({ profiles, rates, items:[{productId:"plain",amount:100},{productId:"dtf",amount:100}], amount:200, destination });
assert.equal(mixedQuote.shipping, 19.98, "mixed carts must combine applicable profile charges");
assert.equal(mixedQuote.groups.length, 2, "mixed cart must expose two shipping groups");
const discountedMixed = calculateProfileShipping({ profiles, rates, items:[{productId:"plain",amount:100},{productId:"dtf",amount:100}], amount:160, destination });
assert.equal(discountedMixed.groups.find(g=>g.profileId==="general")?.amount, 80, "discounted order value must be allocated proportionally to profile groups");
assert.equal(discountedMixed.shipping, 19.98, "general free threshold must not incorrectly use the whole mixed-cart amount");
const skQuote = calculateProfileShipping({ profiles, rates, items:[{productId:"dtf",amount:50}], amount:50, destination:{countryCode:"CA",provinceCode:"SK",postalCode:"S7K1J5"} });
assert.equal(skQuote.shipping, 4.99, "custom profiles must still honor province/postal specificity");
const noCustomRate = calculateProfileShipping({ profiles, rates:rates.filter(r=>r.profile_id!=="custom"), items:[{productId:"dtf",amount:50}], amount:50, destination });
assert.equal(noCustomRate.shipping, 12.99, "incomplete custom profiles must fall back safely to General shipping rates");

const edge = fs.readFileSync("supabase/functions/checkout/index.ts", "utf8");
const page = fs.readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
const api = fs.readFileSync("src/lib/customerApi.js", "utf8");
const adminApi = fs.readFileSync("src/lib/shippingAdminApi.js", "utf8");
const adminUi = fs.readFileSync("src/components/admin/ShippingDeliveryManager.jsx", "utf8");
assert(edge.includes('shipping_profiles'), "authoritative checkout must load active shipping profiles");
assert(edge.includes('shippingItems = normalizedItems'), "authoritative checkout must group server-priced order items");
assert(edge.includes('shippingProfileCount'), "checkout response must expose profile count for diagnostics");
assert(page.includes('checkoutShippingItems'), "checkout preview must key and send product shipping groups");
assert(api.includes('shippingItems = []'), "customer API must accept shipping profile items");
assert(adminApi.includes('product_ids'), "admin API must persist profile product assignments");
assert(adminApi.includes('products:unwrap(products)'), "admin API must load assignable shippable products");
assert(adminUi.includes('Custom product shipping profiles'), "Admin Shipping must expose custom product profiles");
assert(adminUi.includes('Product assignments'), "Admin Shipping must expose product assignment controls");
console.log("PASS product shipping profiles: assignments, mixed-cart combination, discount allocation, zone matching, fallback, and admin wiring verified");
''')
