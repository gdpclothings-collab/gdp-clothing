# GDP Quick Design — Approved Blank Garment Mockup Integration (Phase G)

Owner instruction: "Now we use this into the Garment Preview."

## Approved asset

Source: the **latest fully blank** user-approved image, `a_clean_professional_product_mockup_sheet_on_a_ne.png`, featuring Gildan-inspired black/white T-shirts, crewneck sweatshirts, and hoodies, each shown front and back with **no artwork printed**.

Optimized as `public/images/quick-design/gdp-blank-garment-atlas.webp` (1536 × 720, ~24 KB). The two labeled fabric/marketing rows were excluded; the garment pictures themselves were retained in the same garment, colour, and side order.

The atlas is six columns × two rows: top row Black, bottom row White. Within each row: T-shirt Front/Back, Sweatshirt Front/Back, Hoodie Front/Back.

These are generated showroom references; they are **not** official Michael's, Gildan or other manufacturer photographs or certified fabric/print guide. Original customer-generated artwork remains independent from the blank garment asset.

## Rendering and workflow

`src/lib/quickDesignGarmentMockup.js`:

- Select exactly one of the 12 approved blank garment images using `getQuickDesignBlankGarmentCrop(garment, color, side)`.
- Draw one selected image into the existing responsive 1200 × 1440 output canvas, then separately composite the user's **watermarked** artwork on the chosen side only.
- Front and back artwork coordinates are intentionally identical for each garment type, fulfilling the owner's same-position requirement.
- Black/White colours are distinct real image regions; no CSS recolouring of one colour into another.
- Preserve original locally generated garment rendering and Custom Studio crewneck SVG as **offline/image-failure fallback only**.
- Preserve garment → colour → front/back → photo/customization → preview selection order; no automatic two-sided purchase.
- No new external requests, services or charges, and no changes to Stripe, Supabase, PST 6%, GST 0%, customer data, checkout or production.

## Important limitations

- This original generated **sheet** has 1536 × 1024 pixels shared across 12 views; each selected garment region has about 256 × 360 source pixels. The optimized asset keeps those pixel dimensions. The 1200 × 1440 canvas is a high-resolution **preview upscaled from smaller source crops**, not a high-resolution manufacturer apparel photograph.
- The mockup is never a print master; watermarked original design preview is composited only for review. Customer source photos remain required for GDP's actual print workflow and approved 300-DPI production output.
- The clothing in this user-approved composite is generic Gildan-inspired imagery. Exact models, fibre blends, weights and size-dependent proportions are not verified.
- On white or black garments, visible simulated folds/lighting may vary from the garments delivered.
- Real Android/iPhone/desktop screenshots should be reviewed before production launch.

## Required QA gates

- GitHub Actions static, build and browser checks on Draft PR #609.
- 12 unique mappings; valid WebP RIFF header; all source crop coordinates in range.
- Exact same front/back artwork placement per garment; one selected side visible.
- White garment physically lighter than Black garment, and front/back visually differ.
- Verify fallback renderer when asset unavailable.
- No merge or production deploy; keep PR #609 Draft until separate owner authorization.

**Status: Development branch only.**
