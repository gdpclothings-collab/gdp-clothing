// GDP-TAX-REGISTRATION-SAFEGUARD-V1
// Pure checkout tax safety helpers. Never interpret a missing registration as permission to collect tax.
export const TAX_REVIEW_MESSAGE = "Checkout is temporarily unavailable while business tax registration is verified. No charge was attempted.";

export class TaxConfigurationReviewError extends Error {
  constructor(message = TAX_REVIEW_MESSAGE) {
    super(message);
    this.name = "TaxConfigurationReviewError";
  }
}

const cents = (amount) => Math.round(Number(amount) * 100);

export function checkoutTaxProvince(shippingMethod, destinationProvinceCode) {
  // GDP local pickup transfers the garment to the buyer in Saskatoon, Saskatchewan.
  return shippingMethod === "pickup" ? "SK" : destinationProvinceCode;
}

export function taxableMerchandiseAfterCoupon(lines, couponAmount = 0, eligibleProductIds = null) {
  if (!Array.isArray(lines) || !lines.length) throw new TaxConfigurationReviewError();
  const normalized = lines.map((line) => {
    if (typeof line?.taxable !== "boolean") throw new TaxConfigurationReviewError();
    const value = cents(line.amount);
    if (!Number.isSafeInteger(value) || value < 0) throw new TaxConfigurationReviewError();
    return { productId: String(line.productId || ""), taxable: line.taxable, value };
  });
  const coupon = cents(couponAmount);
  if (!Number.isSafeInteger(coupon) || coupon < 0) throw new TaxConfigurationReviewError();
  const eligible = normalized.map((line) => eligibleProductIds === null || eligibleProductIds.has(line.productId));
  const eligibleTotal = normalized.reduce((sum, line, i) => sum + (eligible[i] ? line.value : 0), 0);
  if (coupon > eligibleTotal) throw new TaxConfigurationReviewError();

  let left = coupon;
  let remainingBase = eligibleTotal;
  const after = normalized.map((line, i) => {
    let deducted = 0;
    if (eligible[i] && remainingBase > 0) {
      deducted = Math.min(line.value, Math.floor(left * line.value / remainingBase));
      // The final eligible line receives any remaining fractional cents.
      if (!normalized.slice(i + 1).some((later, offset) => eligible[i + offset + 1] && later.value > 0)) {
        deducted = left;
      }
      left -= deducted;
      remainingBase -= line.value;
    }
    return { ...line, value: line.value - deducted };
  });
  if (left !== 0 || after.some((line) => line.value < 0)) throw new TaxConfigurationReviewError();
  return {
    merchandiseAmount: after.reduce((sum, line) => sum + line.value, 0) / 100,
    taxableAmount: after.reduce((sum, line) => sum + (line.taxable ? line.value : 0), 0) / 100,
    hasNonTaxable: after.some((line) => !line.taxable && line.value > 0),
  };
}

export function assertTaxRegistration(rows, components, now = new Date()) {
  if (!Array.isArray(rows) || !Array.isArray(components)) throw new TaxConfigurationReviewError();
  const registrations = new Map(rows.map((row) => [String(row.tax_type), row]));
  const day = new Date(now).toISOString().slice(0, 10);
  for (const component of components) {
    if (Number(component.rate || 0) <= 0 || Number(component.taxableBase || 0) <= 0) continue;
    const type = component.bucket === "pst" ? "pst" : "gst_hst";
    const registration = registrations.get(type);
    const date = String(registration?.effective_from || "");
    if (registration?.registered !== true ||
        !String(registration?.account_number || "").trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        date > day ||
        !Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
        new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date) {
      throw new TaxConfigurationReviewError();
    }
  }
  return true;
}

// Explicitly reviewed, time-limited non-collection for a GST/HST small supplier.
// The server must never infer this policy solely from registered=false.
export function applyCheckoutTaxPolicy({
  breakdown, registrations, province, merchandiseAmount, shippingAmount,
  policy = {}, now = new Date(),
}) {
  if (!breakdown || !Array.isArray(breakdown.components) || !Array.isArray(registrations)) {
    throw new TaxConfigurationReviewError();
  }
  const mode = String(policy.mode || "").trim();
  if (!mode) {
    assertTaxRegistration(registrations, breakdown.components, now);
    return { ...breakdown, policy: "registered_collection" };
  }
  if (mode !== "sk_pst_only_small_supplier" || province !== "SK") {
    throw new TaxConfigurationReviewError();
  }

  const calendarDay = (value) => {
    const date = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TaxConfigurationReviewError();
    const parsed = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new TaxConfigurationReviewError();
    }
    return parsed;
  };
  const reviewed = calendarDay(policy.reviewedOn);
  const expires = calendarDay(policy.expiresOn);
  const today = calendarDay(new Date(now).toISOString().slice(0, 10));
  if (reviewed > today || expires < today || expires < reviewed ||
      expires.getTime() - reviewed.getTime() > 93 * 86400000) {
    throw new TaxConfigurationReviewError();
  }

  const gstRows = registrations.filter((row) => row?.tax_type === "gst_hst");
  const pstRows = registrations.filter((row) => row?.tax_type === "pst");
  if (gstRows.length !== 1 || pstRows.length !== 1 ||
      gstRows[0].registered !== false ||
      String(gstRows[0].account_number || "").trim()) {
    throw new TaxConfigurationReviewError();
  }
  const pst = breakdown.components.filter((component) => component.bucket === "pst");
  const gst = breakdown.components.filter((component) => component.bucket === "gst_hst");
  if (pst.length !== 1 || gst.length !== 1 ||
      pst[0].code !== "PST" || Number(pst[0].rate) !== 0.06 ||
      Number(gst[0].rate) !== 0.05 ||
      gst[0].code !== "GST" || breakdown.components.length !== 2) {
    throw new TaxConfigurationReviewError();
  }
  // The PST licence, account number and effective date remain mandatory.
  assertTaxRegistration(registrations, [{ ...pst[0], taxableBase: Math.max(1, Number(pst[0].taxableBase || 0)) }], now);

  const pstTax = Math.round(Number(pst[0].amount) * 100) / 100;
  const base = Math.round((Number(merchandiseAmount) + Number(shippingAmount)) * 100) / 100;
  if (!Number.isFinite(pstTax) || pstTax < 0 || !Number.isFinite(base) || base < 0) {
    throw new TaxConfigurationReviewError();
  }
  return {
    ...breakdown,
    components: pst,
    tax: pstTax,
    gstHstTax: 0,
    pstTax,
    effectiveRate: base > 0 ? pstTax / base : 0,
    taxName: "Saskatchewan PST (6%)",
    policy: "gst_small_supplier_pst_only",
  };
}
