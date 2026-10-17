import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GDP_PRODUCTION_ORIGIN, GDP_PAGES_ORIGIN, resolveAdminSmokeOrigin } from "../scripts/admin-smoke-origin.mjs";
import { accessHeadersForRequest } from "../scripts/admin-smoke-cloudflare.mjs";

const app = '<!doctype html><html><head><script type="module" crossorigin src="/assets/index-AbCd1234.js"></script></head><body><div id="root"></div></body></html>';
const chall = '<html><body>Performing security verification. Ray ID: a4c06dfd1b5a9adc Performance and Security by Cloudflare</body></html>';

function getResponse(body, code = 200) {
  return {
    status: code,
    headers: new Map(),
    text: async () => body,
  };
}
function mockFetch({
  prodAdmin = getResponse(chall, 403),
  prod = getResponse(app),
  pages = getResponse(app),
  pagesAdmin = getResponse(app),
} = {}) {
  const calls = [];
  const responses = new Map([
    [GDP_PRODUCTION_ORIGIN + "/admin", prodAdmin],
    [GDP_PRODUCTION_ORIGIN + "/", prod],
    [GDP_PAGES_ORIGIN + "/", pages],
    [GDP_PAGES_ORIGIN + "/admin", pagesAdmin],
  ]);
  return {
    calls,
    fetchImpl: async (url) => {
      calls.push(url);
      if (!responses.has(url)) throw Error("Unexpected external request " + url);
      return responses.get(url);
    },
  };
}

test("Cloudflare WAF challenge selects verified identical first-party Pages artifact", async () => {
  const fake = mockFetch();
  const result = await resolveAdminSmokeOrigin({ fetchImpl: fake.fetchImpl });
  assert.equal(result.baseUrl, GDP_PAGES_ORIGIN);
  assert.equal(result.mode, "identical-production-pages");
  assert.equal(result.challenge.rayId, "a4c06dfd1b5a9adc");
  assert.equal(result.challenge.enforcementPreserved, true);
  assert.ok(result.bundle.endsWith("index-AbCd1234.js"));
  assert.deepEqual(fake.calls.sort(), [
    GDP_PRODUCTION_ORIGIN + "/admin", GDP_PRODUCTION_ORIGIN + "/",
    GDP_PAGES_ORIGIN + "/", GDP_PAGES_ORIGIN + "/admin",
  ].sort());
});

test("Use the real production hostname if no WAF challenge occurred", async () => {
  const fake = mockFetch({prodAdmin:getResponse(app)});
  const result = await resolveAdminSmokeOrigin({fetchImpl:fake.fetchImpl});
  assert.equal(result.baseUrl, GDP_PRODUCTION_ORIGIN);
  assert.equal(result.challenge, null);
  assert.deepEqual(fake.calls, [GDP_PRODUCTION_ORIGIN + "/admin"]);
});

test("Reject stale, altered, challenged and non-app mirrors; do not green-light incorrect deployment", async () => {
  const cases = [
    {pages: getResponse(app.replace("AbCd1234","oldBuild"))},
    {pages: getResponse(app.replace("root","test"))},
    {pagesAdmin: getResponse(chall,403)},
    {prod: getResponse(chall,403)},
    {pagesAdmin: getResponse(app.replace("AbCd1234","oldBuild"))},
    {pages: getResponse(app+"<!-- CDN mutation -->")},
  ];
  for (const fixture of cases) {
    const fake=mockFetch(fixture);
    await assert.rejects(resolveAdminSmokeOrigin({fetchImpl: fake.fetchImpl}), /not identical|BLOCKED/);
  }
});

test("Refuse arbitrary mirror, insecure HTTP, misleading suffixes and redirected admin routes", async () => {
  for (const mirrorUrl of [
    "https://gdp-clothing.pages.dev.attacker.example",
    "http://gdp-clothing.pages.dev",
    "https://gdp-clothing.pages.dev/other",
    "https://gdp-clothing.pages.dev/?token=secret",
  ]) {
    await assert.rejects(resolveAdminSmokeOrigin({ mirrorUrl, fetchImpl: mockFetch().fetchImpl }),
      /trusted HTTPS|exact approved/);
  }
  await assert.rejects(resolveAdminSmokeOrigin({
    fetchImpl: mockFetch({prodAdmin:getResponse("<html>403</html>",403)}).fetchImpl,
  }), /did not serve/);
});

test("Cloudflare Access credentials never reach Pages or Supabase; failed authentication still gates red", () => {
  const secret = {id:"test-client",secret:"test-secret"};
  assert.equal(accessHeadersForRequest(GDP_PAGES_ORIGIN+"/admin",GDP_PRODUCTION_ORIGIN,{},secret),null);
  assert.equal(accessHeadersForRequest("https://mcmancxsqlhxnjhlnfkz.supabase.co/auth/v1/token",GDP_PRODUCTION_ORIGIN,{},secret),null);
  const smoke=fs.readFileSync("scripts/admin-authenticated-smoke.mjs","utf8");
  const workflow=fs.readFileSync(".github/workflows/production-smoke.yml","utf8");
  assert.ok(smoke.includes("resolveAdminSmokeOrigin"));
  assert.ok(smoke.includes("process.exitCode = 1"));
  assert.ok(workflow.includes("Enforce authenticated admin security smoke gate"));
  assert.ok(workflow.includes("GDP_ADMIN_SMOKE_MIRROR_URL"));
});
