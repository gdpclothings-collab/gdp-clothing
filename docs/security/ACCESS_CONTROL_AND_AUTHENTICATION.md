# Access Control & Authentication Policy

## Purpose
Protect GDP Clothing systems and customer information using least privilege and strong authentication.

## Rules
1. Administrative access is granted only to people who require it.
2. Customer, staff, admin and service identities must remain logically separated.
3. Authorization decisions must be enforced server-side and by Supabase RLS; customer-editable metadata is never an authorization source.
4. Owner/admin accounts must use unique passwords and should enroll in MFA. MFA becomes mandatory once the application enforcement flow is enabled and verified.
5. GitHub, Cloudflare, Supabase and Stripe privileged access is reviewed at least quarterly.
6. Access is removed immediately when no longer required.
7. Shared admin credentials are prohibited.
8. Password-reset links, API keys and recovery codes must not be shared through tickets, chat or source control.
9. Sensitive administrative actions should be auditable.
10. Authentication failures and suspected account takeover are handled under the Incident Response Policy.

## Review evidence
Record privileged-user reviews, MFA status and access-removal actions in the Security & Compliance Center or appropriate provider audit log.
