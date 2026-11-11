# WELCOME10 verified guest checkout — release checklist

**Status: DRAFT, promotion OFF. Do not merge, deploy or activate without separate release approval.**

## Implementation

- Reuses the existing Supabase Auth email OTP transport with an isolated, memory-only client. A new email creates a passwordless Supabase Auth identity; the checkout UI discloses this. It does not set a GDP storefront login session or password, and the resulting order remains a guest order (`orders.user_id` null).
- Guest session proof is an ephemeral token sent over HTTPS in `x-gdp-welcome-guest-authorization` only for WELCOME10. It is never persisted to session/local storage, placed in order JSON or recorded in logs.
- The checkout backend calls Supabase Auth `getUser(token)` to verify the session, confirmed email and exact checkout-email match. Existing authenticated buyers retain the original account verification. Invalid/missing/mismatched proof fails closed.
- Checkout-gateway forwards the proof to checkout only for a WELCOME10 order. The existing database reservation and Stripe redemption RPCs remain unchanged, preserving prior paid-order checks, normalized email locking, webhook idempotency and the CAD $15 cap.
- This does not enable marketing consent, bypass quantity stacking, or alter PST, GST, shipping, prices, inventory or payment mode.

## Release blockers and required free QA

1. **Confirm the Supabase Auth email template actually sends a one-time numeric code.** Default Magic Link emails do not support the in-page OTP field unless the existing template includes `{{ .Token }}`. Do not modify production authentication templates without separate approval. Confirm quota/rate limits can remain within existing free allowance.
2. Rehearse new guest, returning guest, existing verified account and wrong-email OTP in a disposable or isolated environment. Test expired/replayed JWT, checkout-email changes, browser reload, guest order with `user_id=null`, previous paid orders, refunded history and two simultaneous checkouts using one verified identity.
3. Run `node --test tests/welcome10-*.test.mjs tests/checkout-gateway-email-alignment.test.mjs`, build/lint/typecheck, checkout gateway/Stripe/PST regression, and mobile/desktop UI tests.
4. Execute signed Stripe **test-mode** payment + replay/refund-webhook scenarios in an isolated environment only. Do not change production Stripe Live Mode, create a live order or incur a charge.
5. Confirm exact deployed checkout + checkout-gateway + storefront version parity and rollback, then independently verify the live campaign row remains `active=false`, first-order validation rejects, homepage popup stays hidden.
6. Request KYU's explicit final approval **after** all tests pass. Activation is a distinct step from code release.

## Known policy limit

Verification proves ownership of one mailbox, not a unique natural person. A buyer using a separate email alias could evade email-based first-order limits. Rate limiting and fraud review remain necessary; do not advertise a guarantee of one redemption per human.
