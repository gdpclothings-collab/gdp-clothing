import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { approvedMasterFormat, hashQuotaKey, networkHint, readBoundedJson, MAX_BODY_BYTES }
  from '../supabase/functions/seasonal-print-source/policy.mjs';

const source = readFileSync(new URL('../supabase/functions/seasonal-print-source/index.ts', import.meta.url), 'utf8');
const id = '1333031f-439a-47c2-a16c-0ab154f85bc8';
const sha = '2b1c017e78d75dd33836f26d56cafa8f3596efcc32cef6036cc9d195e8928107';

function request(body, headers = {}) {
  return new Request('https://example.test/functions/v1/seasonal-print-source', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body,
  });
}

test('bounded reader permits normal guest batches without an account, and rejects malformed JSON', async () => {
  const ok = await readBoundedJson(request(JSON.stringify({ artworkIds: [id] })));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value.artworkIds, [id]);
  const invalid = await readBoundedJson(request('{invalid'));
  assert.deepEqual(invalid, { ok: false, error: 'Invalid JSON', status: 400 });
});

test('bounded reader prevents oversized streaming payloads even with missing or forged content-length', async () => {
  const over = request(JSON.stringify({ artworkIds: [id], padding: 'a'.repeat(MAX_BODY_BYTES) }), { 'content-length': '1' });
  const result = await readBoundedJson(over);
  assert.deepEqual(result, { ok: false, error: 'Invalid request', status: 413 });
  const exact = await readBoundedJson(request(JSON.stringify({ payload: 'a'.repeat(MAX_BODY_BYTES - 14) })));
  assert.ok(exact.ok || exact.status === 413);
});

test('only identical ID/SHA256 approved production filenames match (no arbitrary paths)', () => {
  assert.equal(approvedMasterFormat({ id, source_sha256: sha, production_path: `${id}_${sha}.png` }), 'png');
  assert.equal(approvedMasterFormat({ id, source_sha256: sha, production_path: `${id}_${sha}.svg` }), 'svg');
  for (const production_path of [
    '../private/secret.png', `another/${id}_${sha}.png`,
    `${id}_${'a'.repeat(64)}.png`, `${id}_${sha}.webp`,
    `${id}_${sha}.png?token=bad`,
  ]) {
    assert.equal(approvedMasterFormat({ id, source_sha256: sha, production_path }), null);
  }
});

test('rate-limit network hints are bounded and hashed; never used as authorization', async () => {
  const ip = networkHint(request('{}', { 'cf-connecting-ip': '198.51.100.10' }));
  assert.equal(ip, '198.51.100.10');
  assert.equal(networkHint(request('{}')), 'unknown');
  assert.equal(networkHint(request('{}', { 'x-forwarded-for': '192.0.2.2, 198.51.100.3' })), '192.0.2.2');
  const hashed = await hashQuotaKey('seasonal:ip:' + ip);
  assert.match(hashed, /^[a-f0-9]{64}$/);
  assert.equal(hashed, await hashQuotaKey('seasonal:ip:' + ip));
  assert.notEqual(hashed, await hashQuotaKey('seasonal:global'));
});

test('route keeps guest access, licensed eligibility, signed-only output and both atomic budgets', () => {
  assert.match(source, /const MAX_SOURCES = 10/);
  assert.match(source, /const EXPIRY_SECONDS = 120/);
  assert.match(source, /allowedOrigin\(origin\)/);
  assert.match(source, /readBoundedJson\(req\)/);
  assert.match(source, /enforceGuestRateLimit\(db, req, origin\)/);
  assert.match(source, /IP_MAX_REQUESTS = 120/);
  assert.match(source, /GLOBAL_MAX_REQUESTS = 5000/);
  assert.match(source, /service_role/i);
  assert.match(source, /consume_background_removal_quota/);
  assert.match(source, /p_cooldown_seconds: 0/);
  assert.match(source, /\.eq\("rights_status", "confirmed"\)/);
  assert.match(source, /\.eq\("studio_visible", true\)/);
  assert.match(source, /\.or\("proof_approved.eq.true,digital_approved.eq.true"\)/);
  assert.match(source, /approvedMasterFormat\(item\)/);
  assert.match(source, /createSignedUrl\(artwork!\.production_path, EXPIRY_SECONDS\)/);
  assert.doesNotMatch(source, /\bcreateSignedUrl\(input/);
  assert.doesNotMatch(source, /body\.production_path|body\.bucket/i);
  assert.doesNotMatch(source, /Deno\.env\.get\("STRIPE_|db\.from\("orders"\)|db\.rpc\("create_checkout/);
  assert.match(source, /if \(error \|\| typeof data\?\.allowed !== "boolean"\) throw/);
});
