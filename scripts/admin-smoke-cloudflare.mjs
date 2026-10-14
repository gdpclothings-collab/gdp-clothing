// Cloudflare Access service tokens are origin-scoped. They are not WAF challenge bypasses.
export function accessHeadersForRequest(requestUrl, productionOrigin, originalHeaders, credentials) {
  if (!credentials?.id || !credentials?.secret) return null;
  try {
    const request = new URL(requestUrl);
    const production = new URL(productionOrigin);
    if (request.origin !== production.origin || production.protocol !== "https:" || production.hostname !== "gdpclothing.ca") {
      return null;
    }
    return {
      ...originalHeaders,
      "CF-Access-Client-Id": credentials.id,
      "CF-Access-Client-Secret": credentials.secret,
    };
  } catch {
    return null;
  }
}

export function cloudflareChallengeDetails(bodyText) {
  const body = String(bodyText || "").replace(/\s+/g, " ").trim();
  if (!/performing security verification|protect against malicious bots|performance and security by cloudflare/i.test(body)) {
    return null;
  }
  return {
    reason: "cloudflare-security-verification",
    rayId: body.match(/ray id:\s*([a-f0-9]{12,32})\b/i)?.[1] || null,
  };
}

export function publicPathOnly(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "[invalid-url]";
  }
}
