# GDP Clothing WELCOME10 Guest Integration QA — 2026-11-11

**Release recommendation: BLOCKED for enabling guest OTP.** This PR is **QA ONLY / DRAFT**. No new external services, live payments, real email sends, production database writes, Edge Function deployment, or guest-OTP activation.

## Evidence and status

| Gate | Result | Evidence / scope |
| --- | --- | --- |
| WELCOME10 Node test suite | PASS | GitHub Actions 75/75, 0 failures; `welcome10-unit` job on QA commit `e18f244` |
| In-memory new and returning guest OTP | PASS (MOCK) | Executes real `src/lib/welcomeGuestEmail.js` using an isolated fake Auth transport; checks six-digit code, wrong/reused/expired code, server email match, JWT expiry, browser-memory-only proof, changed email, release default OFF |
| Synthetic signed Stripe webhook over HTTP | PASS (MOCK) | Localhost receiver invokes actual checked-out signature-verification and WELCOME10 business helpers; valid/invalid HMAC, mode/order/session binding, event ordering, delivery replay, late delivery, failure/reconciliation, partial/full refund using fake state |
| Disposable PostgreSQL migration/concurrency | PASS | Existing GitHub Actions `welcome10-postgres` on PostgreSQL 17; no production rows |
| Checkout browser (desktop 1440×900, mobile 390×844) | PASS (MOCK) | Real checkout page served locally by Vite. Browser intercepts all external calls, reports WELCOME10 guest release OFF, confirms account-only instruction and no OTP sends |
| CodeQL, secrets, checkout, PST and quality | PASS at latest successful CI steps | Existing project CI + previous production safeguards; latest branch check verdict should be reconfirmed at review time |
| Real Supabase Auth numeric email delivery | BLOCKED | No isolated Supabase Auth + test mailbox verified; mock codes do not prove real email template or quota behavior |
| Full guest OTP browser path enabled end to end | BLOCKED | Desktop/mobile tested release-OFF; enabled flow mocked in Node, not through isolated real Auth browser E2E |
| Real Stripe test-mode signed delivery / refund | BLOCKED | Connected Stripe test-mode account exists, but no independently verified isolated event receiver/backend/database; **no Stripe API writes or events sent** |
| Checkout + webhook + reconciliation across isolated Supabase Edge Functions | BLOCKED | No isolated Supabase branch/project; production checkout/gateway cannot be used for tests |
| Guest OTP rollout/deploy | NOT AUTHORIZED | `GDP_WELCOME10_GUEST_OTP_ENABLED` must remain unset/OFF; existing verified-account WELCOME10 active promotion is separate |

## Policy/security

- All fake identities use example.test, fabricated UUIDs and synthetic tokens; no customer records or payment instruments.
- No Auth email leaves the harness. Browser blocks non-local network requests; server uses HTTP on 127.0.0.1.
- Stripe signed events are produced by a test HMAC key, **not by Stripe**. The synthetic HTTP receiver is NOT the actual deployed Edge handler and models DB side effects; this is not proof of end-to-end Stripe integration.
- Existing PostgreSQL tests exercise actual SQL logic separately.
- Maintain existing Stripe Live Mode, Saskatchewan PST 6%, GST 0%, CAD $15 WELCOME10 maximum, first-order history checks, DTF exclusion, MFA, 300-DPI print quality and customer orders.
- Retain the existing WELCOME10 live campaign as-is; this QA does not change its `active` flag or enable the separate guest OTP path.

## Remaining real integration prerequisites

1. Stand up a **genuinely isolated local** Supabase stack with Auth, a test mailbox (Mailpit), disposable orders and the checkout/getUser code; verify numeric `{{ .Token }}`, new/returning, wrong/expired/replayed codes, browser and mobile behavior. Supabase's documented local Auth sends emails only to Mailpit, not to real customers.
2. Have a separate Stripe sandbox destination and a completely isolated checkout/webhook/database; test genuine Stripe-signed delivery, reconciliation on failed redemption, async failure/refunds, and replay. Use no live keys or webhook target.
3. Validate exact client+gateway+Edge-function parity, rollback, PST/GST and current production settings; request separate guest activation approval.
4. Do **not** create a billable Supabase project or branch or alter production Auth/SMTP settings under this QA authorization.

Status: **Code mock QA PASS; real external integration BLOCKED; guest feature stays OFF.**
