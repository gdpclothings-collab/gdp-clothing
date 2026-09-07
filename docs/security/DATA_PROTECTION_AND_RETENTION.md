# Data Protection & Retention Policy

## Classification
**Restricted:** credentials, secret keys, payment secrets, authentication tokens.
**Customer confidential:** customer profiles, addresses, orders, artwork/photos, proofs, support messages.
**Internal:** operational notes, production data, incident records.
**Public:** published catalog, policies, approved storefront content.

## Controls
- RLS is required on every exposed Supabase application table.
- Customer uploads use owner-scoped private storage policies.
- Service-role credentials and Stripe secret keys are server-side only.
- Full payment-card numbers and card security codes must never be intentionally stored in Supabase, GitHub, browser logs or artwork storage.
- Collect only information reasonably necessary for a documented business purpose.
- Customer privacy requests are identity-linked and tracked to completion.

## Retention targets
- Customer artwork/photos: target review/removal approximately 180 days after fulfillment purpose ends, subject to active order, dispute, fraud, legal-hold or customer-requested exceptions.
- Support records: target review after 24 months once resolved.
- Security/audit records: target review after 24 months; retain longer when investigation or legal evidence requires it.
- Transaction/accounting records: retain as reasonably required for tax, accounting, fraud and legal obligations.
- Marketing consent/withdrawal records: retain while necessary to demonstrate consent and compliance history.

Automated deletion must never remove files still required for an active order or legal hold. Until automated purge is verified, retention cleanup remains a tracked operational control.
