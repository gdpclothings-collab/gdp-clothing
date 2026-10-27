import assert from "node:assert/strict";
import fs from "node:fs";

const contentPage = fs.readFileSync("src/pages/ContentPage.jsx", "utf8");
const productDetail = fs.readFileSync("src/pages/ProductDetail.jsx", "utf8");
const manifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));

assert.match(contentPage, /noindex,follow/, "CMS missing pages must be noindex.");
assert.match(productDetail, /Copy code/, "Product discounts must expose a copy-code control.");
assert.match(productDetail, /Copied ✓/, "Copy-code control must confirm success.");
assert.match(productDetail, /noindex,follow/, "Missing product pages must be noindex.");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, "PWA manifest must include at least one icon.");

const sitemap = fs.readFileSync("public/sitemap.xml", "utf8");
const robots = fs.readFileSync("public/robots.txt", "utf8");
assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.ok(sitemap.trim().endsWith("</urlset>"), "Static sitemap must end with the closing urlset.");
assert.match(robots, /^Sitemap: https:\/\/gdpclothing\.ca\/sitemap\.xml$/m);

const expectedPaths = [
  "/",
  "/shop",
  "/custom-studio",
  "/custom-orders",
  "/dtf",
  "/products/dtf-gang-sheet",
  "/products/kids-custom-tee",
  "/products/sometimes-all-we-need-is-a-hug-adult-short-sleeve-tee",
  "/faq",
  "/pages/about",
  "/pages/contact",
  "/pages/shipping-delivery",
  "/pages/returns-refunds",
  "/pages/privacy",
  "/pages/terms",
];
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
assert.deepEqual(
  sitemapUrls,
  expectedPaths.map((path) => `https://gdpclothing.ca${path}`),
  "Static sitemap must contain exactly the approved canonical URLs.",
);

console.log("PASS storefront SEO and promo-code UX guards");
