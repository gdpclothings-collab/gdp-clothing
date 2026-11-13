import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { backgroundRemovalCostGate } from '../supabase/functions/remove-photo-background/zero-provider-cost-policy.mjs';
import { EXTERNAL_BACKGROUND_REMOVAL_ENABLED, BACKGROUND_REMOVAL_PAUSED_MESSAGE } from '../src/lib/backgroundRemovalCostPolicy.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('zero-cost policy is hard-locked with no secret, request or environment override', () => {
  assert.equal(EXTERNAL_BACKGROUND_REMOVAL_ENABLED, false);
  assert.match(BACKGROUND_REMOVAL_PAUSED_MESSAGE, /paused.*charges/i);
  const decision = backgroundRemovalCostGate();
  assert.deepEqual(Object.keys(decision).sort(), ['allowed', 'message']);
  assert.equal(decision.allowed, false);
  assert.match(decision.message, /prevent third-party processing charges/i);
  const source = read('../supabase/functions/remove-photo-background/zero-provider-cost-policy.mjs');
  assert.doesNotMatch(source, /Deno\.env|process\.env|localStorage|fetch\(/);
});

test('the Edge Function denies background removal before any quota, storage or paid provider call', () => {
  const source = read('../supabase/functions/remove-photo-background/index.ts');
  const entry = source.indexOf('const costGate = backgroundRemovalCostGate()');
  const rejection = source.indexOf('if (!costGate.allowed)');
  const credentials = source.indexOf('Deno.env.get("REMOVE_BG_API_KEY")');
  const quota = source.indexOf('consumeQuota(service, rule)');
  const storage = source.indexOf('.upload(originalPath, photo');
  const provider = source.indexOf('fetch("https://api.remove.bg/v1.0/removebg"');
  assert.ok([entry, rejection, credentials, quota, storage, provider].every((position) => position >= 0));
  assert.ok(entry < rejection && rejection < credentials && credentials < quota && quota < storage && storage < provider);
  assert.match(source.slice(rejection, credentials), /retryable: false/);
  assert.match(source.slice(rejection, credentials), /originalUnaffected: true/);
  assert.match(source.slice(rejection, credentials), /\}, 503\)/);
  assert.match(source, /if \(req.method === "OPTIONS"\)/);
  assert.match(source, /if \(!isAllowedOrigin\(origin\)\)/);
});

test('browser skips Supabase invocation and legacy automatic processing while lock is active', () => {
  const api = read('../src/lib/customerApi.js');
  const method = api.indexOf('async removePhotoBackground(file)');
  const gate = api.indexOf('if (!EXTERNAL_BACKGROUND_REMOVAL_ENABLED)', method);
  const request = api.indexOf('supabase.functions.invoke("remove-photo-background"', method);
  assert.ok(method >= 0 && gate > method && request > gate);
  assert.match(api.slice(gate, request), /createBackgroundRemovalFailure\(file, BACKGROUND_REMOVAL_PAUSED_MESSAGE, false\)/);

  const studio = read('../src/pages/CustomStudio.jsx');
  assert.match(studio, /if \(EXTERNAL_BACKGROUND_REMOVAL_ENABLED && \(designPath === "bootleg" \|\| designPath === "memorial"\)/);
  assert.match(studio, /if \(!activeUpload\) activeUpload = originalUpload;/);
  assert.match(studio, /autoBackgroundRemoval: EXTERNAL_BACKGROUND_REMOVAL_ENABLED &&/);
  assert.match(studio, /Use Refine manually to erase\/restore/);

  const dtf = read('../src/pages/DTFGangSheet.jsx');
  assert.match(dtf, /disabled=\{editingArtwork \|\| !EXTERNAL_BACKGROUND_REMOVAL_ENABLED\}/);
  assert.match(dtf, /BACKGROUND_REMOVAL_PAUSED_MESSAGE/);
  assert.match(dtf, /Restore original/);
});
