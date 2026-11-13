# GDP Clothing — Zero-Provider-Cost Background Removal Gate

Status: draft release candidate. **Not deployed by this PR.**

## Why

The current Supabase `remove-photo-background` Edge Function calls the third-party
remove.bg API with `size=auto`. Depending on the remove.bg account's credits and
billing plan, this can consume paid image credits. Neither the existing request
quota nor a pre-call credit balance check guarantees zero provider spending.
Low-resolution free previews are also not an acceptable substitute for GDP's
300-DPI source artwork.

Provider reference: https://www.remove.bg/api

## Safe behavior when released

- The Edge Function rejects all POST processing requests with a clear,
  non-retryable 503 **before** any API-key lookup, DB quota use, storage write,
  or external image-processing request. CORS/OPTIONS handling stays intact.
- The customer API declines to invoke the function while this compile-time
  safeguard is enabled. There is no public URL, browser setting, or environment
  variable that overrides either gate.
- Old Custom Studio photos continue through normal original-artwork upload,
  preview, manual refinement, and print-quality checks. No new automatic cutout
  or guest source proof is issued.
- DTF Gang Sheet disables the AI removal button, explains why, and retains its
  original-artwork restore action. Customers can upload transparent PNGs made
  without GDP's third-party service.
- Existing background-removed source assets and their access controls remain
  unchanged. Payment mode, taxes, orders, RLS, and 300-DPI production logic are
  not altered.

This protects against **paid remove.bg image processing**. It does **not**
guarantee that other usage-based infrastructure, malicious public requests,
or independently configured vendor subscriptions cannot generate charges.
Account billing/spend-cap settings still need separate confirmation.

## Tradeoff

Automatic third-party background removal is unavailable to all customers,
including those who have unused free credits. Complex portraits may need a
transparent file supplied by the customer or manual editing. Do not enable a
low-resolution free-preview fallback for print files.

## Zero-spend verification and release gate

1. Run the cost-policy, guest-ownership, Custom Studio, DTF, build, lint,
   typecheck, and Saskatchewan PST-only tests with **mock inputs only**.
2. Review existing non-browser baseline failures separately. Do not call
   remove.bg, create an order, or perform a transaction during QA.
3. After explicit release approval, deploy the new Edge Function bundle first:
   `index.ts`, `guest-cleaned-source-proof.mjs`, and
   `zero-provider-cost-policy.mjs` (preserve existing JWT setting).
4. Verify the deployed Edge Function has the exact locked code. Only then
   mark the PR ready so the protected auto-merge/Cloudflare/smoke workflow runs.
5. Run safe storefront/DTF/client preview checks with no provider requests,
   no real orders and no image-credit consumption. Stop on any failed gate.

Re-enabling paid API processing requires a new reviewed code change and the
owner's explicit billing authorization. A future **free on-device** background
remover may be assessed separately for quality, licensing, and performance.
