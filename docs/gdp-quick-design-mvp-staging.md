# GDP Quick Design MVP - staging only

## Purpose
Offer Facebook Marketplace customers two instant, watermarked bootleg layout previews without manual Photoshop preparation or paid AI usage.

## Implemented in this branch
- Guest-friendly /quick-design route and responsive storefront navigation.
- 1-5 local JPG/PNG/WebP photos with 10 MB per-file limit.
- Eight GDP Photo Bootleg background images from public/images/gdp-styles.
- Editable headline, subtitle, and accent color.
- Two deterministic photo-collage layouts rendered in the browser.
- Watermarked artwork previews, black unisex T-shirt illustrations, sample selection, watermarked download and mobile native share where supported.
- Contact form, shirt size, quantity, rights acknowledgment, and quote-request submission through the existing submit-sales-lead endpoint and its server-side IP rate limit.
- No new dependencies, migrations, bucket grants, payment methods, tax settings, paid APIs or subscriptions.

## Limits that must be communicated accurately
- **Original photos and generated previews are not uploaded by this quote form.** Only design settings, selection and contact details are sent. Customers share original photo files separately.
- No automatic photo-background removal. PNG transparency is respected when present.
- Watermarked 750x1061 preview is not an A3 300-DPI print master. Production export must remain behind the existing controlled purchase/approval workflow.
- Illustrative shirt vector is not a verified Gildan photo, and exact placement remains a final GDP review task.
- Submitting a request is not a purchase, invoice or payment.
- The existing server function may refuse unapproved Cloudflare branch-preview Origin headers. Testing must not alter production CORS configuration without separate approval.
- No claim of unlimited hosting, storage, or backend usage. Local canvas work has no per-sample paid AI fees, but existing service quotas apply.

## QA checklist and release blockers
- [ ] Run npm run test:quick-design, npm run typecheck, npm run lint, npm run build.
- [ ] Desktop and Android real-device tests: image types, uploads, editing, removal, reset and two distinct samples.
- [ ] Test all eight backgrounds without image cropping/distortion and all transparent PNG paths.
- [ ] Validate file-size limits and maximum photo count.
- [ ] Confirm watermarks on both artwork and mockups, including downloaded files.
- [ ] Confirm original image bytes are never sent to the quote endpoint.
- [ ] Test Android native share and unsupported-browser fallback.
- [ ] Test backend quote submission using a separate approved Origin and isolated test data. Confirm data appears in admin Sales Leads.
- [ ] Confirm zero changes to existing Custom Studio, orders, Stripe Live Mode, PST 6%, GST 0%.
- [ ] Establish protected source-photo handoff and actual 300-DPI print quality before a full production release.

**DRAFT PR ONLY. NO MERGE, PRODUCTION DEPLOYMENT, PAID SERVICE OR LIVE DATA CHANGES.** Production release requires separate explicit owner authorization and completed QA. Do not invent a preview URL.


## No-extra-charge customer assistance update
- Accessible **Help with my design** button in the header and **Need design help?** in the request section. Opens a responsive local modal with five common questions and a quick-start guide.
- Customer can copy a plain-text summary of current design settings and open the existing GDP contact page in a separate tab. The modal does **not** collect or transmit photos, open a paid AI conversation, or submit a lead.
- Five distinct no-cost, OFL-licensed Google Fonts (Anton, Bebas Neue, Graduate, Bangers, Rye) load through the already permitted Google Fonts hosts. System font fallbacks are used if unavailable. No paid font subscription.
- Intended print layout is now **12 × 16 inches**. Browser preview aspect is 750 × 1000, **not** a print-ready file; the theoretical 300-DPI target is 3600 × 4800. Original GDP template files remain unchanged; preview uses canvas scaling.
- Forced **CUSTOM BOOTLEG** subtitle removed; optional subtitle remains blank when blank.
- Background removal is an optional, experimental ONNX model running **on the customer's device** after downloading its open weights. This is not a ChatGPT/OpenAI API, not a hosted AI generation feature, and not a paid remove.bg service. Source originals stay local. High mobile download size, model-host quotas, support for customer devices, subject edge quality, and CDN/CSP require real-device QA before launch.
- Development Cloudflare preview **does not submit sales leads**. The actual production handoff is blocked pending approval, secure source-image transfer and real end-to-end tests.

Additional QA:
- [ ] Help opens from both positions, closes by Escape and Close, traps keyboard focus, and preserves selected template, photos, name and chosen sample.
- [ ] Contact GDP opens the existing public contact page in a new tab; no outbound request is sent automatically.
- [ ] Copy details gives a useful summary without customer photo bytes, signed URLs or secrets.
- [ ] Five fonts appear distinctly on Android; straight/upward/downward name curves remain legible.
- [ ] Measure local model download, privacy, masking quality, and error fallback on real Android phone. Test with cats/dogs, humans, dark hair/fur and low-contrast backgrounds.
- [ ] Confirm all CI checks PASS on PR #609 before seeking any live merge or release.

**Release gate stays CLOSED.** No paid API usage, customer charges, automatic PR merge or live deployment is authorized by this phase.
