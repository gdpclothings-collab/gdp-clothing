const raw = process.env.TEST_BASE_URL || process.env.PRODUCTION_BASE_URL || "";

if (!raw) {
  console.error("TEST_BASE_URL is required.");
  process.exit(1);
}

let url;
try {
  url = new URL(raw);
} catch {
  console.error(`Invalid staging URL: ${raw}`);
  process.exit(1);
}

if (url.protocol !== "https:") {
  console.error("Staging regression target must use HTTPS.");
  process.exit(1);
}

const host = url.hostname.toLowerCase();
const blockedProductionHosts = new Set([
  "gdpclothing.ca",
  "www.gdpclothing.ca",
  "gdp-clothing.pages.dev",
]);

if (blockedProductionHosts.has(host)) {
  console.error(`Refusing staging regression against production host: ${host}`);
  process.exit(1);
}

const explicitConfirmation = process.env.STAGING_REGRESSION_CONFIRMATION || "";
if (explicitConfirmation !== "RUN_STAGING_REGRESSION") {
  console.error("Staging regression confirmation is missing. Expected RUN_STAGING_REGRESSION.");
  process.exit(1);
}

console.log(`Safe staging target accepted: ${url.origin}`);
