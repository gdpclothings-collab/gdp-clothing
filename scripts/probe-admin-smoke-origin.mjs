// Read-only Cloudflare Pages origin reachability diagnostic. No login or user data.
import { createHash } from "node:crypto";
const origins = ["https://gdpclothing.ca", "https://gdp-clothing.pages.dev"];
const targets = ["/", "/login?returnTo=%2Fadmin", "/admin"];
const digests = {};
for (const origin of origins) {
  digests[origin] = {};
  for (const route of targets) {
    try {
      const response = await fetch(new URL(route, origin), {
        redirect: "manual",
        signal: AbortSignal.timeout(14000),
        headers: { "user-agent": "GDP-Admin-Release-Verification/1.0" },
      });
      const html = await response.text();
      const challenged = response.headers.get("cf-mitigated") === "challenge" ||
        /performing security verification|performance and security by cloudflare|just a moment|cf-chl/i.test(html);
      const bundle = html.match(/<script[^>]+src=["']([^"']+\/assets\/[a-zA-Z0-9_.-]+\.js)["']/i)?.[1] ||
        html.match(/src=["'](\/assets\/index-[^"']+\.js)["']/i)?.[1] || "";
      const isApp = response.status === 200 && !challenged &&
        /<div id=["']root["']|<div id=["']app["']/i.test(html);
      digests[origin][route] = { code: response.status, challenged, isApp, asset: bundle,
        htmlSha256: isApp ? createHash("sha256").update(html).digest("hex").slice(0,12) : null };
      console.log(JSON.stringify({ origin, route, ...digests[origin][route] }));
    } catch (err) {
      digests[origin][route] = { error: err.cause?.code || err.name };
      console.log(JSON.stringify({ origin, route, error: err.cause?.code || err.name }));
    }
  }
}
const a=digests[origins[0]]["/"], b=digests[origins[1]]["/"];
console.log("SAME_BUILD_ASSETS",Boolean(a.asset && a.asset === b.asset));
console.log("PAGES_ADMIN_UNCHALLENGED",Boolean(digests[origins[1]]["/admin"].isApp));
