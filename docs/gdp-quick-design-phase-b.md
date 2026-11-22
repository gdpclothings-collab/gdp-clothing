# GDP Quick Design — Phase B (isolated Draft PR #609)

## Purpose
Replace the previous overlapping **rectangular photo cards** with a bootleg composition inspired by the customer's approved HENRY dog-collage visual:
- A: **Layered Classic** — near-top hero, flanking portraits, foreground supporting images.
- B: **Dramatic Stack** — larger hero with asymmetric supporting images and deeper overlaps.
- A single photo generates a single hero, never duplicate portraits; 2–5 photos use all photos exactly once.
- An actual cutout/transparent PNG preserves fur/ear/hair alpha edges and draws a pink glow + light keyline. Opaque JPGs get clearly labelled soft-edged montage fallbacks, **not fake cutouts**.
- No source photo face/animal warping; whole cutout is aspect-ratio-preserved, alpha-margin-trimmed, with user-selected original GDP background bitmap unchanged.
- HENRY-inspired defaults: arched varsity lettering, Sunset Gold Chrome, pink accent. Existing name customization, font, subtitle, 60–160% size, styles, 12×16 ratio, watermarked samples, and tee/crewneck/hoodie front/back visualizer retained.

## remove.bg free-preview integration: activated for the branch preview on November 22, 2026

GDP Clothing has one Supabase project and ONE shared remove.bg server-side secret, REMOVE_BG_API_KEY, originally used by Custom Studio's remove-photo-background. Quick Design uses a separate `gdp-quick-design-remove-bg` Edge Function; it does NOT modify the production Custom Studio function, whose existing size=auto behavior is unchanged.

The owner previously authorized enabling Quick Design automatic removal. This execution:
- Applied migration quick_design_removebg_free_preview_quota_20261122 to the existing Supabase project. Checked RPC exists and is executable by service_role but NOT anon or authenticated.
- Deployed gdp-quick-design-remove-bg Edge Function version 1 (ACTIVE), verify_jwt=false for customer guest usage. Allowed Origin is limited to GDP Clothing official domains and Cloudflare Pages branch previews. Unauthorized origin/method/file format is rejected, with no image processing.
- Function uses ONLY size=preview, format=png, crop=true. The high-resolution print source and Custom Studio original output remain separate.
- Before EVERY provider image call it makes a read-only GET https://api.remove.bg/v1.0/account using the server-held existing REMOVE_BG_API_KEY. It requires a valid free_calls integer GREATER THAN 5. Paid credits reported in subscription/payg are never used to decide to proceed. If balance cannot be verified or fewer than 6 free calls remain, it refuses the upload and preserves the original. This buffer mitigates (but cannot fully eliminate) lag and concurrency of the shared account.
- Atomic DB reservation stops this Quick Design function after 50 attempted calls per UTC month, or 6 attempts per hashed identity per UTC hour. Failed checks or upstream errors do not auto-retry. The account can still be used by Custom Studio, which has different quota rules.
- No customer photo is sent externally without the opt-in checkbox. Existing transparent PNG/WebP originals are skipped locally and left untouched, no remove.bg call. Error/limit displays the external URL.
- No actual remove.bg image requests were made during deployment or browser QA, so no credits were intentionally spent. Provider's remaining free balance at time of customer use is not guaranteed.
- The read-only account-balance API may report delayed free_calls values; fully guaranteeing no charges under parallel Custom Studio use would additionally require an account-level provider spending hard-stop or a shared global admission controller. Keep the safety buffer.
- Supabase deployment is active for the Preview's API path; GitHub PR #609 remains DRAFT and NOT merged into production. Live GDP storefront UI has not been redeployed.

Note: The remove.bg docs announce that API background removal moves to Leonardo.Ai beginning December 1, 2026; re-check API availability and free terms before that date.

### QA
- [x] Phase B previews and original GDP backdrop preserved
- [x] New quota migration applied; service-role-only execution verified
- [x] New Edge Function deployed and ACTIVE
- [x] Same existing Custom Studio remove.bg secret configured by reference
- [x] Free account balance preflight and 5-call buffer coded
- [x] Transparent PNG and opaque JPG/PNG conditional handling + automatic quota fallback
- [ ] Actual Android test with a real photo; record successful cutout or free-credit fallback
- [ ] Verify remove.bg provider account-level hard stop / billing controls independently
- [ ] Real 3600x4800 300 DPI print export and secure original source transfer
- [ ] Owner approval to merge/deploy storefront changes

## Conditional background removal: preserve transparent originals (2026-11-22)
- Customers opt in with the existing **Automatic background removal with remove.bg** checkbox. The button is not pre-selected; no photo is sent to any external service before consent.
- A lightweight browser alpha check runs before each API request. If a PNG or WebP has meaningful transparency and at least two transparent corners, it is marked **Transparent • unchanged** and is displayed from its original browser URL. The image bytes, size and layers are not modified, and **zero API credits** are consumed.
- JPEG is always opaque. Opaque PNG/WebP files are classified as needs-removal and processed sequentially through the existing guarded remove.bg server proxy only when enabled. This is NOT a semantic AI background detector and cannot guarantee an opaque image needs removal.
- Unreadable images fail closed without a third-party request; original preserved. Quota exhaustion or API failure preserves previously processed and original photos; automatic processing stops, and the external remove.bg link is offered.
- The branch uses the SAME existing Custom Studio secret REMOVE_BG_API_KEY; no new remove.bg account/API key. Do not call the existing remove-photo-background production function directly for this preview: its size=auto setting and existing day-based limits don't meet zero-charge guarantees.
- Supabase quota migration now installed and the guarded Quick Design Edge Function is active. Browser QA uses mocked, no-cost provider responses; actual provider processing still requires available free credits.
- Browser regression includes a real transparent PNG + four opaque PNGs, confirms no API call for the first image, one mock-success opaque cutout, one mock 429 quota failure, and unchanged original image URL across desktop and mobile.
