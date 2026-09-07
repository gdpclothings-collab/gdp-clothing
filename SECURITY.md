# GDP Clothing Security Policy

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue, discussion, review, or social-media post.

Use the GDP Clothing storefront Contact page and clearly mark the request as **Security**. Include:
- the affected page, route, or feature;
- a concise description of the issue;
- reproduction steps that do not destroy, alter, or expose other customers' data;
- the security impact you observed;
- screenshots or logs with secrets and personal information removed.

GDP Clothing will review reports, contain confirmed issues, preserve relevant evidence, and track remediation through the internal Security & Compliance Center.

## Scope

The security program covers the GDP Clothing storefront and admin application, Cloudflare hosting and edge controls, the GitHub source repository, Supabase database/auth/storage, Stripe payment integration, customer artwork uploads, administrative access, backups, and incident response.

## Security principles

- Least privilege for customer, staff, service, and administrative access.
- Row Level Security on exposed Supabase application tables.
- Privileged keys and secrets must never be shipped in browser bundles.
- Raw payment-card data must remain within approved Stripe-controlled payment components.
- Customer artwork and personal information must have defined retention and deletion rules.
- Production security findings are tracked with evidence and an explicit status.
- Security changes should be reviewed and verified without bypassing access controls.

## Production baseline

The Admin Dashboard contains **Security & Compliance**, which combines live database posture checks with reviewable controls for identity, privacy, payments, Cloudflare, GitHub, resilience, and incident response.

The readiness score is an operational indicator only. It is not a certification, legal opinion, or substitute for an independent assessment when one is required.
