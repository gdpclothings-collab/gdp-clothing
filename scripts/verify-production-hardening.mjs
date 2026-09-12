import fs from "node:fs";
function text(path) { return fs.readFileSync(path, "utf8"); }
function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing hardening control: ${label}`);
}
const gateway = text("supabase/functions/checkout-gateway/index.ts");
const webhook = text("supabase/functions/stripe-webhook/index.ts");
const maintenance = text("supabase/functions/maintenance-access/index.ts");
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
if ((api.match(/functions\.invoke\("checkout-gateway"/g) || []).length < 2) throw new Error('Storefront is not wired to checkout gateway');
requireText(page, 'const trackedCheckout = await customerApi.trackCheckout(', 'synchronous checkout tracking');
requireText(headers, 'https://fonts.googleapis.com', 'Google Fonts CSP');
requireText(headers, 'https://static.cloudflareinsights.com', 'Cloudflare Insights CSP');
console.log('Production hardening controls verified.');
