# Seasonal artwork in Custom Studio

Choose a garment, colour and size, continue, then choose **Choose a seasonal design**. The seasonal path supports front-only printing, one size/colour per design, quantity, collection/search filters, preview placement, bounded resizing and optional name/message text. Other sizes can be added as separate designs. The existing photo-template flow is unchanged.

## Publishing artwork

Open **Admin → Content → Artwork → Publishing settings**. Upload a transparent production PNG (100 MB and 65 megapixel limits). The master stays unchanged in the private `artwork-production` bucket. Its visible ink bounds determine the preview, aspect ratio and 300 ppi print limits. SVG sources must first be exported to a suitable transparent PNG.

Confirm commercial apparel/POD and online-preview rights and approval of the physical print proof. Choose ready-print, personalization, or both, then enable **Show in Custom Studio** and save. Frames require personalization, not ready-print. Replacing a master resets the print-proof approval and publication setting. Hide artwork by turning off Show in Custom Studio. All original 150 drafts remain hidden until reviewed; none are automatically licensed or activated.

## Orders and production

Seasonal designs use the existing authenticated custom-design/cart/checkout process and trusted garment/variant prices, with no extra seasonal-design fee. Shipping/tax stay in the existing checkout. A production proof is always required.

Database guards validate publication, file availability, source version, print dimensions, aspect ratio, position and allowed text. A saved design's configuration is immutable. Checkout rejects withdrawn or changed designs and garment mismatches. The order receives a snapshot containing artwork ID/title/source hash, private master path, ink bounds, front-print area and placement in inches, text/font/colour and preview. Admin → Custom Studio shows these details and a short-lived private master download. Stored master versions are never overwritten, so older order masters remain available.

The public catalog RPC exposes only approved display fields; the private library and production files remain inaccessible to anonymous users. Conservative print limits are capped by configured garment guides. UI mockups remain an approximation; the production proof is authoritative.

## Verification and rollout

The schema was applied using named Supabase migrations `seasonal_artwork_studio`, `seasonal_required_personalization` and `seasonal_frame_production_placement`. `seasonal-studio.sql` is the consolidated schema reference, not a script to rerun on the live database.

Run `node scripts/verify-seasonal-artwork.mjs`, the existing product-variant, fresh-session and DTF nesting checks, targeted lint and a production build. `scripts/verify-seasonal-database.sql` uses synthetic fixtures in a transaction and rolls back all changes; it checks catalog filtering, saving, immutable snapshots, sizing, source changes, order metadata, withdrawn designs and legacy paths. It does not upload an actual file or charge a payment.

Browser checks cover garment selection, the seasonal entry, the live empty catalog, and a local-only artwork/personalization preview fixture. No real customer checkout or payment is submitted during verification. Current drafts need rights/proof/master review before the first customer design can be ordered.

Rollback: revert the frontend change to remove the entry and publishing controls; hide any published artworks. Leave the additive schema and immutable order snapshots intact for existing production records.
