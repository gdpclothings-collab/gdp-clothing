const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function fallbackComponents(rule, regionCode) {
  const configured = Array.isArray(rule?.config?.components) ? rule.config.components : [];
  if (configured.length) return configured;

  if (regionCode === "SK") {
    return [
      { code: "GST", bucket: "gst_hst", rate: 0.05, tax_shipping: true },
      { code: "PST", bucket: "pst", rate: 0.06, tax_shipping: false },
    ];
  }

  const hstRegions = new Set(["NB", "NL", "NS", "ON", "PE"]);
  return [{
    code: hstRegions.has(regionCode) ? "HST" : "GST",
    bucket: "gst_hst",
    rate: Math.max(0, Number(rule?.rate || 0)),
    tax_shipping: rule?.tax_shipping !== false,
  }];
}

export function calculateTaxBreakdown(rule, regionCode, merchandiseAmount, shippingAmount) {
  const merchandise = Math.max(0, roundMoney(merchandiseAmount));
  const shipping = Math.max(0, roundMoney(shippingAmount));
  const components = fallbackComponents(rule, regionCode).map((row) => {
    const rate = Math.max(0, Number(row?.rate || 0));
    const taxShipping = row?.tax_shipping !== false;
    const taxableBase = roundMoney(merchandise + (taxShipping ? shipping : 0));
    return {
      code: String(row?.code || "Tax"),
      bucket: row?.bucket === "pst" ? "pst" : "gst_hst",
      rate,
      taxShipping,
      taxableBase,
      amount: roundMoney(taxableBase * rate),
    };
  });

  const gstHstTax = roundMoney(components.filter((row) => row.bucket === "gst_hst").reduce((sum, row) => sum + row.amount, 0));
  const pstTax = roundMoney(components.filter((row) => row.bucket === "pst").reduce((sum, row) => sum + row.amount, 0));
  const tax = roundMoney(gstHstTax + pstTax);
  const clientBase = roundMoney(merchandise + shipping);

  return {
    tax,
    gstHstTax,
    pstTax,
    components,
    // Existing checkout UI accepts one rate/base pair. This effective rate
    // preserves an exact total while the server stores the real components.
    effectiveRate: clientBase > 0 ? tax / clientBase : 0,
    clientTaxShipping: true,
  };
}
