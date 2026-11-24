# GDP Quick Design — Phase I: large A3-style garment placement

Owner authorization: `AUTHORIZE-GDP-QUICK-DESIGN-PHASE-I-A3-PLACEMENT-STAGING-V1`

## Scope and safeguards

- Existing feature branch `feature/gdp-quick-design-mvp-20261121`; Draft PR #609, **no production merge**.
- Owner's STORM model T-shirt photos are used as visual references for relative print size and upper-chest alignment ONLY. No model photos or reference artwork added to the repo.
- Approved Black/White × Front/Back blank atlas remains primary. No artwork, people, or logos are baked into those blank assets.
- The actual artwork renderer remains unchanged: original uploaded photos/cutouts, 1–5 image slots (a single uploaded composite can itself contain more pets), GDP storm background, chosen fonts/curves, opacity and original transparent edges.
- Repeated SAMPLE watermarks remain removed. No new services, fees, customer file uploads, real orders, Stripe changes, or tax changes (PST 6%, GST 0%).

## Fix: artwork looked too small on the shirt

The earlier layout centered the visible alpha content in a narrow zone, even though the artwork was A3-proportioned. A3 pixels alone did not determine visual print scale on the mockup.

`src/lib/quickDesignGarmentMockup.js` now uses wider and taller print zones calibrated to the owner-uploaded STORM print appearance:

| Garment | Front and back visible print zone on 600 × 720 mockup | Previous zone | Practical limit |
| --- | --- | --- | --- |
| T-shirt | (170, 151, 260, 340) | (203, 195, 194, 245) | Torso side seams / hem |
| Sweatshirt | (177, 161, 246, 314) | (208, 205, 184, 240) | Chest panel / waistband |
| Hoodie | (185, 185, 230, 268) | (209, 212, 182, 202) | Kangaroo pocket / drawstrings |

The STORM headline now appears more prominently across the upper chest, with the intact photo grouping below it. The alpha-content balancing fitter centers the actual visible design, not empty transparent margins. Both garment sides use the same coordinates for the same type.

The print preview receives the chosen garment size:
- XS: 78% of the maximum visual print zone
- S: 90%
- M–3XL: 100% of the **mockup-capped** maximum zone, no speculative enlargement from a single-size blank photo

Changing the request size rerenders the garment preview. This is a conservative visual comparison only, NOT a calibrated manufacturer size photograph or actual cutting/printing guide.

## A3 vs physical garment size

A3 portrait target is **297 × 420 mm**, at 300 PPI approximately **3508 × 4961 pixels**. That canvas resolution continues from Phase H.

**A3 is the artwork design target, not a promise that an entire 297 × 420 mm transfer fits every size or hoodie pocket.** Small garments and the hoodie visualizer scale down to remain within the reasonable print region. Original photo resolution and actual printable-area measurements must be verified at GDP production time. The fixed studio render cannot certify chest width, product model, physical DTF film, cut edges, or fabric stretch.

## Regression gates

- Static assertions for all 12 garment/color/side combinations; expected expanded relative zones; high upper-chest position; no artwork outside torso/pocket; matching front and back positions; XS/S conservative scaling; all available sizes; A3 canvas dimensions.
- Playwright Chromium at 360, 390, 768, and 1280px; independent garment-color-side selector flow; XS→M mockup changes; font curve preview; 1–5 photos; free quota guard; existing cart/back-side test routes.
- GitHub Actions: TypeScript, ESLint, app build, policy, CodeQL, and branch-preview deployment.
- Real Android/iPhone hands-on visual evaluation of owner STORM photos remains an owner approval step. This phase does not publish or upload any original customer photos.

Keep PR #609 **DRAFT / UNMERGED** pending the user's staging visual approval.
