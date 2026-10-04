const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function couponIsUsable(row, purchase = null) {
  if (!row || row.active !== true) return false;
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.ends_at && new Date(row.ends_at).getTime() < now) return false;
  if (row.usage_limit != null && Number(row.usage_count || 0) >= Number(row.usage_limit)) return false;
  if (purchase != null && row.min_purchase != null && Number(purchase) < Number(row.min_purchase)) return false;
  return true;
}

export function couponAmountForBase(coupon, eligibleSubtotal) {
  const base = Math.max(0, roundMoney(eligibleSubtotal));
  if (!coupon || base <= 0) return 0;
  if (coupon.type === "percentage") {
    const percent = Math.min(100, Math.max(0, Number(coupon.value || 0)));
    return Math.min(base, roundMoney(base * (percent / 100)));
  }
  if (coupon.type === "fixed") {
    return Math.min(base, Math.max(0, roundMoney(Number(coupon.value || 0))));
  }
  return 0;
}

export function publicPromotion(row) {
  return {
    code: String(row?.code || ""),
    type: String(row?.type || ""),
    value: Number(row?.value || 0),
    minPurchase: row?.min_purchase == null ? null : Number(row.min_purchase),
    appliesTo: String(row?.applies_to || "all"),
    startsAt: row?.starts_at || null,
    endsAt: row?.ends_at || null,
  };
}
