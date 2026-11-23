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


## Phase C garment color variants (approved 2026-11-22)

Owner selected the strict order: **Garment → Color → Front/Back → Upload → Customize → Preview**.
- Allow only **Black** and **White** across T-shirt, Sweatshirt and Hoodie. Do not preselect any of the three garment/colour/side inputs.
- Choosing a garment reveals the two color swatches. Only after a color is chosen can the customer choose Front or Back; photo upload and mockup remain disabled until all three are chosen. Changing garment resets color and side; changing color resets side to prevent stale previews.
- Browser mockup painter uses one original STORM-reference artwork for both garment colors. The white fabric uses its own cloth gradients, folds, stitching, hood, cuffs, and neckline. Only mockup fabric lighting/shadows change; the customer's artwork is not changed.
- Show just the **one** selected garment/color/side mockup. Never display a gallery suggesting all six (now twelve) variations are purchased or both sides included.
- File downloads, Web Share mockup filenames, share description, visible preview label, copied Help details, and customer-lead garment summary must include the chosen color. Production preview form remains disabled on Cloudflare preview branches.
- Continue original/no-cost remove.bg safeguards, opaque-photo opt-in, and local transparent-photo bypass. No changes to production checkout, tax, products, live data, or payment settings.
- Stage-only QA: run static verification, browser selection gates at 360/390/1280px, compare white fabric brightness against black, swap selected garment and color after photo upload, verify only the last selected side stays pressed. Full source art production output/photography still separate from preview illustrations.

Release remains DRAFT PR #609; no merge or production deployment without owner approval.
