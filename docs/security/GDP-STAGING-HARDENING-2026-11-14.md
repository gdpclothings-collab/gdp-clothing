# GDP Clothing — Staging Security Hardening (2026-11-14)

## Release status
**BLOCKED for production merge/deployment.** Work was authorized for an isolated GitHub branch only. No production database changes, payment attempts, Stripe mutations, live infrastructure changes, merges, or deployments were made.

- Branch: `security/gdp-staging-hardening-20261114`
- Base: `main` at `eb06e187a3ac607ffb029cfa0feb81956c22bbbd`
- No new paid services or Supabase development branches

## Staged source changes
1. `public/_headers`: add `script-src-attr 'none'` to reject inline HTML event handlers, `manifest-src 'self'` to restrict web-app manifests, and `X-Permitted-Cross-Domain-Policies: none`.
2. `scripts/verify-security-headers.mjs`: dependency-free header regression checks preserving critical Stripe, Supabase, React and fonts origin allowances.
3. `package.json`: add `npm run test:security-headers`.
4. `.github/workflows/security-scan.yml`: include the header test in the existing browser-secret-guard job when the workflow is triggered.

**Intentionally not changed:** existing `script-src 'unsafe-inline'`, `style-src 'unsafe-inline'`, Stripe/Supabase secrets, deployed functions, database, taxes, promotion settings, uploads, and live checkout. Removing unsafe-inline requires actual browser/Stripe regression verification and is not safe as a blind change.

## Evidence and test results
| Check | Status | Evidence / limit |
| --- | --- | --- |
| GitHub isolated branch | PASS | Created from `main`; only branch commits |
| Existing `main` protection | WARNING | GitHub branch API reports `protected: false`; no settings changes allowed in scope |
| Security-header assertions | PASS (isolated V8 harness) | Executed staged `scripts/verify-security-headers.mjs` against staged `public/_headers` and `index.html` contents with standard-assert/file-read adapters |
| Payment-confirmation regression | PASS (isolated V8 harness) | Executed `scripts/verify-payment-confirmation-authority.mjs` assertions using seven repository source files; no external calls |
| PST-only checkout safeguard | PASS (isolated V8 harness) | Executed `scripts/verify-gdp-pst-only-checkout-safeguard-v1.mjs` pure functions and source assertions; no real quotes or charges |
| WELCOME10 policy and payment-binding | PASS (isolated V8 harness) | Ran 19 actual source-based unit cases from two test files, all passed |
| Supabase production health | PASS | Connected project `ACTIVE_HEALTHY` |
| Supabase table RLS coverage | PASS (configuration) | 124/124 `public` and 10/10 `storage` ordinary tables have RLS |
| Supabase security advisor | WARNING | 8 RLS-without-policy informational findings, which may be intentional backend-only tables |
| Customer artwork buckets | PASS (configuration) | `customer-uploads`, `design-proofs`, `dtf-artwork`, `artwork-production` private; `product-images` intentionally public |
| Payment configuration | PASS (database only) | `store_settings.payment_mode=live` |
| Stripe live account capabilities, Radar, PCI, signed events | BLOCKED | Linked Stripe tool grants test-mode access only |
| Browser checkout and Cloudflare response headers | NOT VERIFIED | No live browser automation / response-header inspection completed |
| Full Node/npm build, lint, typecheck and CI run | NOT RUN | Not run in this environment; staging branch is not auto-deployed |
| Guest OTP production environment switch | NOT VERIFIED | Source is fail-closed by default; deployed secret value not exposed |

## Saskatchewan tax / WELCOME10
- Current `tax_rules` for Saskatchewan lists a GST 5% + PST 6% baseline, while the deployed checkout contains an explicitly reviewed `sk_pst_only_small_supplier` server-side override.
- Finance registration metadata shows GST/HST **unregistered** and PST **registered**.
- Aggregate historical checkout records include one **failed** live order dated 2026-11-01 using `gst_small_supplier_pst_only` with GST zero, and one older **failed** live order dated 2026-10-27 using the earlier taxable configuration. Neither is a successful live charge.
- This supports PST-only calculation in one historical failed live checkout but **does not verify the current server-only policy secret or current successful live payment quote**.
- `WELCOME10` database row remains active with percentage 10. Guest OTP is guarded behind `GDP_WELCOME10_GUEST_OTP_ENABLED`; confirm deployed value remains OFF before release.

## Priority risk and decisions
1. **HIGH / BLOCKED:** Verify live checkout tax quote and server-only tax-policy review expiry without creating a charge. Do not modify tax rule directly to 6% without considering the override.
2. **HIGH / WARNING:** `main` branch is unprotected. Require an independently approved repository setting change to enforce reviews and passing checks.
3. **MEDIUM / BLOCKED:** Validate real signed Stripe webhook delivery, idempotency/replay handling, refunds and discount reconciliation in the sandbox. Source checks alone cannot establish end-to-end idempotence.
4. **MEDIUM / WARNING:** Source CSP still allows inline script/style due compatibility constraints. Test a stronger nonce/hash policy on a truly isolated preview before removing it.
5. **MEDIUM / NOT VERIFIED:** Verify privileged admin MFA enrollment, guest upload image validation, SVG/PDF handling, ownership isolation, live Cloudflare headers and dependency alerts.
6. **LOW / REVIEW:** Supabase advisor lists eight backend-only-looking RLS-no-policy tables. Avoid automatically granting policies; confirm they are intentionally server-only.

## Required release gate
- [ ] Confirm production environment settings: tax review policy valid, GST 0 / PST 6 customer quote, guest OTP OFF.
- [ ] Run clean `npm ci` / build / lint / typecheck / security-header and payment/tax/WELCOME10 regressions in trusted CI.
- [ ] Test mobile and desktop pages, login, password reset, Stripe Payment Element, custom studio, fonts and CSP console.
- [ ] Execute genuine Stripe-signed sandbox webhooks, including invalid signatures, duplicates, delayed events, refunds, WELCOME10 reconciliation, and payment failure.
- [ ] Review Cloudflare live TLS, CSP headers and deployment previews without making a production deployment.
- [ ] Validate RLS and storage access using safe test identities, without touching real customer records.
- [ ] Recheck no secret exposure and inspect dependency alerts and branch protection settings.
- [ ] Obtain **separate explicit approval** before any production merge, deployment, or settings change.

**No-go conclusion:** Staging source changes are saved and source-based regression assertions pass. Production release stays BLOCKED pending integration checks.
