# GDP Clothing Disaster Recovery Runbook

## Scope
This runbook covers the GDP Clothing production stack: Supabase database/Auth/Storage/Edge Functions, Cloudflare Pages storefront deployment, and Stripe payment integration.

## Recovery objectives
- **RPO target:** 24 hours with the current daily-backup baseline.
- **RTO target:** 4 hours for a database/service recovery during normal support availability.
- If the business requires an RPO below 24 hours, enable and budget for Supabase Point-in-Time Recovery (PITR) instead of relying only on daily backups.

## Confirmed baseline
- Supabase organization plan: Pro.
- Production project: `GDP Clothing` in `ca-central-1`.
- Supabase Pro includes daily database backups with a 7-day retention window.
- Production schema migrations and Edge Function source are tracked in GitHub.
- Do not restore production merely to test recovery.

## Quarterly restore drill
Use an isolated Supabase branch or separate recovery project.

1. Record the production migration head and current Edge Function inventory.
2. Create the isolated recovery target.
3. Restore/import the selected backup or logical export into the isolated target.
4. Verify:
   - critical tables exist;
   - RLS is enabled on exposed tables;
   - server-only tables have no anon/authenticated grants;
   - order, product, inventory, Finance, and settings row counts are plausible;
   - Stripe secrets are not copied into client-visible configuration;
   - Edge Functions deploy from the GitHub source;
   - checkout can complete in test mode only.
5. Run Supabase security advisors.
6. Record drill date, source backup timestamp, achieved RPO/RTO, failures, and corrective actions.
7. Delete the isolated recovery target after evidence is recorded.

## Production restore decision
A production restore is destructive and causes downtime. Before starting:
- stop or place checkout into maintenance mode;
- choose the closest known-good restore point before the incident;
- record the expected data-loss window;
- preserve incident evidence;
- notify the business owner of expected downtime;
- after restore, re-run RLS/security advisors and payment/checkout smoke tests before reopening checkout.

## Backup policy review
Review quarterly and after major database/payment changes:
- backup retention;
- PITR need/cost;
- restore-drill evidence;
- Stripe webhook configuration;
- GitHub-to-production migration/function reconciliation.

References:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery
