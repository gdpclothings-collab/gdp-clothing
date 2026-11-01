// Non-paid production checkout smoke helpers. No live order or PaymentIntent writes.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safePrice(variant, product) {
  const variantPrice = Number(variant?.price);
  const basePrice = Number(product?.price);
  const selected = Number.isFinite(variantPrice) && variantPrice > 0 ? variantPrice : basePrice;
  return Number.isFinite(selected) && selected >= 0.5 ? Math.round(selected * 100) / 100 : 0;
}

export function selectSafeCheckoutSmokeItem(products) {
  if (!Array.isArray(products)) throw new Error("Public product catalog returned no usable array.");
  const candidates = [];
  for (const product of products) {
    if (!UUID_RE.test(String(product?.id || "")) || product.status !== "active" ||
        product.selling_mode === "service" ||
        (Array.isArray(product.tags) && product.tags.some((tag) => String(tag).toLowerCase() === "custom-studio-only"))) continue;
    for (const variant of Array.isArray(product.product_variants) ? product.product_variants : []) {
      if (!UUID_RE.test(String(variant?.id || "")) || variant.active === false) continue;
      if (product.track_inventory === true && Number(variant.stock || 0) <= 0 && product.sell_when_out_of_stock !== true) continue;
      const price = safePrice(variant, product);
      if (!price) continue;
      candidates.push({ product, variant, price });
    }
  }
  candidates.sort((a, b) => {
    const rank = (item) => item.product.selling_mode === "ready_to_wear" ? 0 : 1;
    return rank(a) - rank(b) ||
      String(a.product.id).localeCompare(String(b.product.id)) ||
      String(a.variant.id).localeCompare(String(b.variant.id));
  });
  if (!candidates.length) throw new Error("No active, priced and available public catalog variant for the non-paid smoke.");
  const { product, variant, price } = candidates[0];
  return {
    productId: product.id,
    variantId: variant.id,
    key: "gdp-smoke-" + product.id + "-" + variant.id,
    name: String(product.name || "GDP Checkout Smoke Item"),
    price,
    quantity: 1,
    size: String(variant.size || "M"),
    color: String(variant.color || "Black"),
    image: Array.isArray(product.images) && typeof product.images[0] === "string"
      ? product.images[0] : "/images/gdp-tshirt.svg",
  };
}

export function checkoutSmokeRequestGuard({ url, method, action }) {
  const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
  const verb = String(method || "").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(verb)) return { blocked: false, allowedReadOnly: true };
  const functionPath = path.startsWith("/functions/v1/");
  const allowedReadOnly = verb === "POST" && (
    (path === "/functions/v1/checkout" && action === "checkoutConfig") ||
    (path === "/functions/v1/payment-session" && action === "bootstrap")
  );
  // Supabase functions default to denied for writes. Only these two verified
  // read-only POST actions may pass. In particular, checkout-gateway tracking,
  // createOrder, and payment-session createIntent must NEVER reach production.
  if (functionPath) return { blocked: !allowedReadOnly, allowedReadOnly };
  if (path.startsWith("/rest/v1/")) return { blocked: true, allowedReadOnly: false };
  return { blocked: false, allowedReadOnly: false };
}

export function assertSaskatchewanPstOnlyQuote(quote, shippingMethod, merchandiseAmount) {
  if (quote?.configured !== true) throw new Error("Authoritative checkout tax quote is unavailable.");
  if (quote.regionCode !== "SK" || quote.shippingMethod !== shippingMethod) {
    throw new Error("Checkout quote has an incorrect Saskatchewan jurisdiction or shipping method.");
  }
  const components = quote.taxBreakdown?.components;
  if (!Array.isArray(components) || components.length !== 1 ||
      components[0]?.code !== "PST" || Number(components[0]?.rate) !== 0.06 ||
      quote.taxBreakdown?.policy !== "gst_small_supplier_pst_only") {
    throw new Error("Checkout tax quote must contain only registered Saskatchewan PST at 6%.");
  }
  if (Number(quote.gstHstTax) !== 0) throw new Error("Unexpected GST/HST collected in PST-only checkout.");
  const pst = Number(quote.pstTax);
  const totalTax = Number(quote.tax);
  const expectedPst = Math.round(Number(merchandiseAmount) * 6) / 100;
  if (!Number.isFinite(pst) || Math.abs(pst - expectedPst) > 0.009 ||
      !Number.isFinite(totalTax) || Math.abs(totalTax - pst) > 0.009) {
    throw new Error("Authoritative PST amount does not match the taxable merchandise.");
  }
  if (shippingMethod === "pickup" && Number(quote.shipping) !== 0) {
    throw new Error("Local pickup must have zero shipping charge.");
  }
  if (!Number.isFinite(Number(quote.shipping)) || Number(quote.shipping) < 0) {
    throw new Error("Invalid authoritative shipping quote.");
  }
  return true;
}
