# GDP Clothing: local invoice staging (no additional Supabase hosting charges)

This procedure uses **your own Windows PC**. No commands below deploy to the hosted Supabase project or Cloudflare.

## Prerequisites
- Git, Node.js and Docker Desktop installed. Start Docker Desktop.
- A working copy of PR #481 checked out.
- Supabase CLI: install in the repo as a dev dependency (for example `npm install --save-dev supabase`) or run with `npx supabase`.
- Never copy real customer information or production secrets into local seeds.

## Safe PowerShell commands (from repo root)
```powershell
git fetch origin
git switch feature/admin-invoice-print-preview
docker info
npx supabase --help
if (!(Test-Path "supabase/config.toml")) { npx supabase init }
npx supabase start
npx supabase db reset --local
node --test scripts/verify-invoice-ledger.mjs
```

**WARNING:** `supabase db reset --local` **erases only the local staging database** and replays all migrations. Never substitute `--linked`, `--db-url`, or `supabase db push` on the live project. Do not run `supabase link` for this workflow.

Check local Studio using the localhost URL printed by `supabase start`. Test on generated fake orders only.

## Verification matrix
1. Confirm all migrations apply successfully during `db reset --local`, especially `20261010021500_admin_invoice_ledger.sql`.
2. Confirm `public.gdp_invoices` exists and has row-level security enabled.
3. Sign in as an authorized local test admin with MFA step-up and issue an invoice on a synthetic valid non-draft order.
4. Retry issuing the same order: return the same invoice number and row (no duplicate).
5. Attempt issuance without an authenticated admin, and as an admin without MFA step-up: both must be denied.
6. Attempt invoicing drafts, cancelled/refunded orders, invalid totals, or mismatched tax breakdowns: all must be denied.
7. Attempt to UPDATE or DELETE an issued invoice row: both must be denied.
8. Verify the printed document shows the immutable line items, tax amounts, issue date and reference after the original order is edited.
9. Verify the normal checkout and payment regression suite separately before production deployment.

## Current limitation
The current invoice feature has **no tax registration configuration, no credit-note issuing flow, and no customer email/Stripe payment-link workflow**. These features must not be described as production-ready or fully tax-compliant.

## Cleanup
```powershell
npx supabase stop
```

This stops local containers. It does not change the hosted production database.
