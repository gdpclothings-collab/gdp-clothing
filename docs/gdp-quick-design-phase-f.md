# GDP Quick Design — Phase F Staging: Connected Bootleg Collage + Custom Studio Fabric

Authorization: `AUTHORIZE-GDP-QUICK-DESIGN-PHASE-F-STAGING-V1`
Priority: 1) balanced, closely grouped photos; 2) reuse existing Custom Studio fabric assets whenever compatible.

## Isolation and cost guard

- Branch: `feature/gdp-quick-design-mvp-20261121`, Draft PR #609.
- No merge, publish to production, paid service, actual purchase, live order, Stripe/tax change, database write or new integration.
- Existing 5-step flow, one selected color/side preview, original GDP backgrounds, curved name preview, and opt-in guarded remove.bg remain unchanged.
- The developer preview is a staging artifact only, not `gdpclothing.ca`.

## Photo composition changes

`src/lib/quickDesignPhaseCLayout.js` now arranges 1–5 uploaded photos in a centered, connected cluster:
- One: a prominent full subject.
- Two: overlapping diagonal pair, balanced across the print area.
- Three: center hero and symmetric lower-left/lower-right support subjects.
- Four: the connected trio plus one center foreground subject.
- Five: the trio plus paired, touching lower foreground subjects.

The arrangement uses deliberate overlap in the lower body/paws to avoid isolated floating photo islands. It preserves the STORM name at top and original selected GDP storm/flame effects behind/below photos. Each photo maintains original aspect ratio, the main subject can be changed using the star, and no later photo **box** covers an earlier photo's upper-middle face-priority rectangle.

**Limits:** This is static layout geometry, not trained pet or human face detection. For transparent cutouts with unusually large negative space or source photos showing several/distant/off-center faces, touching bounding boxes do not guarantee that visible photo silhouettes touch. Customers should review their actual preview for facial visibility and desired closeness.

## Existing fabric assets reused

**YES: reused official repo-local Custom Studio Gildan crewneck front/back Black/White SVG templates:**
- `public/images/custom-studio/gildan-crewneck-front-colors.svg`
- `public/images/custom-studio/gildan-crewneck-back-colors.svg`

On a sweatshirt selection, the app loads the correct local SVG `#black` / `#white` variant, composes it with gentle local texture/shadow treatment, and overlays the same selected artwork at a conservative centered print position. If a local asset fails to load, it falls back to the current on-device renderer.

**T-shirt and hoodie:** The repository does not currently include matching approved front/back Black/White standalone garment photos or templates for these types. Their already existing high-density `1200 × 1440` canvas models remain, with Phase E micro-weave, creases, stitching, and shadowing. No incorrect sweatshirt photo has been passed off as a T-shirt/hoodie image.

All are **illustrative display previews** (not verified manufacturer photographs, print-area guarantees, or 300-DPI production files).

## Automated QA

- Pure geometry: every 2–5 layout is a single connected group, optically centered, and later-painted slot rectangles avoid earlier face-priority regions; preserve 1–5 image coverage and no image stretch/crop.
- Asset guard: four crewneck Black/White/front/back paths point to existing Custom Studio files; T-shirt/hoodie remain local.
- Playwright: 360, 390 and 1280px; 12 garment/color/side permutations; source photo count changes; curved font previews; main-photo selection; same-origin SVG Black vs White fabric brightness; no real remove.bg calls or customer uploads.
- TypeScript, ESLint, build, security and browser regression jobs in existing CI.

## Release gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Connected 1–5 photo geometry | PENDING latest CI | Static assertions |
| 12 garment permutations | PENDING latest CI | Chromium smoke |
| Crewneck SVG color rendering, local fallback | PENDING latest CI | Black/White pixel test |
| Staging page deployment | PENDING latest Cloudflare check | Commit-specific preview |
| Manual Android/iPhone/tablet design quality | BLOCKED | Owner screenshots |
| Genuine matching manufacturer photos for T-shirt and hoodie | BLOCKED | Assets not in repo |
| Final unwatermarked 300-DPI production file | BLOCKED | Separate export/fulfilment scope |
| Production merge | BLOCKED | Separate owner approval |

The source preview stays watermarked. No final print master can be inferred from the rendered mockup. Do not merge PR #609.
