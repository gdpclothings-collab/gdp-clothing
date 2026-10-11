# GDP Clothing — PR #481 invoice production deployment runbook

**Release mode: MANUAL GATE. This document does not authorize or execute a production change.**

PR: https://github.com/gdpclothings-collab/gdp-clothing/pull/481
Repository: `gdpclothings-collab/gdp-clothing`
Hosted Supabase: `GDP Clothing`, project ref `mcmancxsqlhxnjhlnfkz`
Frontend: Cloudflare Pages, `https://gdpclothing.ca`
Review head at runbook creation: `18d2939065d2b395ae6abb8ee278fa6b33a29798` (recheck before deployment)

## Read-only preflight findings, 2026-10-11
- Production: `orders`, `order_items`, `profiles`, `admin_mfa_enrollment_state`, `tax_rules`, `checkout_rate_limits`, `order_inventory_reservations`, and `artwork_library` exist with RLS.
- Existing order has GST/HST and PST components; auth admin/step-up helpers are present.
- Production **does not** have `public.gdp_invoices`, `public.issue_admin_invoice_from_draft(uuid)`, `orders.invoice_document_meta`, `orders.invoice_due_date`, or `orders.reserved_invoice_number`. These must be deployed before invoice UI.
- The hosted migration log ends at `20261009220707` and differs from many historical filenames in Git. **DO NOT run `supabase db push`, `db reset`, `migration repair`, or blanket `migration up --linked` on production**. Do not mark historical versions applied without reviewing the actual hosted objects.
- Historical local-recovery migrations at `20260907230000`, `20260912214000`, and `20261003031000` are NOT part of the production release; their target tables/function already exist in production. Two older migration renames align with already recorded hosted versions and must not be replayed.
- CI runs are not proof that production schemas have been migrated.

## Automatic deployment hazard
`.github/workflows/safe-auto-merge.yml` listens to `ready_for_review` for owner-created PRs and **squash merges automatically when required checks pass**. A main-branch merge may deploy Cloudflare production and trigger production smoke. **Keep PR #481 as draft** until database changes are in place and release owner explicitly authorizes production deployment. Do not mark ready merely to request a review. The auto-merge path is an existing repo-wide behavior; do not modify it as an invoice-only shortcut.

## Required gates BEFORE changing hosted Supabase
1. Confirm release owner approval for database-first production rollout and a suitable low-traffic window.
2. Confirm point-in-time recovery or a current restorable database backup, applicable plan retention, and who can restore. Avoid printing database URLs, JWTs, or credentials.
3. Inspect production schema, policy and migration drift again immediately before applying. Do not use a broad database reset or historical reapply.
4. Verify the exact PR head, no unrelated branch changes, and green `standalone-build`, `static-quality`, `Browser secret guard`, `CodeQL`, and Cloudflare preview checks.
5. Verify local migration `20261011043000_invoice_issued_terms_snapshot.sql` and local concurrency QA passed, including frozen `invoice_due_date` and `invoice_payment_terms` (screenshot from 2026-10-11).
6. Obtain explicit approval for production migration execution. Do not infer permission from `DEPLOYPREP`.

## Controlled database-FIRST rollout (after approval)
Never run SQL on production as an exploratory step. Apply *only* the following new invoice-specific migration SQL, one at a time in exact order using a supported Supabase migration action. Check success and migration ledger for each; stop immediately on any error. Do not re-run a partially applied migration without inspecting its state.

1. `20261010021500_admin_invoice_ledger.sql` — sequence, immutable invoice ledger, row-lock issuance foundation.
2. `20261010173000_invoice_draft_metadata.sql` — draft due-date metadata.
3. `20261010181000_atomic_manual_drafts.sql` — guarded atomic draft-save and conversion RPCs.
4. `20261010193000_invoice_document_draft_meta.sql` — guarded draft layout metadata.
5. `20261010194000_snapshot_invoice_document_meta.sql` — presentation snapshot.
6. `20261010210000_atomic_complete_invoice_draft.sql` — atomic document/draft persistence.
7. `20261011004000_invoice_layout_payment_due.sql` — guarded draft-only date/layout edits.
8. `20261011010000_reserve_draft_invoice_number.sql` — reserve number when saving a draft.
9. `20261011021000_issue_admin_draft_direct.sql` — atomic draft activation and issuance.
10. `20261011033000_invoice_issuance_strict_aal2.sql` — enforce AAL2 regardless of onboarding grace.
11. `20261011043000_invoice_issued_terms_snapshot.sql` — freeze due date and payment terms on new issued invoices.

Interim states are **not** release-ready; in particular, the early issuance definitions are intentionally superseded by the final strict-AAL2 migration. Apply as a controlled sequence, then validate all guards before frontend exposure. Fresh-local recovery migrations and historic rename files must not be executed against production merely because they appear in this PR.

## Read-only production verification, AFTER database rollout
- Confirm `gdp_invoices` exists, has RLS, unique constraints on `order_id` and `invoice_number`, immutable update/delete trigger, admin-only SELECT policy and no anonymous EXECUTE on privileged RPCs.
- Confirm final `issue_admin_invoice_from_draft` and `issue_admin_order_invoice` definitions both require actual JWT `aal2` AND admin. The final order issuance RPC includes `invoice_due_date` and `invoice_payment_terms` in the frozen snapshot.
- Confirm original store checkout, Stripe server-side session creation, webhook processing, stock reservations, guest checkout, and tax settings have not regressed. **Do not create a live payment or issue a real tax invoice for smoke testing without explicit authorization.**
- If DB verification fails, do **not** mark PR ready. Prefer a minimal forward-only repair migration to a destructive revert.

## Frontend release AFTER verified database rollout
1. Confirm owner accepts scope and known compliance limitations (no credit notes, payment reconciliation, emailed/stored PDFs, tax registration number configuration).
2. Confirm checkout/regression smoke, mobile invoice preview, admin vs non-admin access, normal and compact PDF, customer details, ledger read, MFA gating, and payment not collected on issuance.
3. Only then let the PR exit draft/merge under the repository's owner auto-merge rules (or intentionally handle that workflow). Verify Cloudflare production deployment for the exact main SHA.
4. Run existing production-smoke workflow and a non-mutating admin invoice preview/MFA check. Monitor checkout errors, Auth, inventory reservations and billing.

## Rollback / incident playbook
- BEFORE any invoice is issued: stop the frontend rollout (keep PR draft), fix SQL forward-only if needed. A verified backup/PITR recovery plan is still required.
- AFTER a frontend rollout issue: use Cloudflare Pages deployment rollback to the last verified production build; avoid deleting rows or resetting Supabase to disable a feature.
- AFTER an official invoice is issued: **never DROP, DELETE, or UPDATE the immutable invoice ledger as a rollback**. Preserve issued documents, numbers, snapshots and tax history. A separate future credit-note/correction process is required.
- If auth, checkout, or inventory behavior changes unexpectedly, block issuance and checkout-dependent operations as necessary, gather safe logs (no credentials/customer PII), restore the last frontend build, and resolve schema changes with audited forward migrations.
- Document exact executed migration names, database backup/recovery reference, production Cloudflare SHA and smoke evidence.

**NO-GO conditions:** missing database backup/recovery, migration drift unresolved, AAL2 guard not verified, any red CI/security/checkout check, missing registered business/tax disclosures where legally required, or inability to recover without corrupting issued invoice history.
