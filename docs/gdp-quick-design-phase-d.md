# GDP Quick Design — Phase D staging implementation (2026-11-22)

Authorization: `AUTHORIZE-GDP-QUICK-DESIGN-PHASE-D-STAGING-V1`.

## Scope and branch safety
- Implemented exclusively in existing development branch `feature/gdp-quick-design-mvp-20261121` / Draft PR #609.
- **NO merge, production deployment, publishing, live customer database write, real order, charge, or paid service.**
- Existing flow stays **Garment → Black/White → Front/Back → Upload → GDP background → Text → Selected preview**. Only the selected print side is rendered.
- Existing 1–5 image upload, source GDP STORM/flame layouts, name/custom-font controls, optional remove.bg with existing quota protection, and quote-request branch lock remain intact.
- No changes to Stripe Live Mode, PST 6%, GST 0%, WELCOME10, order processing, Auth, or backend secrets.

## Implemented
- `src/lib/quickDesignGarmentMockup.js`: maintains the three garment silhouettes and separate front/back details for both black and white. Refines fabric drape, stitch seams, grain, shadows, and softer garment outlines.
- `QUICK_DESIGN_PRINT_PLACEMENTS`: six conservative torso-centered placements. Artwork always preserves image aspect ratio and transparent edges; hoodie front print stops above its pouch.
- Mockup image is rendered at `1200 × 1440` pixels from a logical `600 × 720` drawing to sharpen responsive mobile and desktop presentation. This is **mockup resolution, not print DPI**.
- `src/lib/quickDesignCanvas.js`: reduces distracting GDP SAMPLE watermark opacity and size without removing repetitive preview protection. Artwork is still a watermarked, transparent `750 × 1000` preview.
- `src/pages/QuickDesign.jsx`: improves preview scaling and JPEG output quality and explicitly describes studio-rendered print-placement estimates.
- `scripts/verify-quick-design-mvp.mjs`: adds 12-combination placement tests and protected-preview structural guards.

## Limitations: do not overclaim
- The garment is still a high-detail **studio illustration**, not a verified photograph of a Gildan shirt/sweatshirt/hoodie. Gildan-specific branded color photographs in all twelve variants were not present as approved local assets.
- 12 × 16 inches at 300 DPI requires actual **3600 × 4800 source pixels** and quality review. This Phase D **does not** create or distribute a full-resolution production master, and the customer may only save a watermarked preview.
- Original uploaded photographs and rendered previews are not transferred by the quote-request form; an approved secure handoff remains a release blocker.
- Source pet photos and provider-produced preview-resolution cutouts cannot be assumed 300 DPI, even when mockups are visually sharp.
- The updated design was not run on a physical Android/iPhone in the connector environment. Manual visual quality approval and end-to-end tests remain necessary.

## QA matrix
| Gate | Status | Evidence or remaining action |
| --- | --- | --- |
| All 12 combinations have distinct garment/side/color selection paths | CODE REVIEW | Branch logic and static 12-combination assertions |
| Conservative centered placements and hoodie pouch avoidance | CODE REVIEW | Immutable geometry and static assertions |
| Watermark visible on selected preview, not offered as production file | CODE REVIEW | Protected source art and existing download |
| No new network calls, paid services, backend mutations | CODE REVIEW | Local canvas-only mockup changes |
| Build, lint, typecheck, quick-design static tests | PENDING CI | Review latest GitHub Actions after branch commits |
| Android/iPhone/desktop real rendering, visual comparison, switchover | BLOCKED | Real browsers/device screenshots required |
| Genuine Gildan photorealistic apparel comparison | BLOCKED | Approved exact-variant licensed photos required |
| Full source 300-DPI export and secure original-photo handoff | BLOCKED | Separate fulfillment work and approval |
| Production release | BLOCKED | Explicit separate owner authorization |

**Keep PR #609 Draft. Do not merge or deploy to production.**
