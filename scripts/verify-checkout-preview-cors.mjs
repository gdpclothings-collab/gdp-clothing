import fs from "node:fs";
import assert from "node:assert/strict";

// Exercise the actual allowlist declarations from every checkout/payment Edge Function.
// CORS is not authorization: order tokens, rate limits and server-side payment checks stay separate.
const files = [
  "supabase/functions/payment-session/index.ts",
  "supabase/functions/checkout-gateway/index.ts",
  "supabase/functions/payment-preflight/index.ts",
];

const permitted = [
  "",
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
  "https://gdp-clothing.pages.dev",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "https://6ecdcd4c.gdp-clothing.pages.dev",
  "https://fix-gdp-checkout-confirmatio.gdp-clothing.pages.dev",
];

const rejected = [
  "https://anyone.pages.dev",
  "https://other-store.pages.dev",
  "https://evilgdp-clothing.pages.dev",
  "https://a.b.gdp-clothing.pages.dev",
  "https://abc.gdp-clothing.pages.dev.evil.example",
  "https://gdpclothing.ca.evil.example",
  "http://6ecdcd4c.gdp-clothing.pages.dev",
  "https://6ecdcd4c.gdp-clothing.pages.dev:8443",
  "https://-branch.gdp-clothing.pages.dev",
  "https://branch-.gdp-clothing.pages.dev",
  "null",
];

let samePreviewPattern = null;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const origins = source.match(/const allowedOrigins = new Set\(\[([\s\S]*?)\]\);/);
  const local = source.match(/const localOriginPattern = (\/[^\n]+\/);/);
  const preview = source.match(/const cloudflarePreviewOriginPattern = (\/[^\n]+\/);/);
  const allow = source.match(/function isAllowedOrigin\(origin: string\) \{\s*return ([^\n;]+);/);
  assert.ok(origins && local && preview && allow, `${file}: CORS policy declarations missing`);

  const allowedOrigins = new Function(`return new Set([${origins[1]}]);`)();
  const localOriginPattern = new Function(`return ${local[1]};`)();
  const cloudflarePreviewOriginPattern = new Function(`return ${preview[1]};`)();
  const isAllowedOrigin = new Function(
    "origin", "allowedOrigins", "localOriginPattern", "cloudflarePreviewOriginPattern",
    `return ${allow[1]};`
  );
  const allowed = (origin) => isAllowedOrigin(
    origin, allowedOrigins, localOriginPattern, cloudflarePreviewOriginPattern
  );

  for (const origin of permitted) {
    assert.equal(Boolean(allowed(origin)), true, `${file}: rejected ${origin || "empty server origin"}`);
  }
  for (const origin of rejected) {
    assert.equal(Boolean(allowed(origin)), false, `${file}: unexpectedly allowed ${origin}`);
  }

  assert.equal(
    source.indexOf("if (!isAllowedOrigin(origin))") < source.indexOf('if (req.method === "OPTIONS")'),
    true,
    `${file}: OPTIONS must not bypass the restricted origin check`
  );
  assert.match(source, /"Access-Control-Allow-Origin": origin/, `${file}: reflected allowed origin header missing`);
  assert.doesNotMatch(source, /"Access-Control-Allow-Origin": "\*"/, `${file}: no wildcard allowed`);

  if (samePreviewPattern === null) samePreviewPattern = cloudflarePreviewOriginPattern.source;
  else assert.equal(cloudflarePreviewOriginPattern.source, samePreviewPattern, "Preview rules must match across functions");
}

console.log("GDP preview CORS regression checks passed (3 functions, allowed and rejected origins).");
