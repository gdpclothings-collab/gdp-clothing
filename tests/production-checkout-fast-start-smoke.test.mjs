import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  selectSafeCheckoutSmokeItem,
  checkoutSmokeRequestGuard,
  assertSaskatchewanPstOnlyQuote,
} from "../scripts/production-checkout-smoke-helpers.mjs";

const productId = "11111111-1111-4111-8111-111111111111";
const variantId = "22222222-2222-4222-8222-222222222222";
const liveVariant = { id: variantId, active: true, stock: 3, price: 39.99, size: "M", color: "Black" };
const readyProduct = {
  id: productId, status: "active", selling_mode: "ready_to_wear",
  track_inventory: true, sell_when_out_of_stock: false, name: "Ready-to-wear tee",
  price: 39.99, images: ["/images/tee.png"], product_variants: [liveVariant],
};

const quote = {
  configured: true, regionCode: "SK", shippingMethod: "standard",
  shipping: 12.99, tax: 2.40, pstTax: 2.40, gstHstTax: 0,
  taxBreakdown: {
    policy: "gst_small_supplier_pst_only",
    components: [{ code: "PST", bucket: "pst", rate: 0.06, amount: 2.40 }],
  },
};

test("uses a live public catalog variant, never synthetic or unavailable product IDs", () => {
  const item = selectSafeCheckoutSmokeItem([
    { ...readyProduct, id: "wiring-fallback-product" },
    { ...readyProduct, id: "33333333-3333-4333-8333-333333333333", product_variants: [{ ...liveVariant, stock: 0 }] },
    readyProduct,
  ]);
  assert.equal(item.productId, productId);
  assert.equal(item.variantId, variantId);
  assert.equal(item.price, 39.99);
  assert.equal(item.quantity, 1);
  assert.equal(item.color, "Black");
  assert.throws(() => selectSafeCheckoutSmokeItem([{ ...readyProduct, id: "wiring-fallback-product" }]), /No active/);
  assert.throws(() => selectSafeCheckoutSmokeItem(null), /catalog/);
});

test("prefers ready-to-wear, rejects service and hidden studio-only products", () => {
  const custom = { ...readyProduct, id: "44444444-4444-4444-8444-444444444444", selling_mode: "custom" };
  const service = { ...readyProduct, id: "55555555-5555-4555-8555-555555555555", selling_mode: "service" };
  const hidden = { ...readyProduct, id: "66666666-6666-4666-8666-666666666666", tags: ["custom-studio-only"] };
  assert.equal(selectSafeCheckoutSmokeItem([custom, service, hidden, readyProduct]).productId, productId);
  assert.equal(selectSafeCheckoutSmokeItem([custom]).productId, custom.id);
});

test("request guard allows only two verified read-only POST actions", () => {
  const call = (path, action, method = "POST") => checkoutSmokeRequestGuard({
    url: "https://example.supabase.co" + path, method, action,
  });
  assert.equal(call("/rest/v1/products?select=id", null, "GET").blocked, false);
  assert.deepEqual(call("/functions/v1/checkout", "checkoutConfig"), { blocked: false, allowedReadOnly: true });
  assert.deepEqual(call("/functions/v1/payment-session", "bootstrap"), { blocked: false, allowedReadOnly: true });
  for (const [path, action] of [
    ["/functions/v1/checkout", "createOrder"],
    ["/functions/v1/checkout-gateway", "trackCheckout"],
    ["/functions/v1/checkout-gateway", "createOrder"],
    ["/functions/v1/payment-session", "createIntent"],
    ["/functions/v1/unknown", null],
    ["/rest/v1/orders", null],
    ["/rest/v1/rpc/create_order", null],
  ]) {
    assert.equal(call(path, action).blocked, true, path + " " + action);
  }
  assert.equal(call("/functions/v1/checkout", "checkoutConfig", "PATCH").blocked, true);
});

test("server-verified standard shipping and pickup collect 6% PST and zero GST", () => {
  assert.equal(assertSaskatchewanPstOnlyQuote(quote, "standard", 39.99), true);
  assert.equal(assertSaskatchewanPstOnlyQuote({ ...quote, shippingMethod: "pickup", shipping: 0 }, "pickup", 39.99), true);
  assert.throws(() => assertSaskatchewanPstOnlyQuote({ ...quote, configured: false }, "standard", 39.99), /unavailable/);
  assert.throws(() => assertSaskatchewanPstOnlyQuote({ ...quote, gstHstTax: 2 }, "standard", 39.99), /GST/);
  assert.throws(() => assertSaskatchewanPstOnlyQuote({ ...quote, pstTax: 3 }, "standard", 39.99), /PST/);
  assert.throws(() => assertSaskatchewanPstOnlyQuote({ ...quote, regionCode: "ON" }, "standard", 39.99), /jurisdiction/);
  assert.throws(() => assertSaskatchewanPstOnlyQuote({ ...quote, shippingMethod: "pickup", shipping: 12.99 }, "pickup", 39.99), /pickup/);
  assert.throws(() => assertSaskatchewanPstOnlyQuote({ ...quote, taxBreakdown: { policy: "registered_collection", components: [] } }, "standard", 39.99), /only registered/);
});

test("production smoke uses real catalog GET, waits for quotes and blocks mutations", () => {
  const smoke = readFileSync(new URL("../scripts/production-checkout-fast-start-smoke.mjs", import.meta.url), "utf8");
  assert.match(smoke, /catalogResponsePromise = page\.waitForResponse/);
  assert.match(smoke, /checkoutSmokeRequestGuard\(\{ url, method, action \}\)/);
  assert.match(smoke, /waitForVerifiedQuote\("standard"/);
  assert.match(smoke, /waitForVerifiedQuote\("pickup"/);
  assert.match(smoke, /assertSaskatchewanPstOnlyQuote\(payload, shippingMethod, cartItem\.price\)/);
  assert.doesNotMatch(smoke, /wiring-fallback-product/);
  assert.doesNotMatch(smoke, /did not enable after required checkout fields/);
});
