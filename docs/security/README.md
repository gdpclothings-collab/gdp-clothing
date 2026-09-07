# GDP Clothing Security Program

This folder contains the internal operating policies that support the customer-facing Security & Compliance Center.

## Baseline
- Cloudflare is the only hosting/deployment platform.
- GitHub is the source of truth for application code and migrations.
- Supabase provides database, Auth, Storage and Edge Functions.
- Stripe handles payment-card entry through Stripe-controlled payment components.
- Customer-uploaded artwork and personal information are treated as protected customer data.

## Policies
- [Access Control & Authentication](./ACCESS_CONTROL_AND_AUTHENTICATION.md)
- [Data Protection & Retention](./DATA_PROTECTION_AND_RETENTION.md)
- [Secure Development & Secrets](./SECURE_DEVELOPMENT_AND_SECRETS.md)
- [Incident Response](./INCIDENT_RESPONSE.md)
- [Backup, Recovery & Logging](./BACKUP_RECOVERY_AND_LOGGING.md)

The Admin Dashboard → Governance → Security & Compliance page tracks evidence and outstanding controls. A readiness score is an operational indicator, not a certification.
