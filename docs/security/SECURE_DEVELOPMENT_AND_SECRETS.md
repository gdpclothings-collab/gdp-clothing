# Secure Development & Secrets Policy

## Source and deployment
- GitHub `gdpclothings-collab/gdp-clothing` is the source of truth.
- Production hosting/deployment is Cloudflare only.
- Production schema changes must be represented by Supabase migration files.
- Direct production edits are avoided except controlled incident recovery or verified migration execution.

## Required checks
Before a production change is considered healthy:
- production build passes;
- TypeScript check passes;
- ESLint passes;
- relevant regression tests pass;
- browser-secret guard passes;
- CodeQL/security analysis is reviewed when available.

## Secrets
Never commit or expose:
- Supabase service-role/secret keys;
- Stripe secret keys or webhook secrets;
- Cloudflare API tokens;
- database passwords;
- OAuth client secrets.

Frontend variables may contain only browser-safe publishable values. Rotate a credential immediately if exposure is suspected.

## Dependency security
Review dependency alerts and security advisories, prioritize remotely exploitable/high-impact issues, and avoid unnecessary packages.

## Review
Security-sensitive changes involving Auth, RLS, Storage, checkout, uploads, permissions or privileged database functions require explicit security review and post-change verification.
