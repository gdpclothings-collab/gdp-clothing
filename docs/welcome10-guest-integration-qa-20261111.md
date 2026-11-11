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
| Real local Supabase Auth + Mailpit numeric email delivery | PASS (REAL LOCAL) | GitHub Actions run [43119966702](https://github.com/gdpclothings-collab/gdp-clothing/actions/runs/43119966702) with pinned CLI v2.122.1. Actual GoTrue Auth produced rendered numeric OTP emails into local Mailpit. Verified new/returning user, wrong/reused/expired codes, email match, distinct browser-memory proof and server Auth getUser JWT validation. Cleanup passed. This is LOCAL only, not hosted-template parity. |
| Full guest OTP browser path enabled end to end | BLOCKED | Desktop/mobile tested release-OFF; enabled flow mocked in Node, not through isolated real Auth browser E2E |
| Real Stripe-origin test-mode signed delivery / refund | BLOCKED | Connected Stripe test-mode account exists. A localhost-only receiver is prepared at scripts/qa/welcome10-stripe-cli-receiver.mjs, but it has NOT received genuine Stripe CLI forwarded events. No authenticated CLI signing secret was accessible; no Stripe API writes or events sent, no real charges. |
| Checkout + webhook + reconciliation across isolated Supabase Edge Functions | BLOCKED | No isolated Supabase branch/project; production checkout/gateway cannot be used for tests |
| Guest OTP rollout/deploy | NOT AUTHORIZED | `GDP_WELCOME10_GUEST_OTP_ENABLED` must remain unset/OFF; existing verified-account WELCOME10 active promotion is separate |

## Policy/security

- All fake identities use example.test, fabricated UUIDs and synthetic tokens; no customer records or payment instruments.
- Local Auth did send rendered 6-digit codes into LOCAL Mailpit; no external mailbox received an email. Browser tests block external requests and run on localhost. Auth/DB fixtures are disposable.
- Stripe signed events are produced by a test HMAC key, **not by Stripe**. The synthetic HTTP receiver is NOT the actual deployed Edge handler and models DB side effects; this is not proof of end-to-end Stripe integration.
- Existing PostgreSQL tests exercise actual SQL logic separately.
- Maintain existing Stripe Live Mode, Saskatchewan PST 6%, GST 0%, CAD $15 WELCOME10 maximum, first-order history checks, DTF exclusion, MFA, 300-DPI print quality and customer orders.
- Retain the existing WELCOME10 live campaign as-is; this QA does not change its `active` flag or enable the separate guest OTP path.

## Remaining real integration prerequisites

1. **COMPLETED (local Auth portion):** Disposable Supabase v2.122.1, GoTrue and Mailpit confirmed real rendered `{{ .Token }}` emails, new/returning identities, wrong/replayed/expired codes and validated JWT proof. **STILL BLOCKED:** full browser-enabled guest checkout + persisted order integration with this local Auth/DB; local CLI template success does not prove production template parity.
2. **STILL BLOCKED:** Run Stripe CLI test-mode signed event forwarding into the prepared localhost-only receiver with an isolated checkout/webhook/database; test genuine Stripe signatures, reconciliation, async failure/refunds and replay. Do NOT use live keys or the production webhook endpoint.
3. Validate exact client+gateway+Edge-function parity, rollback, PST/GST and current production settings; request separate guest activation approval.
4. Do **not** create a billable Supabase project or branch or alter production Auth/SMTP settings under this QA authorization.

Status: **75/75 synthetic WELCOME10 unit tests PASS; real LOCAL Auth + Mailpit PASS; real Stripe-origin signed delivery and integrated hosted parity BLOCKED; guest feature stays OFF.**

## Auth integration evidence (run 43119966702)

- Supabase CLI v2.122.1: local stack started. Mailpit endpoint: 127.0.0.1:54324.
- PASS: new email, rendered six-digit numeric OTP, wrong OTP rejection, exact-email getUser JWT identity.
- PASS: returning email uses same Auth user ID; reused OTP rejected, browser-memory-only proof.
- PASS: actual 60-second OTP expiry after 65 seconds; code rejected.
- PASS: local Docker stack stopped with --no-backup; all GitHub checks on commit 5e9da05 PASS.
- Test was confined to loopback, Mailpit and disposable email addresses under example.test. No secrets or codes retained in report.
