import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSitemapXml, isPublicProduct } from "../functions/sitemap.xml.js";

const contentPage = fs.readFileSync("src/pages/ContentPage.jsx", "utf8");
const productDetail = fs.readFileSync("src/pages/ProductDetail.jsx", "utf8");
const manifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));

assert.match(contentPage, /noindex,follow/, "CMS missing pages must be noindex.");
assert.match(productDetail, /Copy code/, "Product discounts must expose a copy-code control.");
assert.match(productDetail, /Copied ✓/, "Copy-code control must confirm success.");
assert.match(productDetail, /noindex,follow/, "Missing product pages must be noindex.");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, "PWA manifest must include at least one icon.");

assert.equal(isPublicProduct({ slug: "hoodie", tags: [], sales_channels: ["online_store"] }), true);
assert.equal(isPublicProduct({ slug: "hidden", tags: ["custom-studio-only"], sales_channels: ["online_store"] }), false);
assert.equal(isPublicProduct({ slug: "pos-only", tags: [], sales_channels: ["pos"] }), false);
assert.equal(isPublicProduct({ slug: "dtf-gang-sheet", tags: [], sales_channels: ["online_store"] }), false);

const sitemap = buildSitemapXml([
  { slug: "adult-hoodie", updated_at: "2026-10-06T00:00:00.000Z", tags: [], sales_channels: ["online_store"] },
]);
assert.match(sitemap, /https:\/\/gdpclothing\.ca\/products\/adult-hoodie/);
assert.match(sitemap, /<lastmod>2026-10-06T00:00:00\.000Z<\/lastmod>/);
assert.match(sitemap, /https:\/\/gdpclothing\.ca\/custom-studio/);

console.log("PASS storefront SEO and promo-code UX guards");
