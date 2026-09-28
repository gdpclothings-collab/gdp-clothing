# GDP FAST MODE

GDP FAST MODE is the default development and deployment workflow for this repository. It optimizes for small patches, targeted validation, automatic safe continuation, and immediate production verification without weakening payment, authentication, database, inventory, or customer-data safety.

## Default flow

`ISSUE → DIAGNOSE → PATCH → TARGETED TEST → PR → SAFE MERGE → DEPLOY → PRODUCTION VERIFY → DONE`

Do not pause for routine approval between these stages. Stop only for a genuine user-owned authorization, credential, destructive/irreversible production decision, or other action that cannot safely be automated.

## Risk classification

### GREEN — low risk

Examples: CSS, spacing, copy, icons, responsive layout, button placement, isolated visual bugs.

Required: smallest patch, targeted validation, production build, PR, merge when required checks are green, deploy, verify affected desktop/mobile route and action.

### YELLOW — medium risk

Examples: frontend business logic, cart state, shipping display/selection, product configuration, admin behavior, API integration, non-destructive Supabase reads/writes.

Required: targeted tests, relevant integration checks, build, PR/CI, safe merge, deploy, targeted production workflow verification.

### RED — high risk

Examples: Stripe/payment session creation, webhooks, auth/RLS, schema/migrations, destructive database work, inventory reservation/deduction, order finalization, coupon finalization, guest custom-design ownership/claim lifecycle.

Required: targeted tests plus all relevant payment/auth/database/inventory integration checks, build, required CI, safe merge only when green, deploy, end-to-end production verification. Never reduce RED safety to gain speed.

## Fast inspection and patch policy

Inspect the affected component, related hook/service/API/Edge Function, related tests, current CI for the affected path, and production deployment only as needed. Do not audit the entire repository by default.

Prefer the fewest-file targeted patch. No unrelated cleanup, dependency/framework migrations, renaming, cosmetic refactors, or database restructuring during production recovery.

Before implementing, inspect main/open PRs to avoid duplicate work. Failed checks are repaired in the existing branch/PR; do not restart from scratch.

## Branches and PRs

Use short-lived branches such as `fix/...`, `hotfix/...`, `feat/...`, or `chore/...`. One problem or tightly related implementation per branch.

PR descriptions record problem/root cause, files/scope, GREEN/YELLOW/RED risk, tests performed, and production verification plan. Required checks must never be bypassed. Squash merge is preferred for targeted fixes unless repository conventions require otherwise.

## CI fast path

CI should cancel superseded runs for the same PR, cache npm dependencies safely, and avoid duplicate work. Use `npm ci` for deterministic installs. Expensive production jobs should not run for documentation-only changes where GitHub/Cloudflare configuration allows path filtering without creating missing required checks.

Required RED checks remain mandatory. Never suppress failures, disable RLS, ignore type errors, or weaken security assertions to make CI green.

Repository-level GitHub auto-merge is currently not enabled, so `.github/workflows/safe-auto-merge.yml` provides the repository-controlled merge path after the required checks pass. Keep its required-check list synchronized with branch protection/Cloudflare checks.

## Deployments

Production frontend deploys from `main` through Cloudflare Pages. After a valid merge, do not intentionally delay deployment. Verify build/deployment success, intended merged commit, and the affected route/workflow.

Production Supabase project is `mcmancxsqlhxnjhlnfkz`. Never use `ekxdjvwnbrchyyqbhrsq` for GDP Clothing production. Deploy only the affected Edge Function, migration, database function, or policy. Preserve webhook compatibility and backward compatibility during payment/database rollouts.

## Checkout and shipping safety

Checkout is RED risk. Creating a Stripe session must not permanently mark a guest custom design converted, an order paid, inventory deducted, or a coupon consumed. Irreversible finalization happens only after authoritative successful payment confirmation. Preserve idempotency, webhook replay safety, Back/Edit → Payment safety, abandoned/failed payment recovery, guest verification, and reservation release behavior.

Shipping has one authoritative state. Selected method/price remains stable through Information → Shipping → Payment → Stripe initialization → Back/Edit → Payment return, and is recalculated only when a shipping-relevant input changes. Server-calculated totals remain authoritative; paid shipping must not silently become FREE.

## No-regression requirements

Checkout work preserves guest and signed-in checkout, coupons, shipping, tax, inventory reservations, custom designs, and Stripe webhook processing.

Custom Studio work preserves front/back artwork, garment selection, background removal, export, cart handoff, and saved-design loading.

## Commit awareness and 100%

Track the working branch commit, PR head, merged main commit, production frontend commit, and backend function version when applicable. Do not claim production is updated without linking verification to the intended merged change.

A task is 100% only when root cause is addressed, patch committed, required tests pass, PR is merged, production is deployed when required, affected production behavior is verified, and no known regression remains in the affected workflow. RED work additionally requires its end-to-end flow to pass.
