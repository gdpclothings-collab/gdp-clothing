# GDP Quick Design — Phase C: STORM-reference garment preview (2026-11-22)

## Authorization
Owner authorized `AUTHORIZE-GDP-QUICK-DESIGN-PHASE-C-STAGING-V1`:
- Same existing Quick Design draft branch and PR #609; NO merge, live storefront changes or customer data mutations.
- Zero additional charges and only existing resources.
- Replace the Sample A/B selection with a single STORM-reference print composition and six garment mockups (black T-shirt, sweatshirt, hoodie; each front/back).
- Preserve existing font, name, curve, colour, premium text styles, source GDP background choices, free-use-limited remove.bg, contact options and tax safeguards.

## Uploaded STORM reference interpretation
The supplied STORM dog image has:
1. Oversized yellow-gold dimensional name at the VERY TOP.
2. Centered large dog portrait with smaller surrounding dogs overlapping across the middle and lower area.
3. Pink/orange/yellow lightning/smoke/flames mainly BEHIND the photos and toward the lower area.
4. Soft subject cutout edges and no opaque poster rectangle when printed on black garments.

The Phase C renderer reproduces these composition RULES, not the reference customer's actual dog photo/face/background raster. The selected original GDP background bitmap supplies the storm/flame energy at the BOTTOM: it is not recoloured or replaced with paid-generated imagery; it is drawn on a temporary transparent layer and feathered vertically/horizontally.

## Implementation
- `src/lib/quickDesignPhaseCLayout.js`: one fixed 1–5 pet layout with central hero, flanking support and low foreground, without A/B variants.
- `src/lib/quickDesignCanvas.js`: 750x1000 **transparent** canvas, bottom-weighted original background via local feathered alpha masks, STORM name across the top and optional subtitle, watermark retained for free preview. Output PNG maintains transparency on the garment mockup. This is NOT final print-ready 3600x4800/300-DPI production export.
- `src/lib/quickDesignGarmentMockup.js`: all six black garment/side combinations render locally, with cloth folds, shadowing, stitching and fabric grain. These are APPROXIMATE high-detail studio illustrations, not Gildan-certified photos or manufacturer fit/print-area guarantees; do not mislabel them as actual apparel photos.
- `src/pages/QuickDesign.jsx`: one cached art result; six cached garment images; selectable T-shirt/sweatshirt/hoodie and Front/Back; full-size selected mockup and 3x2 gallery; default T-shirt Front. Only selected side enters request summary, never presume both-sided print. Download and share selected mockup with originals.
- Help and labels describe Phase C instead of A/B. Contact request stays disabled on Cloudflare branch.
- remove.bg continues opt-in, preserved original photos, already-transparent PNG/WebP skipped without API credits, free account safeguard, rate cap and external fallback. No changes to the Supabase server functions, secrets, quotas, checkout or tax settings.

## Release gates
- [x] Single artwork instead of A/B, original GDP backgrounds stay selectable
- [x] Name top/pets center/storm background bottom, transparent artwork
- [x] Six garment-side options with Front default
- [x] Request and download use chosen garment/side only
- [x] Preserve privacy, zero-cost, existing remove.bg opt-in behavior
- [ ] CI regression PASS including browser at 360px / 390px / 1280px (see latest branch build)
- [ ] Owner visual sign-off against the uploaded STORM design
- [ ] Manual Android real pet-photo / cutout check and realistic mockup review
- [ ] Verify actual final 300-DPI production files and Gildan print placement in later approved scope
- [ ] Separate approval to merge/deploy to live gdpclothing.ca

## Non-goals
Do not deploy production; do not buy a service, generate an AI image for each user, charge a card, modify real orders, change Saskatchewan PST 6% or GST 0%, or promise two-sided printing.
