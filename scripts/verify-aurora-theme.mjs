import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AURORA_IMAGES, auroraCategoryAsset, auroraOccasionAsset, auroraPromoAsset } from "../src/lib/auroraTheme.js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const assets = Object.values(AURORA_IMAGES);
assert.equal(assets.length, 19, "Expected exactly 19 promotional assets");
assert.equal(new Set(assets).size, assets.length, "Promotional paths should be unique");

let totalBytes = 0;
for (const asset of assets) {
  assert.match(asset, /^\/images\/aurora\/[a-z_]+\.webp$/);
  const absolutePath = resolve(projectRoot, "public", asset.slice(1));
  const bytes = readFileSync(absolutePath);
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF", `${asset} is not RIFF`);
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP", `${asset} is not WebP`);
  assert.ok(statSync(absolutePath).size <= 300_000, `${asset} is too large for the optimized promotional pack`);
  totalBytes += bytes.byteLength;
}
assert.ok(totalBytes < 3_000_000, "The 19-image pack must stay under 3 MB total");

assert.equal(auroraCategoryAsset("/shop?category=T-Shirt"), AURORA_IMAGES.tees);
assert.equal(auroraCategoryAsset("/shop?category=Hoodie"), AURORA_IMAGES.hoodies);
assert.equal(auroraCategoryAsset("/shop?view=collections"), AURORA_IMAGES.collections);
assert.equal(auroraCategoryAsset("/custom-studio"), AURORA_IMAGES.custom);
for (const kind of ["love", "family", "memorial", "sports", "events", "pets"]) {
  assert.equal(auroraOccasionAsset(`/custom-studio?occasion=${kind}`), AURORA_IMAGES[kind]);
}
assert.equal(auroraPromoAsset("/custom-studio"), AURORA_IMAGES.custom);
assert.equal(auroraPromoAsset("/pages/about"), AURORA_IMAGES.aboutHero);
assert.equal(auroraPromoAsset("/shop"), AURORA_IMAGES.shopHero);
assert.equal(auroraCategoryAsset("/shop?category=Unmapped"), null, "Unmapped categories retain their CMS imagery");

console.log(`PASS: 19 valid optimized WebP assets (${(totalBytes / 1_000_000).toFixed(2)} MB) and non-destructive route mappings`);
