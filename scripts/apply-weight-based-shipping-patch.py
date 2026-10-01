from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


Path("supabase/functions/checkout/shipping-zone-rules.mjs").write_text(r'''const asList = (value) => Array.isArray(value) ? value : [];
const compact = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
const numberOr = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function postalPatternMatches(pattern, postalCode) {
  const normalizedPattern = compact(pattern).replace(/[^A-Z0-9*]/g, "");
  const normalizedPostal = compact(postalCode).replace(/[^A-Z0-9]/g, "");
  if (!normalizedPattern || !normalizedPostal) return false;
  const escaped = normalizedPattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(normalizedPostal);
}

export function shippingRateMatchesDestination(rate, destination = {}) {
  const countryCode = compact(destination.countryCode || "CA");
  const provinceCode = compact(destination.provinceCode);
  const postalCode = compact(destination.postalCode);
  const countryCodes = asList(rate?.country_codes).map(compact).filter(Boolean);
  const provinceCodes = asList(rate?.province_codes).map(compact).filter(Boolean);
  const postalPatterns = asList(rate?.postal_patterns).map((value) => String(value || "").trim()).filter(Boolean);

  if (countryCodes.length && !countryCodes.includes(countryCode)) return false;
  if (provinceCodes.length && (!provinceCode || !provinceCodes.includes(provinceCode))) return false;
  if (postalPatterns.length && (!postalCode || !postalPatterns.some((pattern) => postalPatternMatches(pattern, postalCode)))) return false;
  return true;
}

function specificity(rate) {
  if (asList(rate?.postal_patterns).length) return 2;
  if (asList(rate?.province_codes).length) return 1;
  return 0;
}

function weightSpecificity(rate) {
  return rate?.min_weight_grams != null || rate?.max_weight_grams != null ? 1 : 0;
}

export function selectShippingRate(rates, destination = {}) {
  const amount = Math.max(0, numberOr(destination.amount, 0));
  const weightKnown = destination.weightKnown === true && Number.isFinite(Number(destination.weightGrams));
  const weightGrams = weightKnown ? Math.max(0, Number(destination.weightGrams)) : null;
  return (Array.isArray(rates) ? rates : [])
    .filter((rate) => {
      const min = rate?.min_order == null ? 0 : numberOr(rate.min_order, 0);
      const max = rate?.max_order == null ? Number.POSITIVE_INFINITY : numberOr(rate.max_order, Number.NEGATIVE_INFINITY);
      if (amount < min || amount > max || !shippingRateMatchesDestination(rate, destination)) return false;
      const hasWeightRule = rate?.min_weight_grams != null || rate?.max_weight_grams != null;
      if (!hasWeightRule) return true;
      if (!weightKnown) return false;
      const minWeight = rate?.min_weight_grams == null ? 0 : numberOr(rate.min_weight_grams, 0);
      const maxWeight = rate?.max_weight_grams == null ? Number.POSITIVE_INFINITY : numberOr(rate.max_weight_grams, Number.NEGATIVE_INFINITY);
      return weightGrams >= minWeight && weightGrams <= maxWeight;
    })
    .sort((a, b) => {
      const specificityDelta = specificity(b) - specificity(a);
      if (specificityDelta) return specificityDelta;
      const weightDelta = weightSpecificity(b) - weightSpecificity(a);
      if (weightDelta) return weightDelta;
      const priorityDelta = numberOr(a?.priority, 100) - numberOr(b?.priority, 100);
      if (priorityDelta) return priorityDelta;
      const minWeightDelta = numberOr(b?.min_weight_grams, 0) - numberOr(a?.min_weight_grams, 0);
      if (minWeightDelta) return minWeightDelta;
      const minOrderDelta = numberOr(b?.min_order, 0) - numberOr(a?.min_order, 0);
      if (minOrderDelta) return minOrderDelta;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    })[0] || null;
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

export function calculateProfileShipping({ profiles = [], rates = [], items = [], amount = 0, destination = {}, packageWeightGrams = 0 } = {}) {
  const safeAmount = Math.max(0, roundMoney(amount));
  const safePackageWeight = Math.max(0, Number(packageWeightGrams || 0));
  const active = sortProfiles(activeProfiles(profiles));
  const general = active.find((profile) => profile?.product_scope === "all") || null;
  const cleanItems = asList(items).filter((item) => String(item?.productId || "").trim());
  const groups = new Map();

  const addToGroup = (profile, itemAmount, itemWeightGrams, weightKnown) => {
    const key = String(profile?.id || "__general_fallback__");
    const existing = groups.get(key) || { profile, rawAmount:0, itemWeightGrams:0, weightKnown:true };
    existing.rawAmount += Math.max(0, Number(itemAmount || 0));
    if (weightKnown === true && Number.isFinite(Number(itemWeightGrams))) {
      existing.itemWeightGrams += Math.max(0, Number(itemWeightGrams));
    } else {
      existing.weightKnown = false;
    }
    groups.set(key, existing);
  };

  for (const item of cleanItems) addToGroup(resolveProfileForProduct(active, item.productId), item.amount, item.weightGrams, item.weightKnown);
  if (!groups.size) addToGroup(general, safeAmount, null, false);

  const groupList = [...groups.values()].sort((a, b) => priority(a.profile) - priority(b.profile) || String(a.profile?.name || "").localeCompare(String(b.profile?.name || "")));
  const rawTotal = groupList.reduce((sum, group) => sum + Math.max(0, Number(group.rawAmount || 0)), 0);
  let allocated = 0;
  const quoted = groupList.map((group, index) => {
    const groupAmount = index === groupList.length - 1
      ? roundMoney(Math.max(0, safeAmount - allocated))
      : roundMoney(rawTotal > 0 ? safeAmount * (Math.max(0, Number(group.rawAmount || 0)) / rawTotal) : safeAmount / groupList.length);
    allocated = roundMoney(allocated + groupAmount);
    const groupWeightKnown = group.weightKnown === true;
    const groupWeightGrams = groupWeightKnown ? Math.max(0, Number(group.itemWeightGrams || 0) + safePackageWeight) : null;
    const profileId = group.profile?.id || null;
    const profileRates = asList(rates).filter((rate) => rate?.active !== false && String(rate?.method_code || "standard") === "standard" && profileId && String(rate?.profile_id || "") === String(profileId));
    const rateContext = { ...destination, amount:groupAmount, weightKnown:groupWeightKnown, weightGrams:groupWeightGrams };
    let rule = selectShippingRate(profileRates, rateContext);
    let rateProfile = group.profile;
    if (!rule && general && String(general.id) !== String(profileId)) {
      const generalRates = asList(rates).filter((rate) => rate?.active !== false && String(rate?.method_code || "standard") === "standard" && String(rate?.profile_id || "") === String(general.id));
      rule = selectShippingRate(generalRates, rateContext);
      rateProfile = general;
    }
    if (!rule) rule = fallbackRule(groupAmount);
    return {
      profileId,
      profileName: group.profile?.name || general?.name || "General shipping",
      rateProfileId: rateProfile?.id || null,
      amount: groupAmount,
      weightKnown: groupWeightKnown,
      weightGrams: groupWeightGrams,
      name: rule.name || "Standard Shipping",
      price: roundMoney(Number(rule.price || 0)),
      minOrder: rule.min_order == null ? null : Number(rule.min_order),
      minWeightGrams: rule.min_weight_grams == null ? null : Number(rule.min_weight_grams),
      maxWeightGrams: rule.max_weight_grams == null ? null : Number(rule.max_weight_grams),
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
    shippingWeightGrams: single?.weightKnown ? single.weightGrams : null,
    groups: quoted,
  };
}
''')

replace_once(
    "src/lib/shippingAdminApi.js",
    'supabase.from("products").select("id,name,slug,category,status,requires_shipping,selling_mode").eq("requires_shipping",true).order("name")',
    'supabase.from("products").select("id,name,slug,category,status,requires_shipping,selling_mode,weight,weight_unit").eq("requires_shipping",true).order("name")',
)
replace_once(
    "src/lib/shippingAdminApi.js",
    ' async deleteRate(id){return unwrap(await supabase.from("shipping_rates").delete().eq("id",id));},\n async savePackage(p){',
    ' async deleteRate(id){return unwrap(await supabase.from("shipping_rates").delete().eq("id",id));},\n async saveProductWeight(product){const raw=product?.weight;const weight=raw===""||raw==null?null:Math.max(0,Number(raw));if(weight!=null&&!Number.isFinite(weight))throw new Error("Enter a valid product weight.");return unwrap(await supabase.from("products").update({weight,weight_unit:"g",updated_at:new Date().toISOString()}).eq("id",product.id).select("id,name,weight,weight_unit").single());},\n async savePackage(p){',
)

replace_once(
    "src/components/admin/ShippingDeliveryManager.jsx",
    '  const [productSearch, setProductSearch] = useState("");\n',
    '  const [productSearch, setProductSearch] = useState("");\n  const [weightSearch, setWeightSearch] = useState("");\n',
)
replace_once(
    "src/components/admin/ShippingDeliveryManager.jsx",
    '  const visibleProducts = useMemo(() => { const term=productSearch.trim().toLowerCase(); return data.products.filter(p=>p.status!=="archived"&&(!term||`${p.name} ${p.slug||""} ${p.category||""}`.toLowerCase().includes(term))); }, [data.products, productSearch]);\n',
    '  const visibleProducts = useMemo(() => { const term=productSearch.trim().toLowerCase(); return data.products.filter(p=>p.status!=="archived"&&(!term||`${p.name} ${p.slug||""} ${p.category||""}`.toLowerCase().includes(term))); }, [data.products, productSearch]);\n  const visibleWeightProducts = useMemo(() => { const term=weightSearch.trim().toLowerCase(); return data.products.filter(p=>p.status!=="archived"&&(!term||`${p.name} ${p.slug||""} ${p.category||""}`.toLowerCase().includes(term))); }, [data.products, weightSearch]);\n',
)
replace_once(
    "src/components/admin/ShippingDeliveryManager.jsx",
    '  const patchPackage = (id, patch) => setData(d => ({ ...d, packages:d.packages.map(p => p.id === id ? { ...p, ...patch } : p) }));\n',
    '  const patchPackage = (id, patch) => setData(d => ({ ...d, packages:d.packages.map(p => p.id === id ? { ...p, ...patch } : p) }));\n  const patchProduct = (id, patch) => setData(d => ({ ...d, products:d.products.map(p => p.id === id ? { ...p, ...patch } : p) }));\n',
)
replace_once(
    "src/components/admin/ShippingDeliveryManager.jsx",
    '  const savePackage = async pkg => { setSaving(true); try { await shippingAdminApi.savePackage(pkg); notify("Package saved."); await load(); } finally { setSaving(false); } };\n',
    '  const savePackage = async pkg => { setSaving(true); try { await shippingAdminApi.savePackage(pkg); notify("Package saved."); await load(); } finally { setSaving(false); } };\n  const saveProductWeight = async product => { setSaving(true); try { await shippingAdminApi.saveProductWeight(product); notify(`${product.name} shipping weight saved.`); await load(); } finally { setSaving(false); } };\n',
)
replace_once(
    "src/components/admin/ShippingDeliveryManager.jsx",
    '    <div className="grid lg:grid-cols-2 gap-5"><section className={`${box} p-5`}><div className="flex items-center gap-2 font-semibold"><MapPin size={18}/> Local pickup</div>',
    '''    <section className={`${box} p-5`}>
      <div><div className="font-semibold">Product shipping weights</div><p className="text-xs text-[#6d7175] mt-1">Enter the packed item weight in grams. Checkout multiplies this by quantity and adds the default package weight once per shipping-profile shipment. Weight-restricted rates are ignored when any product in that shipment has no weight.</p></div>
      <input className={`${input} mt-4`} placeholder="Search products by name, slug or category" value={weightSearch} onChange={e=>setWeightSearch(e.target.value)}/>
      <div className="mt-3 grid md:grid-cols-2 gap-3">{visibleWeightProducts.map(product=><div key={product.id} className="rounded-xl border p-3 flex items-end gap-3"><div className="min-w-0 flex-1"><div className="font-medium text-sm truncate">{product.name}</div><div className="text-[11px] text-[#6d7175] truncate">{product.category||product.selling_mode||"Product"}</div><label className="block text-xs mt-2">Weight per item (g)<input type="number" min="0" step="1" className={input} placeholder="Not set" value={product.weight ?? ""} onChange={e=>patchProduct(product.id,{weight:e.target.value,weight_unit:"g"})}/></label></div><button disabled={saving} onClick={()=>saveProductWeight(product)} className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Save size={14}/> Save</button></div>)}</div>
    </section>

    <div className="grid lg:grid-cols-2 gap-5"><section className={`${box} p-5`}><div className="flex items-center gap-2 font-semibold"><MapPin size={18}/> Local pickup</div>''',
)

replace_once(
    "supabase/functions/checkout/index.ts",
    '''function normalizeCanadianPostalCode(value: unknown) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!canadianPostalCodeRe.test(compact)) return "";
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}
''',
    '''function normalizeCanadianPostalCode(value: unknown) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!canadianPostalCodeRe.test(compact)) return "";
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

function normalizeProductWeightGrams(weight: unknown, unit: unknown) {
  const value = Number(weight);
  if (!Number.isFinite(value) || value < 0) return null;
  const normalizedUnit = String(unit || "g").trim().toLowerCase();
  const multiplier = normalizedUnit === "kg" ? 1000 : normalizedUnit === "lb" || normalizedUnit === "lbs" ? 453.59237 : normalizedUnit === "oz" ? 28.349523125 : 1;
  return Math.max(0, Math.round(value * multiplier * 1000) / 1000);
}
''',
)
old_quote = '''async function getShippingQuote(service: any, amount: number, province: unknown, postalCode: unknown, shippingItems: any[] = []) {
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
}
'''
new_quote = '''async function getShippingQuote(service: any, amount: number, province: unknown, postalCode: unknown, shippingItems: any[] = []) {
  const safeAmount = Math.max(0, roundMoney(amount));
  const productIds = [...new Set((shippingItems || []).map((item: any) => String(item?.productId || "")).filter((id: string) => uuidRe.test(id)))];
  const productWeightsQuery = productIds.length
    ? service.from("products").select("id,weight,weight_unit").in("id", productIds)
    : Promise.resolve({ data: [], error: null });
  const [profilesResult, ratesResult, productWeightsResult, packageResult] = await Promise.all([
    service.from("shipping_profiles").select("id,name,active,product_scope,product_ids,priority").eq("active", true),
    service.from("shipping_rates").select("id,profile_id,name,method_code,price,min_order,max_order,min_delivery_days,max_delivery_days,zone_name,country_codes,province_codes,postal_patterns,min_weight_grams,max_weight_grams,priority,active").eq("active", true).eq("method_code", "standard"),
    productWeightsQuery,
    service.from("shipping_packages").select("empty_weight_grams").eq("active", true).eq("is_default", true).limit(1).maybeSingle(),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (ratesResult.error) throw ratesResult.error;
  if (productWeightsResult.error) throw productWeightsResult.error;
  if (packageResult.error) throw packageResult.error;
  const productWeights = new Map((productWeightsResult.data || []).map((row: any) => [String(row.id), normalizeProductWeightGrams(row.weight, row.weight_unit)]));
  const weightedItems = (shippingItems || []).map((item: any) => {
    const unitWeight = productWeights.get(String(item?.productId || ""));
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item?.quantity || 1))));
    return {
      ...item,
      weightKnown: unitWeight != null,
      weightGrams: unitWeight == null ? null : unitWeight * quantity,
    };
  });
  return calculateProfileShipping({
    profiles: profilesResult.data || [],
    rates: ratesResult.data || [],
    items: weightedItems,
    amount: safeAmount,
    packageWeightGrams: Math.max(0, Number(packageResult.data?.empty_weight_grams || 0)),
    destination: {
      countryCode: "CA",
      provinceCode: normalizeProvinceCode(province),
      postalCode: normalizeCanadianPostalCode(postalCode),
    },
  });
}
'''
replace_once("supabase/functions/checkout/index.ts", old_quote, new_quote)
replace_once(
    "supabase/functions/checkout/index.ts",
    '''            productId: String(item?.productId || ""),
            amount: Math.max(0, Math.min(1000000, Number(item?.amount || 0))),
          }))''',
    '''            productId: String(item?.productId || ""),
            amount: Math.max(0, Math.min(1000000, Number(item?.amount || 0))),
            quantity: Math.max(1, Math.min(99, Math.floor(Number(item?.quantity || 1)))),
          }))''',
)
replace_once(
    "supabase/functions/checkout/index.ts",
    '''        productId: String(item.product?.id || ""),
        amount: roundMoney(Number(item.unitPrice || 0) * Number(item.quantity || 1)),
      }));''',
    '''        productId: String(item.product?.id || ""),
        amount: roundMoney(Number(item.unitPrice || 0) * Number(item.quantity || 1)),
        quantity: Math.max(1, Number(item.quantity || 1)),
      }));''',
)

replace_once(
    "src/pages/CheckoutTwoStep.jsx",
    'const checkoutShippingItems = items.map(item => ({ productId:item.productId, amount:Math.max(0, Number(item.price || 0)) * Math.max(1, Number(item.quantity || 1)) }));',
    'const checkoutShippingItems = items.map(item => ({ productId:item.productId, amount:Math.max(0, Number(item.price || 0)) * Math.max(1, Number(item.quantity || 1)), quantity:Math.max(1, Number(item.quantity || 1)) }));',
)
replace_once(
    "src/pages/CheckoutTwoStep.jsx",
    'const checkoutShippingKey = checkoutShippingItems.map(item => `${item.productId}:${Number(item.amount || 0).toFixed(2)}`).sort().join(",");',
    'const checkoutShippingKey = checkoutShippingItems.map(item => `${item.productId}:${Number(item.amount || 0).toFixed(2)}:${Number(item.quantity || 1)}`).sort().join(",");',
)

Path("scripts/verify-checkout-shipping-weight.mjs").write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs";
import { selectShippingRate } from "../supabase/functions/checkout/shipping-zone-rules.mjs";
import { calculateProfileShipping } from "../supabase/functions/checkout/shipping-profile-rules.mjs";

const general = { id:"general", name:"Canada Standard", product_scope:"all", product_ids:[], active:true, priority:10 };
const baseRates = [
  { id:"default", profile_id:"general", name:"Standard Shipping", method_code:"standard", price:12.99, min_order:0, max_order:149.99, active:true, priority:100, country_codes:["CA"] },
  { id:"free", profile_id:"general", name:"Free Standard Shipping", method_code:"standard", price:0, min_order:150, max_order:null, active:true, priority:100, country_codes:["CA"] },
];
const weightedRates = [
  ...baseRates,
  { id:"light", profile_id:"general", name:"Light parcel", method_code:"standard", price:8.99, min_order:0, max_order:149.99, min_weight_grams:0, max_weight_grams:999, active:true, priority:100, country_codes:["CA"] },
  { id:"heavy", profile_id:"general", name:"Heavy parcel", method_code:"standard", price:18.99, min_order:0, max_order:149.99, min_weight_grams:1000, max_weight_grams:null, active:true, priority:100, country_codes:["CA"] },
];
const destination = { countryCode:"CA", provinceCode:"SK", postalCode:"S7K1J5" };

assert.equal(selectShippingRate(weightedRates, { ...destination, amount:100, weightKnown:false, weightGrams:null })?.id, "default", "unknown weight must ignore weight-restricted rates");
assert.equal(selectShippingRate(weightedRates, { ...destination, amount:100, weightKnown:true, weightGrams:650 })?.id, "light", "matching weight band must outrank unrestricted rate");
assert.equal(selectShippingRate(weightedRates, { ...destination, amount:100, weightKnown:true, weightGrams:1250 })?.id, "heavy", "heavy weight band must match");

let quote = calculateProfileShipping({ profiles:[general], rates:weightedRates, items:[{productId:"tee", amount:100, weightKnown:true, weightGrams:600}], amount:100, destination, packageWeightGrams:30 });
assert.equal(quote.shipping, 8.99);
assert.equal(quote.shippingWeightGrams, 630, "default package weight must be added once per shipment group");
assert.equal(quote.groups[0].weightGrams, 630);

quote = calculateProfileShipping({ profiles:[general], rates:weightedRates, items:[{productId:"tee", amount:100, weightKnown:false, weightGrams:null}], amount:100, destination, packageWeightGrams:30 });
assert.equal(quote.shipping, 12.99, "missing product weight must preserve unrestricted general shipping");
assert.equal(quote.shippingWeightGrams, null);

const custom = { id:"hoodie", name:"Hoodies", product_scope:"selected", product_ids:["hoodie-1"], active:true, priority:20 };
const mixedRates = [
  ...baseRates,
  { id:"hoodie-default", profile_id:"hoodie", name:"Hoodie standard", method_code:"standard", price:14.99, min_order:0, max_order:null, active:true, priority:100, country_codes:["CA"] },
  { id:"hoodie-heavy", profile_id:"hoodie", name:"Hoodie heavy", method_code:"standard", price:19.99, min_order:0, max_order:null, min_weight_grams:1000, max_weight_grams:null, active:true, priority:100, country_codes:["CA"] },
];
quote = calculateProfileShipping({ profiles:[general,custom], rates:mixedRates, items:[{productId:"tee",amount:40,weightKnown:true,weightGrams:180},{productId:"hoodie-1",amount:80,weightKnown:true,weightGrams:1100}], amount:120, destination, packageWeightGrams:30 });
assert.equal(quote.shipping, 32.98, "mixed profiles must apply weight rules independently and combine shipping");
assert.equal(quote.groups.length, 2);
assert.equal(quote.groups.find(g=>g.profileId==="hoodie")?.weightGrams, 1130);

const checkout = fs.readFileSync("supabase/functions/checkout/index.ts", "utf8");
assert.match(checkout, /select\("id,weight,weight_unit"\)/, "checkout must resolve product weights server-side");
assert.match(checkout, /shipping_packages/, "checkout must include default package weight");
assert.match(checkout, /min_weight_grams,max_weight_grams/, "checkout rate query must include weight limits");
assert.match(checkout, /quantity: Math\.max\(1/, "checkout quote items must preserve quantity");
const adminApi = fs.readFileSync("src/lib/shippingAdminApi.js", "utf8");
assert.match(adminApi, /saveProductWeight/, "Admin API must save product shipping weights");
assert.match(adminApi, /weight_unit:\"g\"/, "Admin weight saves must normalize to grams");
const admin = fs.readFileSync("src/components/admin/ShippingDeliveryManager.jsx", "utf8");
assert.match(admin, /Product shipping weights/, "Shipping Admin must expose product weight management");
assert.match(admin, /Weight per item \(g\)/, "Shipping Admin must label weight units clearly");
console.log("PASS checkout weight-based shipping regression");
''')

build_path = Path(".github/workflows/build-verification.yml")
build = build_path.read_text()
needle = "          node scripts/verify-checkout-shipping-profiles.mjs\n"
if needle not in build:
    raise SystemExit("Shipping profile regression hook not found in build verification")
if "verify-checkout-shipping-weight.mjs" not in build:
    build = build.replace(needle, needle + "          node scripts/verify-checkout-shipping-weight.mjs\n", 1)
build_path.write_text(build)
