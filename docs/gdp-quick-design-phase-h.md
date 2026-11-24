# GDP Quick Design — Phase H (A3, clean preview, visual centering)

Authorization: `AUTHORIZE-GDP-QUICK-DESIGN-PHASE-H-STAGING-V1` (owner subsequently confirmed priorities in same order).

Branch: `feature/gdp-quick-design-mvp-20261121`, Draft PR #609. No merge or production deployment.

## 1 — Remove repeated preview watermark

- Removed the `drawWatermark` overlay and its repeated `GDP CLOTHING • SAMPLE` text from the transparent bootleg artwork renderer.
- The selected blank garment atlas still contains no preprinted artwork or watermark. The customer artwork is composited only when creating the selected mockup.
- Generated preview JPGs are clean. No new QR-code, large logo or diagonal text has been substituted.
- Existing development request-submission disablement, selection gates, safety notices and photo rights checks remain.
- Clean previews are **NOT** verified print masters. They are a layout reference, and original images still need GDP's separate review.

## 2 — A3 portrait dimensions

Changed Quick Design from 12 × 16 in to **A3 portrait: 297 × 420 mm**, or approximately **11.69 × 16.54 in**.

- Lightweight transparent preview: **750 × 1061 pixels**, near A3 aspect ratio.
- Native high-resolution composition code: `renderQuickDesignArtwork({ ...options, outputSize: 'a3' })` produces **3508 × 4961 canvas pixels**, the 300-pixels-per-inch A3 target when printed at 297 × 420 mm.
- This A3 render is opt-in at code level; the customer web UI still generates lightweight previews on demand rather than 17.4-megapixel artwork for each keystroke or exposing a full-resolution master for free.
- The high-resolution composition now draws original user photos and GDP background images into output-scaled intermediate layers; it does not simply resize the finished 750px preview.
- PNGs preserve alpha transparency when serialized from the canvas. Browser PNG DPI metadata is not guaranteed (the print workflow must explicitly set 297 × 420 mm at export/import). User photos/backgrounds may lack native pixels for clean 300-PPI results; no automatic resampling can recreate missing detail.
- A3 is a **layout target**, not a guarantee the printable area on a particular garment physically fits A3. The preview maintains an intentionally smaller, garment-appropriate visual print-zone estimate.

## 3 — Visually center artwork on garment

Previously the mockup centered the entire 750 × 1000 PNG rectangle. If the artwork contained uneven transparent space, text and faces could look left- or right-heavy.

- `measureQuickDesignArtworkContent`: samples the A3 preview's real alpha content, obtains its visible bounding region and adds a small safety gutter to protect glow.
- `getQuickDesignBalancedArtworkPlacement`: preserves the visible content aspect ratio and centers its bounding rectangle in the selected garment's print zone, on both axes.
- Applies to **all 12 combinations** using identical front/back print zones per garment.
- Retains original STORM-inspired center hero, connected 1–5 pet/people faces and GDP storm/flame backgrounds. Does not crop/obscure any visible subject layer.
- Centring means within the safe visible chest/back print zone, not vertically over a hoodie pocket or across garment seams. Printed size requires manual garment-specific approval.

## Safeguards

Existing five-step order remains: garment → Black/White → Front/Back → customization → preview. Keep font-family/curve parity, original backgrounds, optional free-limited remove.bg, customer original photos, cart/request handling, Stripe Live, PST 6%, GST 0% and production data unchanged. Use existing local canvas and approved atlas; no new network services or charges.

## QA gate

- Source-level A3 dimensions, 300-PPI pixel targets, no repeated watermark path, centered alpha-content placement, and 12 garment combination tests.
- GitHub Actions: static-quality, build, CodeQL, browser guards, Cloudflare staging.
- Owner's physical Android/iPhone visual approval remains pending.
- Actual original-photo fidelity at A3 and a customer-to-GDP production-file handoff remain separate quality and fulfillment blockers.

**Do not merge PR #609, publish to production, modify Stripe/taxes or make real customer requests.**
