import fs from "node:fs";
function text(path) { return fs.readFileSync(path, "utf8"); }
function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing hardening control: ${label}`);
}
const gateway = text("supabase/functions/checkout-gateway/index.ts");
const checkout = text("supabase/functions/checkout/index.ts");
const webhook = text("supabase/functions/stripe-webhook/index.ts");
const maintenance = text("supabase/functions/maintenance-access/index.ts");
const paymentSession = text("supabase/functions/payment-session/index.ts");
const api = text("src/lib/customerApi.js");
const page = text("src/pages/Checkout.jsx");
const headers = text("public/_headers");
requireText(gateway, 'consumeRateLimit(service, await sha256Hex(`checkout:create:ip:${clientIp(req)}`), 20, 600)', 'create-order IP rate limit');
requireText(gateway, 'consumeRateLimit(service, await sha256Hex(`checkout:create:email:${customerEmail}`), 8, 600)', 'create-order email rate limit');
requireText(gateway, 'consumeRateLimit(service, rateKey, 300, 3600)', 'checkout tracking rate limit');
requireText(gateway, 'service.rpc("claim_checkout_session"', 'atomic checkout claim');
requireText(gateway, '/functions/v1/checkout', 'authoritative checkout forwarding');
requireText(gateway, 'stripe_client_secret: data.clientSecret || null', 'checkout replay client secret persistence');
requireText(webhook, 'event.type === "checkout.session.expired"', 'expired checkout cleanup');
requireText(webhook, 'event.type === "checkout.session.async_payment_failed"', 'async payment failure cleanup');
requireText(webhook, 'resetUnpaidCustomOrderState(service, orderId)', 'custom design rollback');
const failedBlock = webhook.split('event.type === "payment_intent.payment_failed"')[1]?.split('event.type === "charge.refunded"')[0] || '';
if (failedBlock.includes('releaseCheckoutReservations')) throw new Error('Retryable payment failure still releases reservations');
requireText(maintenance, 'p_limit: 10', 'maintenance password attempt limit');
requireText(paymentSession, 'consumeRateLimit(service, req, action)', 'payment-session IP rate limiting');
requireText(paymentSession, 'p_limit: normalizedAction === "createIntent" ? 30 : 120', 'payment-session action-specific limits');
requireText(paymentSession, 'AbortSignal.timeout(10_000)', 'Stripe payment-session request timeout');
requireText(checkout, 'enforceActionRateLimit(service, req, action, 20)', 'guest/DTF upload token rate limiting');
requireText(checkout, 'enforceActionRateLimit(service, req, action, 120)', 'guest preview signing rate limiting');
requireText(checkout, 'enforceActionRateLimit(service, req, action, 30)', 'guest design creation rate limiting');
if ((api.match(/functions\.invoke\("checkout-gateway"/g) || []).length < 2) throw new Error('Storefront is not wired to checkout gateway');
requireText(page, 'const trackedCheckout = await customerApi.trackCheckout(', 'synchronous checkout tracking');
requireText(headers, 'https://fonts.googleapis.com', 'Google Fonts CSP');
requireText(headers, 'https://static.cloudflareinsights.com', 'Cloudflare Insights CSP');

// Custom Studio locked-design order linkage. The cart may only reference a
// persisted design ID; checkout re-resolves the authoritative design server-side.
requireText(checkout, 'const customIds = [...new Set(cart.map((item: any) => String(item?.customDesignId || "")).filter((id: string) => uuidRe.test(id)))];', 'custom design ID collection from cart');
requireText(checkout, '.from("custom_designs")', 'authoritative custom design lookup');
requireText(checkout, 'const guestToken = String(cartItem?.guestDesignToken || "");', 'guest custom design token lookup');
requireText(checkout, 'session.token_hash === await sha256Hex(guestToken);', 'guest custom design token verification');
requireText(checkout, 'custom_design_id: design?.id || null,', 'order item custom design linkage');
requireText(checkout, 'image: design?.customer_mockup_path || product.images?.[0] || null,', 'order item approved custom mockup');
requireText(checkout, 'converted_order_id: order.id,', 'guest design checkout reservation');
requireText(checkout, '.update({ order_id: order.id, status: "ordered"', 'authenticated custom design order association');
requireText(checkout, 'await releaseGuestDesignClaims(service, order.id);', 'guest design claim rollback on checkout failure');

// Stripe is the authority for completing a paid custom-design transition.
requireText(webhook, '.select("is_custom,custom_design_id")', 'paid order custom design lookup');
requireText(webhook, 'design.render_status === "locked"', 'locked render requirement before production queue');
requireText(webhook, 'design.customer_approved_at', 'customer approval requirement before production queue');
requireText(webhook, '/^[0-9a-f]{64}$/.test(String(design.locked_hash || ""))', 'locked hash requirement before production queue');
requireText(webhook, 'Object.keys(design.production_files).length > 0', 'production file requirement before production queue');
requireText(webhook, '.eq("converted_order_id", orderId)', 'guest design reservation ownership check');
requireText(webhook, '.is("converted_at", null)', 'guest design single-conversion guard');
requireText(webhook, '.update({ order_id: orderId, status: "ordered" })', 'guest design finalization after verified payment');
requireText(webhook, '.update({ status: "in_production" })', 'paid locked design production transition');

console.log('Production hardening controls verified.');
