# GDP Clothing

Production storefront and commerce application for GDP Clothing.

## Production architecture

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Hosting:** Cloudflare Pages
- **Source control / CI:** GitHub Actions
- **Backend:** Supabase Postgres, Auth, Storage, Row Level Security, and Edge Functions
- **Payments:** Stripe embedded checkout + Stripe webhook processing
- **Currency:** CAD
- **Timezone:** America/Regina

This repository is intentionally independent from Shopify and Base44. The legacy `base44/` directory is retained as reference only and is not part of the runtime application.

## Local development

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and configure only frontend-safe Supabase values:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Never place Supabase service-role/secret keys, Stripe secret keys, or webhook secrets in `VITE_*` variables.

## Production verification

Before promoting storefront changes:

```bash
npm run typecheck
npm run lint
npm run build
```

GitHub Actions runs build verification and static quality checks on pull requests targeting `main` and on pushes to `main`.

## Supabase

Production schema changes are tracked under `supabase/migrations/`.

Active Edge Functions:

- `checkout` — checkout sessions, coupons, guest/customer order creation, and Stripe payment preparation
- `stripe-webhook` — verified Stripe webhook processing and paid-order inventory allocation
- `custom-proof-action` — authenticated custom-design proof/revision workflow

All public application tables should remain protected by Row Level Security. Run Supabase security and performance advisors after schema or policy changes.

## Deployment / rollback

1. Make changes on a feature or hardening branch.
2. Run the local verification commands.
3. Open a pull request to `main`.
4. Require the GitHub build and quality checks to pass.
5. Merge to `main` to trigger the Cloudflare Pages production deployment.
6. Verify the live storefront, checkout entry point, authentication, and admin authorization.
7. If a regression is detected, revert the production commit and allow Cloudflare Pages to redeploy the known-good revision.

## Current production URL

https://gdp-clothing.pages.dev/
