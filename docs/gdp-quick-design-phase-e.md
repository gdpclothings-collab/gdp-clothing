# GDP Quick Design — Phase E staging changes

Authorization: `AUTHORIZE-GDP-QUICK-DESIGN-PHASE-E-STAGING-V1`

## Safety boundary

The implementation stays in `feature/gdp-quick-design-mvp-20261121`, Draft PR #609. No merge into main, production storefront deployment, live customer data mutations, actual payments, changes to Stripe, WELCOME10, PST 6%, GST 0%, or new paid service. Existing guarded opt-in remove.bg integration remains untouched.

## Garment assets and quality

The existing locally generated canvas garment models are reused. Existing approved website assets did not contain a complete matching set of licensed Black/White × Front/Back photographs for T-shirt, sweatshirt and hoodie, so no unrelated clothing pictures or paid image service were introduced.

Changes:
- All 12 garment options retain the existing 1200 × 1440 px high-density mockup output (2× scale) and single-selected-view behavior.
- The garment painter now adds fine micro-weave shading, subtle fabric folds and softly lit creases to the existing fabric grain, necklines, seams and shadow effects.
- The output remains a **high-quality studio-rendered illustration, not a Gildan-certified photorealistic garment photograph**.
- 1200 × 1440 is a DISPLAY mockup, **not** an A3/12 × 16-inch 300-DPI production artwork master.
- Higher-resolution final print artwork and verified real-product photographic assets are separate tasks requiring review.

## Name preview curve correction

- `renderQuickDesignNamePreview()` in `src/lib/quickDesignCanvas.js` directly reuses the same `paintHeadline()` routine as the full STORM bootleg artwork.
- When the customer changes Straight, Curve Up, Curve Down, font, size, premium style, color, or name, the selected font preview regenerates using those exact styles.
- This removes the former CSS-only straight label that did not reflect the selected curve. It is displayed as a dynamically generated PNG preview.

## Face visibility safeguards

- Source pet/person photos are now always fitted using `contain` with unchanged aspect ratio, not cover-cropped when opaque.
- Real transparent cutouts have only their empty alpha padding trimmed, never cut through the subject.
- The 1–5 photo layout uses non-overlapping **upper-middle face-priority regions**; later foreground layers are prevented from blocking that protected region. The main pet/person remains prominent near the center.
- A star button lets the customer choose any uploaded image as the primary/large central subject without reuploading.
- All existing GDP backgrounds, name-above-subject, storm/flame effects behind/below subjects, transparency and preview watermarks remain.

**Limit:** This is non-cropping, face-priority composition, not actual reliable detection of every human or animal face. Faces already hidden, tiny, off-center, or outside the priority region cannot be guaranteed visible. Customers must visually review the preview and use clearer pictures or choose their primary subject as needed. No third-party face-recognition API or paid model is used.

## Automated QA evidence

- Pure geometry QA for photo counts 1–5, non-overlapping protected regions, source image contain fit at five aspect ratios, and preserved transparency.
- Existing 12-combination placement contract and app static regression coverage.
- Playwright `scripts/quick-design-browser-smoke.mjs`: 360px, 390px and 1280px viewports; curved font control changes; main photo selection; 12-combination selection on desktop; photo-count 5→1 without browser overflow; original remove.bg opt-in/quota fallback mocks preserved.
- GitHub Actions on Draft PR #609 must run `verify-quick-design-mvp.mjs`, TypeScript, ESLint, app build, and Playwright smoke before QA can be declared PASS.

## QA status

| Area | Status |
| --- | --- |
| Branch-only code implementation | IMPLEMENTED |
| All 12 clothing/side/color combinations | AUTOMATED QA PENDING |
| Actual Straight/Up/Down curved preview | AUTOMATED QA PENDING |
| 1–5 photos and unblocked face-priority regions | AUTOMATED QA PENDING |
| Real Android/iPhone visual approval | BLOCKED until owner checks device preview |
| Photoreal Gildan-certified 12-garment photo set | NOT PROVIDED; existing generated illustrations used |
| Actual 300-DPI print master, source photo secure handoff | BLOCKED; not part of this phase |
| Production merge/deployment | BLOCKED until separate explicit approval |

## Release

Keep PR #609 **DRAFT AND UNMERGED**. The existing Cloudflare branch-preview environment is the only deployment target for this phase; a branch preview is not the main live storefront.
