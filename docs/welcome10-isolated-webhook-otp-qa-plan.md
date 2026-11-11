# WELCOME10 — isolated signed-webhook and guest-OTP QA preparation

**Status: QA ONLY / DRAFT / NO PRODUCTION RELEASE.** This document and accompanying test do not authorize merging, deployments, payment creation, OTP sends, Stripe mode changes, or coupon activation/deactivation.

## Verified starting point (2026-11-11)
- Existing local PostgreSQL V4 synthetic database suite reported PASS, including concurrent reservations/redemptions and replay/idempotency.
- New isolated branch starts from PR #602 head (2840cbf3); PR #602 is still draft with a merge conflict against main.
- Read-only production Supabase query confirmed public.discounts WELCOME10 currently **active=true**, percentage=10. This contradicts the original PR #602 checklist's expectation that the campaign is OFF. **Do not flip it here.** Resolve the difference between the existing live WELCOME10 discount and the proposed *guest OTP* feature before release.
- No isolated hosted Supabase/Stripe checkout environment with safely separated database, Auth users, payment keys, and webhook destination has been certified.

## Gate A — no-network signed webhook / guest identity tests
Run in a checkout of this QA branch or its eventual review PR:

    node --test tests/welcome10-isolated-signed-guest-offline.test.mjs

This test:
1. Executes the actual checked-out webhook's HMAC verifier functions with a throwaway fixture signing secret and synthetic events.
2. Confirms valid signature; rejects wrong secret, edited payload, missing/bad signature and stale/future timestamp.
3. Checks the existing verified payment-binding helper: persisted order ID, Checkout Session, intent and test/live mode must all match.
4. Checks already-paid replay binding; database once-only redemption was tested separately, not proven by signature checks alone.
5. Checks the guest-identity helper with mocked Supabase Auth getUser: verified matching email accepted; mismatch, expired proof and unconfirmed user rejected.
6. Guards source ordering so the privileged service-role client is created only after signature verification.

These tests have **no network calls, no real Stripe signed delivery, no Auth emails and no persistent database writes**. They are necessary but insufficient for integration release.

## Gate B — real guest OTP integration (BLOCKED until isolated environment exists)
- Use *only* an isolated test Auth environment with disposable email inboxes and quota confirmation. Do not send bulk tests from production Auth or edit the production template.
- Verify numeric code transport (the Magic Link/OTP template must include the six-digit variable {{ .Token }}), new vs existing users, incorrect code, expired token, token reuse, changed checkout email, browser reload and fully cleared ephemeral proof.
- For an anonymous storefront guest: order.user_id remains NULL; independently verify the Supabase Auth token server-side and exact checkout email match; test prior paid/refunded identity and concurrent first-order reservation.
- Prevent customer data from being copied to the test environment. Check that no test JWT or signing secret is logged.

## Gate C — actual Stripe sandbox signed delivery (BLOCKED until isolated environment exists)
- Use Stripe's **sandbox/test-mode** destination, keys and signing secret with an isolated checkout gateway, webhook function and disposable DB; never the production webhook or live Stripe keys.
- Verify real Stripe-Signature delivery against raw request bytes, correct Stripe mode, persisted Checkout Session and payment intent.
- Test success, duplicate/replay, webhook ordering (PaymentIntent before Checkout Session), paid-before-expiry but delayed webhook, invalid signatures and altered metadata, payment failure, refund/reconciliation and interrupted redemption.
- For each real test-mode checkout confirm: exactly one paid order, one consumed hold, one redemption, one usage increment, correct Saskatchewan PST 6%, GST 0%, WELCOME10 max CAD $15, DTF excluded, no price/payment mode change.
- Confirm reconciliation queue records failures and does not silently swallow them. Note: synthetic Stripe CLI trigger events may not reference an actual locally persisted order and therefore **cannot by themselves prove end-to-end checkout**.

## Gate D — merge/release clearance (BLOCKED)
- Resolve PR #602 merge conflicts in a separate reviewed change.
- Confirm production discount active state and which existing offers should remain available; request distinct approval before changing it.
- Run GitHub Actions, security/CodeQL, mobile/desktop UI, checkout, tax, mockup and 300-DPI regression.
- Require separate approval before merge, deployment, activation or any production payment-mode change.

## Safety and evidence
- Do not commit or paste Stripe secrets, service-role keys, passwords, tokens, customer emails, log exports or production records.
- All QA fixture identifiers are fake. A synthetic locally HMAC-signed event is **not** a real Stripe-delivered test-mode webhook.
- Report each gate PASS/BLOCKED/FAIL and preserve CI logs. Stop if any test points at the production Supabase project or live Stripe endpoint.
- No additional paid services or branches with unconfirmed compute charges.
