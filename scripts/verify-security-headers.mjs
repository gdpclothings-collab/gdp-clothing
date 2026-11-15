import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function headerValue(name) {
  const matches = headers.split(/\r?\n/).filter((line) => line.trim().toLowerCase().startsWith(name.toLowerCase() + ":"));
  assert.equal(matches.length, 1, `Expected exactly one ${name} header`);
  return matches[0].trim().slice(name.length + 1).trim();
}

const csp = new Map(
  headerValue("Content-Security-Policy")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...values] = part.split(/\s+/);
      return [name, values];
    }),
);

function requireDirective(name, ...values) {
  assert.ok(csp.has(name), `CSP directive missing: ${name}`);
  for (const value of values) {
    assert.ok(csp.get(name).includes(value), `CSP ${name} missing ${value}`);
  }
}

assert.match(headers, /^\/\*\r?\n/, "Cloudflare Pages wildcard header rule must remain");
assert.equal(headerValue("X-Content-Type-Options"), "nosniff");
assert.equal(headerValue("X-Frame-Options"), "DENY");
assert.equal(headerValue("X-Permitted-Cross-Domain-Policies"), "none");
assert.ok(headerValue("Strict-Transport-Security").includes("max-age=31536000"));
requireDirective("default-src", "'self'");
requireDirective("base-uri", "'self'");
requireDirective("object-src", "'none'");
requireDirective("frame-ancestors", "'none'");
requireDirective("script-src-attr", "'none'");
requireDirective("manifest-src", "'self'");
requireDirective("script-src", "'self'", "https://js.stripe.com");
requireDirective("frame-src", "https://js.stripe.com", "https://hooks.stripe.com");
requireDirective("connect-src", "https://*.supabase.co", "https://api.stripe.com");
requireDirective("style-src", "'self'", "https://fonts.googleapis.com");
assert.ok(csp.has("upgrade-insecure-requests"), "HTTPS upgrade directive must remain");

assert.match(html, /<script\s+type="module"\s+src="\/src\/main\.jsx"/);
assert.ok(
  !/<(?:body|img|iframe|script|svg|button|input|form)\b[^>]*\s(?:onclick|onload|onerror|onmouseover|onfocus)\s*=/i.test(html),
  "Inline HTML event handlers conflict with script-src-attr none",
);

console.log("PASS: GDP Cloudflare security headers, CSP and Stripe/Supabase source allowances");
