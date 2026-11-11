# GDP Aurora Streetwear V1 — isolated preview notes

This branch is presentation-only. **Never merge or deploy without KYU's explicit approval.** No paid dependencies, storage changes, checkout changes, tax changes, environment changes, backend migrations, or live content writes are included.

## 19-image campaign set

All assets are locally hosted, optimized WebP files in `public/images/aurora/`, totaling under 3 MB. Original GDP logo, the real product gallery photographs, original static media, and CMS values remain in place. The new AI-generated imagery is illustrative campaign artwork; it is **not** a substitute for real customer photos, actual completed orders, product proofs, or printing specifications.

| Section | Assets |
| --- | --- |
| Home | `home_hero.webp` |
| Shop / collections | `shop_hero.webp`, `category_collections.webp` |
| Category promos | `category_tees.webp`, `category_hoodies.webp`, `category_custom.webp` |
| Custom Studio | `studio_hero.webp` |
| DTF | `dtf_hero.webp` |
| About / Contact / FAQ / Shipping | `about_hero.webp`, `contact_hero.webp`, `faq_hero.webp`, `shipping_support.webp` |
| Occasions | `occasion_love.webp`, `occasion_family.webp`, `occasion_memorial.webp`, `occasion_sports.webp`, `occasion_events.webp`, `occasion_pets.webp` |
| Shared footer / final CTA | `footer_ambient.webp` |

The homepage presentation only substitutes known default hero, category and campaign images. Customized CMS image URLs are intentionally preserved. Category imagery remains decorative; all real catalogue photos in product listings and product pages are untouched. DTF printer/editor images and garment/design proof surfaces are untouched.

## Scope and design

- Scoped `.gdp-aurora-theme` CSS restricts the black, neon-lime, hot-pink, aurora-green/violet design layer to storefront-specific marketing sections, active navigation, and footer.
- Home, Shop and collections, Custom Studio promotional header, DTF, About, Contact, FAQ, Shipping and shared supporting footer get matching artwork.
- Existing desktop/mobile navigation, authentication, product data, cart, customer messaging, consent, and checkout components are reused without behavioral modification.
- Decorative images use empty alt text. Below-fold promotional images are lazily loaded, while the home hero receives high fetch priority. A reduced-motion media query limits decorative motion.
- Test mobile, tablet, and desktop viewport widths before any release. Preview services may show a static frontend while live dynamic data remains unavailable or guarded; **do not submit real orders** during QA.

## Release gate

1. Check the isolated branch's build, ESLint, TypeScript and `node scripts/verify-aurora-theme.mjs`.
2. Verify product variant, DTF nesting, Memorial Tribute, fresh-session and PST-only safeguard regression tests.
3. Visual and keyboard checks at 390px, 768px, and 1440px across all updated routes. Review the existing logo, category cards, keyboard focus and text contrast, including mobile navigation and real product galleries.
4. In a safe test/sandbox environment, confirm cart and checkout without submitting an actual charge, especially Saskatchewan 6% PST and zero GST. No tax/payment configuration edits are permitted.
5. Record a branch preview URL and pass/block report. Release requires KYU's explicit final approval.
