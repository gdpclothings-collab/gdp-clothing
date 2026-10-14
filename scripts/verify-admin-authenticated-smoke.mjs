import fs from "node:fs";
import { accessHeadersForRequest, cloudflareChallengeDetails, publicPathOnly } from "./admin-smoke-cloudflare.mjs";

const smoke = fs.readFileSync("scripts/admin-authenticated-smoke.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/production-smoke.yml", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing authenticated admin smoke contract: ${label}`);
  }
}

for (const [needle, label] of [
  ["GDP_ADMIN_SMOKE_EMAIL", "dedicated admin smoke email"],
  ["GDP_ADMIN_SMOKE_PASSWORD", "dedicated admin smoke password"],
  ["GDP_ADMIN_SMOKE_TOTP_SECRET", "optional dedicated TOTP secret"],
  ['getByRole("dialog", { name: "GDP admin search" })', "Global Search dialog check"],
  ['getByRole("button", { name: "Quick Actions" })', "mobile Quick Actions trigger check"],
  ['getByRole("menu", { name: "Admin quick actions" })', "mobile Quick Actions menu check"],
  ['aria-current', "selected navigation semantics check"],
  ['Horizontal overflow', "mobile overflow check"],
]) {
  requireText(smoke, needle, label);
}

for (const [needle, label] of [
  ["GDP_ADMIN_SMOKE_EMAIL: ${{ secrets.GDP_ADMIN_SMOKE_EMAIL }}", "email secret wiring"],
  ["GDP_ADMIN_SMOKE_PASSWORD: ${{ secrets.GDP_ADMIN_SMOKE_PASSWORD }}", "password secret wiring"],
  ["GDP_ADMIN_SMOKE_TOTP_SECRET: ${{ secrets.GDP_ADMIN_SMOKE_TOTP_SECRET }}", "TOTP secret wiring"],
  ["Run authenticated admin smoke", "production smoke step"],
  ["node scripts/admin-authenticated-smoke.mjs", "admin smoke execution"],
]) {
  requireText(workflow, needle, label);
}

if (
  workflow.includes('GDP_ADMIN_SMOKE_PASSWORD: "') ||
  workflow.includes('GDP_ADMIN_SMOKE_TOTP_SECRET: "')
) {
  throw new Error("Admin smoke credentials must never be hard-coded in the workflow.");
}

for (const [needle, label] of [
  ["installCloudflareAccessRoute(context, credentials)", "service-token injection on sign-in"],
  ["installCloudflareAccessRoute(context, cloudflareAccessCredentials())", "service-token injection on each verification context"],
  ["cloudflareChallengeDetails(bodyText)", "Cloudflare challenge detection"],
  ["rayId: authResult.rayId", "Cloudflare Ray ID recorded for event correlation"],
  ["process.exitCode = 1", "fail-closed behavior on blocked auth"],
]) {
  requireText(smoke, needle, label);
}

const cfBody = "gdpclothing.ca Performing security verification This website uses a security service to protect against malicious bots. Ray ID: a4a71bd3f8520cf6 Performance and Security by Cloudflare";
const detected = cloudflareChallengeDetails(cfBody);
if (!detected || detected.rayId !== "a4a71bd3f8520cf6") throw new Error("Cloudflare Ray ID detection must recognize the real blocked admin response.");
if (cloudflareChallengeDetails("Welcome to GDP Commerce Admin") !== null) throw new Error("Successful admin page must never be classified as blocked.");

const credentials = { id: "fixture-id", secret: "fixture-secret" };
const origin = "https://gdpclothing.ca";
const original = { accept: "text/html" };
const inScope = accessHeadersForRequest("https://gdpclothing.ca/admin", origin, original, credentials);
if (inScope?.["CF-Access-Client-Id"] !== credentials.id || inScope?.["CF-Access-Client-Secret"] !== credentials.secret) {
  throw new Error("Access headers must reach only the authorized GDP production origin.");
}
for (const url of [
  "https://gdpclothing.ca.attacker.example/admin",
  "https://api.supabase.co/auth/v1/token",
  "http://gdpclothing.ca/admin",
  "https://www.gdpclothing.ca/admin",
  "not a URL",
]) {
  if (accessHeadersForRequest(url, origin, original, credentials) !== null) throw new Error(`Secret headers leaked to another origin: ${url}`);
}
if (accessHeadersForRequest(origin, origin, original, { id: "", secret: "" }) !== null) throw new Error("No headers without service credentials.");
if (publicPathOnly("https://gdpclothing.ca/admin?token=PRIVATE") !== "/admin") throw new Error("Diagnostic URLs must not expose query secrets.");

console.log("Authenticated admin smoke wiring verified.");
