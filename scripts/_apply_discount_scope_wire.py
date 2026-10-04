from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 exact match, found {count}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label, flags=re.S):
    updated, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 regex match, found {count}")
    return updated


def replace_count(text, old, new, expected, label):
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} exact matches, found {count}")
    return text.replace(old, new)


# 1) Server-side checkout discount scope enforcement + storefront promotion endpoint.
path = "supabase/functions/checkout/index.ts"
text = read(path)
text = replace_once(
    text,
    'import { calculateTaxBreakdown } from "./tax-rules.mjs";',
    'import { calculateTaxBreakdown } from "./tax-rules.mjs";\nimport { couponAmountForBase, couponIsUsable, publicPromotion } from "./discount-rules.mjs";',
    "checkout discount helper import",
)

text = sub_once(
    text,
    r'function couponIsUsable\(row: any, purchase: number\) \{.*?\n\}\n\nasync function getCoupon\(service: any, code: string, purchase = 0\) \{.*?return couponIsUsable\(data, purchase\) \? data : null;\n\}',
    '''async function getCoupon(service: any, code: string) {
  if (!code) return null;
  const { data } = await service
    .from("discounts")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  return couponIsUsable(data) ? data : null;
}

async function couponTargetProductIds(service: any, coupon: any, candidateProductIds: string[]) {
  const scope = String(coupon?.applies_to || "all");
  if (scope === "all") return null;

  const targetId = String(coupon?.applies_to_id || "");
  if (!uuidRe.test(targetId)) return new Set<string>();
  if (scope === "product") return new Set<string>([targetId]);
  if (scope !== "collection" || !candidateProductIds.length) return new Set<string>();

  const { data, error } = await service
    .from("collection_products")
    .select("product_id")
    .eq("collection_id", targetId)
    .in("product_id", candidateProductIds);
  if (error) throw error;

  return new Set<string>((data || []).map((row: any) => String(row.product_id || "")).filter(Boolean));
}

async function couponBaseForNormalizedItems(service: any, coupon: any, items: any[]) {
  const candidateProductIds = [...new Set(items.map((item: any) => String(item?.product?.id || "")).filter((id: string) => uuidRe.test(id)))];
  const targetProductIds = await couponTargetProductIds(service, coupon, candidateProductIds);
  let eligibleSubtotal = 0;

  for (const item of items) {
    const productId = String(item?.product?.id || "");
    if (targetProductIds && !targetProductIds.has(productId)) continue;
    const rawLineSubtotal = roundMoney(Number(item?.unitPrice || 0) * Number(item?.quantity || 1));
    const discountedLineSubtotal = item?.discountExempt
      ? rawLineSubtotal
      : roundMoney(Number(item?.customData?.discountedLineSubtotal ?? rawLineSubtotal));
    eligibleSubtotal += discountedLineSubtotal;
  }

  return roundMoney(eligibleSubtotal);
}

async function previewCouponBase(service: any, coupon: any, rawItems: any, purchase: number) {
  const scope = String(coupon?.applies_to || "all");
  if (scope === "all") return roundMoney(Math.max(0, purchase));

  const items = Array.isArray(rawItems)
    ? rawItems.slice(0, 100).map((item: any) => ({
        productId: String(item?.productId || ""),
        amount: Math.max(0, Math.min(1000000, Number(item?.amount || 0))),
      })).filter((item: any) => uuidRe.test(item.productId))
    : [];
  const candidateProductIds = [...new Set(items.map((item: any) => item.productId))];
  const targetProductIds = await couponTargetProductIds(service, coupon, candidateProductIds);
  if (!targetProductIds || !targetProductIds.size) return 0;

  return roundMoney(items.reduce((sum: number, item: any) => (
    targetProductIds.has(item.productId) ? sum + item.amount : sum
  ), 0));
}''',
    "checkout coupon helper replacement",
)

text = replace_once(
    text,
    '    if (action === "validateCoupon") {',
    '''    if (action === "getProductPromotions") {
      const productId = String(body?.productId || "").trim();
      if (!uuidRe.test(productId)) {
        return respond(req, { promotions: [] });
      }

      const { data: productDiscountRows, error: productDiscountError } = await service
        .from("discounts")
        .select("code,type,value,min_purchase,active,starts_at,ends_at,usage_count,usage_limit,applies_to,applies_to_id")
        .eq("active", true)
        .eq("applies_to", "product")
        .eq("applies_to_id", productId);
      if (productDiscountError) throw productDiscountError;

      const { data: collectionLinks, error: collectionLinkError } = await service
        .from("collection_products")
        .select("collection_id")
        .eq("product_id", productId);
      if (collectionLinkError) throw collectionLinkError;

      const collectionIds = [...new Set((collectionLinks || []).map((row: any) => String(row.collection_id || "")).filter((id: string) => uuidRe.test(id)))];
      let collectionDiscountRows: any[] = [];
      if (collectionIds.length) {
        const { data, error } = await service
          .from("discounts")
          .select("code,type,value,min_purchase,active,starts_at,ends_at,usage_count,usage_limit,applies_to,applies_to_id")
          .eq("active", true)
          .eq("applies_to", "collection")
          .in("applies_to_id", collectionIds);
        if (error) throw error;
        collectionDiscountRows = data || [];
      }

      const promotions = [...new Map(
        [...(productDiscountRows || []), ...collectionDiscountRows]
          .filter((row: any) => couponIsUsable(row))
          .map((row: any) => [String(row.code || ""), row])
      ).values()].map(publicPromotion);

      return respond(req, { promotions });
    }

    if (action === "validateCoupon") {''',
    "checkout product promotions action insert",
)

text = sub_once(
    text,
    r'    if \(action === "validateCoupon"\) \{.*?\n    \}\n\n    if \(action === "checkoutConfig"\) \{',
    '''    if (action === "validateCoupon") {
      const code = String(body?.code || "").trim().toUpperCase();
      if (!code) return respond(req, { active: false, reason: "missing_code" });

      const { data } = await service
        .from("discounts")
        .select("code,type,value,min_purchase,active,starts_at,ends_at,usage_count,usage_limit,applies_to,applies_to_id")
        .eq("code", code)
        .maybeSingle();

      const purchase = Math.max(0, Number(body?.purchase || 0));
      const currentlyUsable = couponIsUsable(data);
      const eligibleSubtotal = data ? await previewCouponBase(service, data, body?.items, purchase) : 0;
      const active = currentlyUsable && eligibleSubtotal > 0 && couponIsUsable(data, eligibleSubtotal);

      if (!active) {
        const reason = !currentlyUsable
          ? "invalid_or_expired"
          : eligibleSubtotal <= 0
            ? "not_applicable"
            : "minimum_purchase";
        return respond(req, {
          active: false,
          reason,
          minPurchase: data?.min_purchase == null ? null : Number(data.min_purchase),
          eligibleSubtotal,
        });
      }

      return respond(req, {
        active: true,
        code: data.code,
        type: data.type,
        value: Number(data.value || 0),
        amount: couponAmountForBase(data, eligibleSubtotal),
        eligibleSubtotal,
        appliesTo: String(data.applies_to || "all"),
        minPurchase: data.min_purchase == null ? null : Number(data.min_purchase),
      });
    }

    if (action === "checkoutConfig") {''',
    "checkout validateCoupon action replacement",
)

text = sub_once(
    text,
    r'    let eligibleDiscounted = 0;\n    for \(const item of normalizedItems\) \{.*?\n    eligibleDiscounted = roundMoney\(eligibleDiscounted\);',
    '''    let eligibleDiscounted = 0;
    for (const item of normalizedItems) {
      if (item.discountExempt) continue;

      const quantity = Number(item.quantity || 1);
      let discountedLineSubtotal = Number(item.unitPrice || 0) * quantity;
      const readyToWearEligible = (item.customData as any)?.readyToWearPricingEligible === true;

      if (readyToWearEligible) {
        const productId = String(item.product?.id || "");
        const tierQuantity = productId
          ? Number(readyToWearQuantityByProduct.get(productId) || quantity)
          : quantity;
        const percent = readyToWearVolumePercent(apparelPricing, tierQuantity);
        discountedLineSubtotal = Number(item.unitPrice || 0) * quantity * (1 - percent / 100);
      } else {
        const apparelKey = String((item.customData as any)?.apparelPricingKey || "");
        if (apparelKey) {
          if (quantity >= Number(apparelPricing.customQuoteMinQty || 50)) {
            return respond(req, {
              error: true,
              message: `Orders of ${apparelPricing.customQuoteMinQty}+ custom apparel pieces require a custom quote. Please contact GDP Clothing.`,
              requiresQuote: true,
            }, 409);
          }

          const placementKey = String((item.customData as any)?.apparelPlacement || "front");
          const surcharge = Math.max(0, Number((item.customData as any)?.apparelSurcharge || 0));
          const matrix = apparelPricing.products?.[apparelKey]?.[placementKey] || {};
          const exact = [2, 5, 10].includes(quantity) ? Number(matrix?.[quantity]) : NaN;
          if (Number.isFinite(exact) && exact >= 0) {
            discountedLineSubtotal = exact + surcharge * quantity;
          } else {
            const onePrice = Math.max(0, Number(matrix?.[1] ?? (Number(item.unitPrice || 0) - surcharge)));
            const percent = apparelVolumePercent(apparelPricing, quantity);
            discountedLineSubtotal = onePrice * quantity * (1 - percent / 100) + surcharge * quantity;
          }
        }
      }

      discountedLineSubtotal = roundMoney(discountedLineSubtotal);
      item.customData = { ...(item.customData || {}), discountedLineSubtotal };
      eligibleDiscounted += discountedLineSubtotal;
    }

    eligibleDiscounted = roundMoney(eligibleDiscounted);''',
    "checkout per-line quantity pricing replacement",
)

text = sub_once(
    text,
    r'    const couponCode = String\(body\?\.discountCode \|\| customer\.discountCode \|\| ""\)\.trim\(\)\.toUpperCase\(\);\n    const coupon = \(apparelPricing\.allowCouponStacking \|\| quantityDiscount <= 0\) \? await getCoupon\(service, couponCode, discounted\) : null;\n    let couponAmount = 0;\n    let freeShipping = false;\n\n    if \(coupon\) \{.*?\n    \}',
    '''    const couponCode = String(body?.discountCode || customer.discountCode || "").trim().toUpperCase();
    const couponCandidate = (apparelPricing.allowCouponStacking || quantityDiscount <= 0)
      ? await getCoupon(service, couponCode)
      : null;
    const couponBase = couponCandidate
      ? await couponBaseForNormalizedItems(service, couponCandidate, normalizedItems)
      : 0;
    const coupon = couponCandidate && couponBase > 0 && couponIsUsable(couponCandidate, couponBase)
      ? couponCandidate
      : null;
    let couponAmount = 0;
    let freeShipping = false;

    if (coupon) {
      couponAmount = couponAmountForBase(coupon, couponBase);
      if (coupon.type === "free_shipping") freeShipping = true;
    }''',
    "checkout authoritative coupon pricing replacement",
)

text = replace_count(
    text,
    '          discount: roundMoney(quantityDiscount + couponAmount),\n          shipping,',
    '          discount: roundMoney(quantityDiscount + couponAmount),\n          couponAmount,\n          couponCode: coupon?.code || null,\n          shipping,',
    2,
    "checkout pricing response coupon detail",
)
write(path, text)


# 2) Customer API: scoped validation and product-promotion endpoint.
path = "src/lib/customerApi.js"
text = read(path)
old = '''  async validateCoupon(code, purchase = 0) {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: { action: "validateCoupon", code, purchase },
    });
    if (error) throw error;
    return data;
  },'''
new = '''  async getProductPromotions(productId) {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: { action: "getProductPromotions", productId },
    });
    if (error) throw error;
    return Array.isArray(data?.promotions) ? data.promotions : [];
  },

  async validateCoupon(code, purchase = 0, items = []) {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: { action: "validateCoupon", code, purchase, items },
    });
    if (error) throw error;
    return data;
  },'''
text = replace_once(text, old, new, "customerApi discount methods")
write(path, text)


# 3) Cart pricing: expose server-aligned discounted subtotal per product for safe preview validation.
path = "src/lib/cartPricing.js"
text = read(path)
text = replace_once(
    text,
    '  const readyToWearQuantityByProduct = new Map();',
    '''  const readyToWearQuantityByProduct = new Map();
  const discountedByProduct = new Map();
  const addDiscountedByProduct = (item, amount) => {
    const productId = String(item?.productId || "").trim();
    if (!productId) return;
    discountedByProduct.set(productId, Number(discountedByProduct.get(productId) || 0) + Number(amount || 0));
  };''',
    "cartPricing per-product accumulator",
)
text = replace_once(text, '      afterDiscount += line;\n      exemptSubtotal += line;', '      afterDiscount += line;\n      addDiscountedByProduct(item, line);\n      exemptSubtotal += line;', "cartPricing exempt line")
text = replace_once(text, '      afterDiscount += discountedLine;\n      eligibleSubtotal += line;', '      afterDiscount += discountedLine;\n      addDiscountedByProduct(item, discountedLine);\n      eligibleSubtotal += line;', "cartPricing ready-to-wear line")
text = replace_once(text, '      afterDiscount += line;\n      eligibleSubtotal += line;\n      eligibleCount += quantity;\n      continue;', '      afterDiscount += line;\n      addDiscountedByProduct(item, line);\n      eligibleSubtotal += line;\n      eligibleCount += quantity;\n      continue;', "cartPricing regular line")
text = replace_once(text, '      afterDiscount += regularLine;\n      continue;', '      afterDiscount += regularLine;\n      addDiscountedByProduct(item, regularLine);\n      continue;', "cartPricing quote line")
text = replace_once(text, '      afterDiscount += Number(exact) + surcharge * quantity;\n      continue;', '      const discountedLine = Number(exact) + surcharge * quantity;\n      afterDiscount += discountedLine;\n      addDiscountedByProduct(item, discountedLine);\n      continue;', "cartPricing exact bundle line")
text = replace_once(text, '    afterDiscount += onePrice * quantity * (1 - percent / 100) + surcharge * quantity;', '    const discountedLine = onePrice * quantity * (1 - percent / 100) + surcharge * quantity;\n    afterDiscount += discountedLine;\n    addDiscountedByProduct(item, discountedLine);', "cartPricing volume line")
text = replace_once(
    text,
    '    readyToWearPercents: sortedReadyToWearPercents,\n    label,',
    '    readyToWearPercents: sortedReadyToWearPercents,\n    discountedByProduct: Object.fromEntries([...discountedByProduct.entries()].map(([productId, value]) => [productId, round(value)])),\n    label,',
    "cartPricing return per-product subtotals",
)
write(path, text)


# 4) Checkout UI: use scoped preview amount and clearer eligibility errors; sync final server amount.
path = "src/pages/CheckoutTwoStep.jsx"
text = read(path)
text = replace_once(
    text,
    'const coupon = appliedDiscount ? (appliedDiscount.type === "fixed" ? appliedDiscount.value : discounted * appliedDiscount.value / 100) : 0;',
    'const coupon = appliedDiscount ? Math.max(0, Number(appliedDiscount.amount || 0)) : 0;',
    "checkout UI scoped coupon amount",
)
text = replace_once(
    text,
    'const checkoutShippingKey = checkoutShippingItems.map(item =>',
    'const checkoutDiscountItems = Object.entries(pricing.discountedByProduct || {}).map(([productId, amount]) => ({ productId, amount:Math.max(0, Number(amount || 0)) })); const checkoutShippingKey = checkoutShippingItems.map(item =>',
    "checkout UI discount item payload",
)
text = replace_once(
    text,
    '  const applyCoupon = async () => { if (!form.discountCode) return; setError(""); try { const d = await customerApi.validateCoupon(form.discountCode, discounted); d?.active ? setAppliedDiscount(d) : setError("Invalid or expired code."); } catch { setError("Could not validate code."); } };',
    '''  const applyCoupon = async () => {
    if (!form.discountCode) return;
    setError("");
    try {
      const d = await customerApi.validateCoupon(form.discountCode, discounted, checkoutDiscountItems);
      if (d?.active) {
        setAppliedDiscount(d);
        return;
      }
      if (d?.reason === "not_applicable") return setError("This discount code does not apply to the items in your cart.");
      if (d?.reason === "minimum_purchase") return setError(`This code requires at least $${Number(d.minPurchase || 0).toFixed(2)} in eligible products.`);
      setError("Invalid or expired code.");
    } catch {
      setError("Could not validate code.");
    }
  };''',
    "checkout UI applyCoupon",
)
text = replace_once(
    text,
    'if (data?.pricing) setConfig(v => ({ ...(v?.requestKey === checkoutConfigKey ? v : {}), requestKey:checkoutConfigKey, shipping:Number(data.pricing.shipping || 0), taxRate:Number(data.pricing.taxRate || 0), taxName:data.pricing.taxName || (v?.requestKey === checkoutConfigKey ? v?.taxName : null) || "Tax" }));',
    '''if (data?.pricing) {
      setConfig(v => ({ ...(v?.requestKey === checkoutConfigKey ? v : {}), requestKey:checkoutConfigKey, shipping:Number(data.pricing.shipping || 0), taxRate:Number(data.pricing.taxRate || 0), taxName:data.pricing.taxName || (v?.requestKey === checkoutConfigKey ? v?.taxName : null) || "Tax" }));
      if (form.discountCode) {
        if (data.pricing.couponCode) setAppliedDiscount(current => current ? { ...current, amount:Number(data.pricing.couponAmount || 0) } : current);
        else setAppliedDiscount(null);
      }
    }''',
    "checkout UI final server coupon sync",
)
write(path, text)


# 5) Product page: surface product/collection promo codes without pretending code discounts are automatic sale prices.
path = "src/pages/ProductDetail.jsx"
text = read(path)
text = replace_once(
    text,
    'import { normalizeApparelPricing } from "@/lib/apparelPricing";',
    'import { normalizeApparelPricing } from "@/lib/apparelPricing";\nimport { customerApi } from "@/lib/customerApi";',
    "product detail customerApi import",
)
text = replace_once(
    text,
    '  const [apparelPricing, setApparelPricing] = useState(() => normalizeApparelPricing({}));',
    '  const [apparelPricing, setApparelPricing] = useState(() => normalizeApparelPricing({}));\n  const [promotions, setPromotions] = useState([]);',
    "product detail promotion state",
)
text = replace_once(
    text,
    '      setQty(1);\n      setSizeGuideOpen(false);',
    '      setQty(1);\n      setPromotions([]);\n      setSizeGuideOpen(false);',
    "product detail clear promotions",
)
anchor = '''  useEffect(() => {
    if (product?.slug === "dtf-gang-sheet") {'''
insert = '''  useEffect(() => {
    let active = true;
    if (!product?.id) {
      setPromotions([]);
      return () => { active = false; };
    }
    customerApi.getProductPromotions(product.id).then(
      (rows) => { if (active) setPromotions(Array.isArray(rows) ? rows : []); },
      () => { if (active) setPromotions([]); },
    );
    return () => { active = false; };
  }, [product?.id]);

  useEffect(() => {
    if (product?.slug === "dtf-gang-sheet") {'''
text = replace_once(text, anchor, insert, "product detail promotion effect")
price_anchor = '''              {hasSale && (
                <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em]">
                  <span className="bg-[#e11d2e]/10 px-2 py-1 font-black text-[#b51222]">Save {savingsPercent}%</span>
                  <span className="text-black/48">You save {formatCad(savingsAmount)}</span>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-black/52">'''
price_repl = '''              {hasSale && (
                <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em]">
                  <span className="bg-[#e11d2e]/10 px-2 py-1 font-black text-[#b51222]">Save {savingsPercent}%</span>
                  <span className="text-black/48">You save {formatCad(savingsAmount)}</span>
                </div>
              )}
              {promotions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {promotions.slice(0, 3).map((promotion) => {
                    const offer = promotion.type === "percentage"
                      ? `${Number(promotion.value || 0)}% off`
                      : promotion.type === "fixed"
                        ? `${formatCad(promotion.value)} off`
                        : "Free shipping";
                    return (
                      <div key={promotion.code} className="border border-[#e11d2e]/25 bg-[#e11d2e]/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-black/70">
                        <span className="font-black text-[#b51222]">{offer}</span> with code <span className="font-black text-black">{promotion.code}</span>
                        {Number(promotion.minPurchase || 0) > 0 && <span className="text-black/45"> · Min {formatCad(promotion.minPurchase)}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-black/52">'''
text = replace_once(text, price_anchor, price_repl, "product detail promotion banner")
write(path, text)


# 6) Admin Discounts list: show exactly which product/collection is targeted.
path = "src/components/admin/DiscountsModule.jsx"
text = read(path)
text = replace_once(
    text,
    '                    <Td className="capitalize">{discount.appliesTo.replaceAll("_", " ")}</Td>',
    '''                    <Td>
                      <div className="capitalize">{discount.appliesTo.replaceAll("_", " ")}</div>
                      {discount.appliesToId && <div className="mt-0.5 max-w-[260px] truncate text-[11px] text-[#777]">{discountTargetName(discount, references)}</div>}
                    </Td>''',
    "discount admin target display",
)
text = replace_once(
    text,
    'function offerText(discount) {',
    '''function discountTargetName(discount, references) {
  if (discount.appliesTo === "product") {
    return references.products.find((item) => item.id === discount.appliesToId)?.name || "Selected product";
  }
  if (discount.appliesTo === "collection") {
    return references.collections.find((item) => item.id === discount.appliesToId)?.name || "Selected collection";
  }
  return "All products";
}

function offerText(discount) {''',
    "discount admin target helper",
)
write(path, text)

print("Discount scope wiring patch applied successfully.")
