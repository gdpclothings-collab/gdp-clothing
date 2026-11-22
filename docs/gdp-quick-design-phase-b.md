# GDP Quick Design — Phase B (isolated Draft PR #609)

## Purpose
Replace the previous overlapping **rectangular photo cards** with a bootleg composition inspired by the customer's approved HENRY dog-collage visual:
- A: **Layered Classic** — near-top hero, flanking portraits, foreground supporting images.
- B: **Dramatic Stack** — larger hero with asymmetric supporting images and deeper overlaps.
- A single photo generates a single hero, never duplicate portraits; 2–5 photos use all photos exactly once.
- An actual cutout/transparent PNG preserves fur/ear/hair alpha edges and draws a pink glow + light keyline. Opaque JPGs get clearly labelled soft-edged montage fallbacks, **not fake cutouts**.
- No source photo face/animal warping; whole cutout is aspect-ratio-preserved, alpha-margin-trimmed, with user-selected original GDP background bitmap unchanged.
- HENRY-inspired defaults: arched varsity lettering, Sunset Gold Chrome, pink accent. Existing name customization, font, subtitle, 60–160% size, styles, 12×16 ratio, watermarked samples, and tee/crewneck/hoodie front/back visualizer retained.

## remove.bg free-preview integration: code prepared, NOT ACTIVATED
The 2026-11-21 remove.bg API documentation states the initial 50 free API calls per month and free preview outputs of only **0.25 MP**. The API page also announces a switch to Leonardo.Ai beginning **2026-12-01**; reconfirm terms, API eligibility, availability, and actual free account allowances before activating.

Implementation:
1. Browser checkbox starts OFF. If checked, each photo is sent through Supabase Edge Function gdp-quick-design-remove-bg. This is explicit consent to a third-party processor; preview rendering itself remains on-device.
2. Server refuses requests unless GDP_REMOVEBG_ENABLED=true, GDP_REMOVEBG_API_KEY and GDP_REMOVEBG_HASH_SALT are securely provisioned, and the quota RPC exists. Staging-domain use additionally requires GDP_REMOVEBG_ALLOW_PREVIEW=true; keep this false in production.
3. The function accepts only JPG/PNG/WebP <=10 MB with MIME plus header validation, uses API size=preview, format=png, crop=true, and never requests full/auto/high-res output.
4. Staging migration 20261122000000_quick_design_removebg_free_preview_quota.sql atomically reserves a call before contacting remove.bg. Hard cap **max 50 attempted calls per UTC calendar month** and **max 6 calls per hashed caller per hour**. Failed API calls STILL consume the reservation. No retry loop. No invoice/payments/code for paid credits.
5. A rate/quota/config/error response preserves original photos and any successfully processed cutouts, disables further automatic processing, and offers **Open remove.bg** (external). Customers can manually reupload PNGs with automatic processing OFF.
6. No raw photos, outputs, IP addresses, or API keys are saved in database or logs. Hourly salted identity hashes and aggregate monthly counters only.
7. No production edge function deploy, migration application, secret configuration, or merge has been performed.

### Important commercial restriction
The 50-call application cap does **not** guarantee 50 calls are available or free on a particular remove.bg account. The account may already have used allowances elsewhere, and its billing settings may permit charges. Before deployment GDP must verify a dedicated free-only account with **no payment method, no automatic top-ups, and no chargeable overflow**, then use a separate staging Supabase project/branch for integration QA. If no cost-free account can be verified, keep the server disabled and use the external manual link.

The free 0.25MP previews cannot be treated as the promised 3600×4800-pixel, 300-DPI production artwork. Secure transfer of original files, final 300-DPI export, customer consent policy, manual approval and print-area QA remain separate release gates.

## Release checklist
- [x] Phase B canvas layout code and HENRY-inspired typography defaults committed
- [x] Third-party upload consent and guarded browser client implemented
- [x] Optional free-preview API proxy and atomic quota migration committed, not deployed
- [x] Chrome, neon, text and garment controls retained
- [ ] Browser CI PASS at 360px, 390px and 1280px with five-photo mocks and 429 fallback
- [ ] Real Android manual preview of original HENRY-like dogs with actual transparent cutouts
- [ ] Dedicated free-only remove.bg API key and billing/2026-12-01 migration confirmation
- [ ] Staging-only Supabase migration and function deployment + signed/authenticated quota tests
- [ ] 300-DPI production export, secure source photo transfer and print-area QA
- [ ] Separate owner approval to merge to production
