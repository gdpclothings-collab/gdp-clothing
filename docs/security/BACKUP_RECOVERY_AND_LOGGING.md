# Backup, Recovery & Logging Policy

## Backup and recovery
- Supabase production data must have an understood backup/recovery capability appropriate to the business.
- Recovery procedures are documented and tested on a non-production environment before being considered verified.
- A restore test must confirm application-critical tables, Auth relationships, storage references and order integrity.
- Destructive restore testing is never performed directly against live production data.

## Logging
Log security-relevant administrative and system events without recording unnecessary sensitive data.

Recommended events:
- admin authorization/permission changes;
- order/payment/fulfillment status changes;
- refunds and returns;
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
