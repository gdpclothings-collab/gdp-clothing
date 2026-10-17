import { createHash } from "node:crypto";
import { cloudflareChallengeDetails } from "./admin-smoke-cloudflare.mjs";

export const GDP_PRODUCTION_ORIGIN = "https://gdpclothing.ca";
export const GDP_PAGES_ORIGIN = "https://gdp-clothing.pages.dev";

function normalizeStrictOrigin(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      (url.pathname !== "/" && url.pathname !== "") || url.port) throw Error("Invalid smoke origin");
    return url.origin;
  } catch {
    throw new Error("The admin smoke origin must be a trusted HTTPS site origin.");
  }
}

async function documentAt(url, fetchImpl) {
  const response = await fetchImpl(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
    headers: { "cache-control": "no-cache" },
  });
  const body = await response.text();
  const details = cloudflareChallengeDetails(body);
  const challenged = response.headers.get("cf-mitigated") === "challenge" ||
    Boolean(details) || /cf-chl|just a moment/i.test(body);
  return { code: response.status, body, challenged, rayId: details?.rayId || null };
}

function extractBundle(document) {
  if (document.code !== 200 || document.challenged ||
    !/<div id=["']root["']/i.test(document.body)) return null;
  const asset = document.body.match(/<script[^>]+src=["'](\/assets\/index-[a-zA-Z0-9_-]+\.js)["']/i)?.[1] || "";
  return asset.startsWith("/assets/index-") ? asset : null;
}

export async function resolveAdminSmokeOrigin({
  productionUrl = GDP_PRODUCTION_ORIGIN,
  mirrorUrl = GDP_PAGES_ORIGIN,
  fetchImpl = fetch,
} = {}) {
  const production = normalizeStrictOrigin(productionUrl);
  const mirror = normalizeStrictOrigin(mirrorUrl);
  if (production !== GDP_PRODUCTION_ORIGIN || mirror !== GDP_PAGES_ORIGIN) {
    throw new Error("Admin smoke WAF-safe origin must use the exact approved GDP production and Cloudflare Pages hostnames.");
  }

  // Always test the actual production hostname first. A 403 challenge on
  // /admin is expected when GitHub-hosted browsers are classified as bots.
  const admin = await documentAt(`${production}/admin`, fetchImpl);
  if (!admin.challenged) {
    if (admin.code !== 200 || !extractBundle(admin)) {
      throw new Error("Production admin did not serve the expected application; refusing to mark smoke healthy.");
    }
    return { baseUrl: production, mode: "production", challenge: null };
  }

  // WAF enforcement remains intact on the live custom domain. Run the real
  // authenticated admin browser test on the FIRST-PARTY Pages-hosted identical
  // build. A stale/mismatched build, or a challenged mirror, FAILS CLOSED.
  const [productionHome, mirrorHome, mirrorAdmin] = await Promise.all([
    documentAt(`${production}/`, fetchImpl),
    documentAt(`${mirror}/`, fetchImpl),
    documentAt(`${mirror}/admin`, fetchImpl),
  ]);
  const prodBundle = extractBundle(productionHome);
  const mirrorBundle = extractBundle(mirrorHome);
  const adminBundle = extractBundle(mirrorAdmin);
  if (!prodBundle || !mirrorBundle || prodBundle !== mirrorBundle || adminBundle !== prodBundle ||
      productionHome.body !== mirrorHome.body || mirrorAdmin.body !== mirrorHome.body) {
    throw new Error("Cloudflare Pages admin mirror is not identical to the deployed GDP production build. Authenticated smoke BLOCKED.");
  }

  return {
    baseUrl: mirror,
    mode: "identical-production-pages",
    challenge: {
      reason: "cloudflare-security-verification",
      rayId: admin.rayId,
      productionPath: "/admin",
      enforcementPreserved: true,
    },
    bundle: prodBundle,
    buildDigest: createHash("sha256").update(productionHome.body).digest("hex").slice(0, 16),
  };
}
