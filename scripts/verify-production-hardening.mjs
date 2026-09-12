import fs from "node:fs";
function text(path) { return fs.readFileSync(path, "utf8"); }
function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing hardening control: ${label}`);
}
const checkout = text("supabase/functions/checkout/index.ts");
const webhook = text("supabase/functions/stripe-webhook/index.ts");
const maintenance = text("supabase/functions/maintenance-access/index.ts");
const page = text("src/pages/Checkout.jsx");
const headers = text("public/_headers");
requireText(checkout, 'consumePublicRateLimit(service, ipRateKey, 20, 600)', 'create-order IP rate limit');
requireText(checkout, 'consumePublicRateLimit(service, emailRateKey, 8, 600)', 'create-order email rate limit');
requireText(checkout, 'consumePublicRateLimit(service, trackRateKey, 300, 3600)', 'checkout tracking rate limit');
requireText(checkout, 'service.rpc(\n      "claim_checkout_session"', 'atomic checkout claim');
requireText(checkout, '"Idempotency-Key": `gdp-checkout-${checkoutSessionToken}`', 'Stripe idempotency key');
requireText(checkout, 'stripe_client_secret: stripeData.client_secret', 'persisted Stripe client secret');
if (checkout.includes('https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent')) throw new Error('Replay path still re-fetches Stripe Checkout Session');
requireText(webhook, 'stripe_client_secret: null', 'post-payment checkout secret cleanup');
if ((checkout.match(/releaseCheckoutSessionClaim\(service, checkoutSessionToken\);\n\s*await releaseCheckoutSessionClaim/g) || []).length) {
  throw new Error('Duplicate checkout claim release detected');
}
requireText(webhook, 'event.type === "checkout.session.expired"', 'expired checkout cleanup');
requireText(webhook, 'event.type === "checkout.session.async_payment_failed"', 'async payment failure cleanup');
const failedBlock = webhook.split('event.type === "payment_intent.payment_failed"')[1]?.split('event.type === "charge.refunded"')[0] || '';
if (failedBlock.includes('releaseCheckoutReservations')) throw new Error('Retryable payment failure still releases reservations');
requireText(maintenance, 'p_limit: 10', 'maintenance password attempt limit');
requireText(page, 'const trackedCheckout = await customerApi.trackCheckout(', 'synchronous checkout tracking');
requireText(headers, 'https://fonts.googleapis.com', 'Google Fonts CSP');
requireText(headers, 'https://static.cloudflareinsights.com', 'Cloudflare Insights CSP');
console.log('Production hardening controls verified.');
