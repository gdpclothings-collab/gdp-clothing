# WELCOME10 verified guest checkout — release checklist

**Status: Guest OTP rollout DEFAULT-OFF. Existing verified-account WELCOME10 is ACTIVE in production as of the 2026-11-11 read-only check. Code merge is distinct from guest activation; no server flag enablement without separate approval.**

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
5. For a dormant code merge, confirm the existing live campaign `active=true` remains unchanged, storefront popup advertises account-only verification while guest flag is OFF, and unauthenticated guests cannot trigger OTP. Confirm deployed checkout + gateway parity and rollback before later activation.
6. Request KYU's explicit guest-OTP **activation approval** only after isolated end-to-end OTP and signed Stripe test-mode webhook tests pass. Code merge alone must not enable guest OTP.

## Known policy limit

Verification proves ownership of one mailbox, not a unique natural person. A buyer using a separate email alias could evade email-based first-order limits. Rate limiting and fraud review remain necessary; do not advertise a guarantee of one redemption per human.


## 2026-11-11 safe merge clarification — existing live discount vs guest OTP
- Read-only production observation: `public.discounts` has WELCOME10 `active=true`, percentage 10. **Do not modify** this existing promotion under guest feature work.
- The proposed guest OTP path is now **independently default-OFF**, behind an exact server-side `GDP_WELCOME10_GUEST_OTP_ENABLED=true` switch plus a reported API status field. Without the server flag, new guests are directed to sign in rather than generating an Auth email; existing verified account buyers remain eligible under their original conditions.
- This makes a code-only merge *potentially safe* while keeping the guest release off. It is **not** proof of live Stripe-signed webhook delivery or real end-to-end OTP, and it does **not** authorize toggling the server switch, modifying discounts, or updating production payment configuration.
- Complete isolated OTP and signed Stripe test-mode integration plus separate activation authorization before enabling the guest flag.

- Welcome popup copy now depends on the server-provided guest flag so account-only customers are not misled. Admin editing preserves an already-active WELCOME10 record while refusing a new activation of an inactive promotion.
