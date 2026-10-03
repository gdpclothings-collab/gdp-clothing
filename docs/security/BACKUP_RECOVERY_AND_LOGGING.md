# Backup, Recovery & Logging Policy

## Backup and recovery
- Supabase production data must have an understood backup/recovery capability appropriate to the business.
- Recovery procedures are documented and tested on a non-production environment before being considered verified.
- A restore test must confirm application-critical tables, Auth relationships, storage references and order integrity.
- Destructive restore testing is never performed directly against live production data.
- Database backups and Supabase Storage objects are treated as separate recovery assets. A database restore alone does not restore deleted Storage objects.
- Customer-uploaded artwork, production artwork and design proofs must never be copied into the public GitHub repository or unencrypted build artifacts.

### Current zero-additional-cost recovery baseline
- Database: rely on the existing Supabase managed daily backup capability for the production project.
- Provisional database RPO target: 24 hours. This target reflects the daily-backup baseline and is not a guarantee of zero data loss.
- Provisional RTO target: 8 hours. This remains unverified until a non-production restore drill is completed successfully.
- Storage: maintain a separate export/copy of private production buckets outside GitHub. The priority buckets are `artwork-production`, `customer-uploads`, `design-proofs`, and `dtf-artwork`.
- `product-images` is public content but should still be included when a full media recovery copy is made.
- A Storage backup must preserve object paths so database references remain recoverable.

### Restore drill checklist
1. Restore or clone the database into a non-production Supabase project/environment.
2. Confirm critical tables, order counts and Auth relationships are present and internally consistent.
3. Restore a representative sample of Storage objects using their original bucket/object paths.
4. Verify a custom order can resolve its artwork, proof and production-file references.
5. Record start/end times, data cut-off time, failures and corrective actions.
6. Only mark RTO/RPO as verified after the drill succeeds; never test a destructive restore directly against production.

## Logging
Log security-relevant administrative and system events without recording unnecessary sensitive data.

Recommended events:
- admin authorization/permission changes;
- order/payment/fulfillment status changes;
- refunds and returns;
- Stripe disputes/chargebacks and dispute-status changes;
- security configuration changes;
- policy/privacy requests;
- security incidents;
- failed security checks and critical application errors.

Never intentionally log:
- passwords;
- recovery codes;
- Supabase service-role keys;
- Stripe secret/webhook keys;
- full payment-card numbers;
- card security codes.

## Monitoring
Supabase Security Advisor, GitHub Actions security checks and production application failures are reviewed after security-sensitive changes and periodically during normal operation.
- WARN/ERROR findings from Supabase Security Advisor must be reviewed before declaring a security-sensitive change complete.
- RLS-enabled service-only tables with no client policies may remain policy-less when client access is intentionally denied and all grants to `anon` and `authenticated` are revoked.
