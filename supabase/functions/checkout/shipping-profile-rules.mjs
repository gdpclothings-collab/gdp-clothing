import { selectShippingRate } from "./shipping-zone-rules.mjs";

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
