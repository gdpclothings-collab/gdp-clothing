import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  authorizeGuestUploadProof,
  authorizeGuestMockupBinding,
  hashGuestUploadProof,
  newGuestUploadProof,
  validGuestUploadPath,
  verifyGuestDesignArtifactProofs,
} from '../supabase/functions/checkout/guest-upload-authorization.mjs';
import { guestUploadProofForPath, guestUploadProofsForDesign, rememberGuestUploadProof } from '../src/lib/guestUploadProofs.js';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const design = '33333333-3333-4333-8333-333333333333';
const front = `guest/${a}/front.png`;
const back = `guest/${b}/back.png`;
const print = `guest/${a}/production-300dpi.png`;
const backPrint = `guest/${b}/back-production-300dpi.png`;
const source = `guest/${b}/source.png`;
const proofA = 'a'.repeat(64);
const proofB = 'b'.repeat(64);
const proofPrint = 'c'.repeat(64);
const proofBackPrint = 'e'.repeat(64);
const proofSource = 'd'.repeat(64);
const token = '44444444-4444-4444-8444-444444444444';
const expiresAt = '2090-01-01T00:00:00.000Z';

function serviceFixture({ expired = false, revoked = [], denied = [] } = {}) {
  const data = {
    guest_custom_upload_grants: {
      [front]: { proof_hash: 'pendingA', purpose: 'mockup', expires_at: expired ? '2000-01-01T00:00:00.000Z' : expiresAt },
      [back]: { proof_hash: 'pendingB', purpose: 'mockup', expires_at: expiresAt },
      [print]: { proof_hash: 'pendingPrint', purpose: 'production', expires_at: expiresAt },
      [backPrint]: { proof_hash: 'pendingBackPrint', purpose: 'production', expires_at: expiresAt },
      [source]: { proof_hash: 'pendingSource', purpose: 'source', expires_at: expiresAt },
    },
    guest_design_sessions: [{ design_id: design, token_hash: 'pendingToken', expires_at: expiresAt, converted_at: null }],
    guest_custom_mockup_bindings: [
      { design_id: design, side: 'front', path: front },
      { design_id: design, side: 'back', path: back },
    ],
  };
  return Promise.all([hashGuestUploadProof(proofA), hashGuestUploadProof(proofB), hashGuestUploadProof(proofPrint), hashGuestUploadProof(proofBackPrint), hashGuestUploadProof(proofSource), hashGuestUploadProof(token)])
    .then(([hashA, hashB, hashPrint, hashBackPrint, hashSource, hashToken]) => {
      data.guest_custom_upload_grants[front].proof_hash = hashA;
      data.guest_custom_upload_grants[back].proof_hash = hashB;
      data.guest_custom_upload_grants[print].proof_hash = hashPrint;
      data.guest_custom_upload_grants[backPrint].proof_hash = hashBackPrint;
      data.guest_custom_upload_grants[source].proof_hash = hashSource;
      data.guest_design_sessions[0].token_hash = hashToken;
      for (const path of revoked) if (data.guest_custom_upload_grants[path]) data.guest_custom_upload_grants[path].revoked_at = new Date().toISOString();
      const service = { from(table) {
        const filters = [];
        const query = {
          select() { return this; },
          eq(column, value) { filters.push([column, value]); return this; },
          async maybeSingle() {
            if (denied.includes(table)) return { data: null, error: new Error('fixture permission failure') };
            const rows = Array.isArray(data[table]) ? data[table] : Object.entries(data[table] || {}).map(([path, value]) => ({ path, ...value }));
            return { data: rows.find((row) => filters.every(([column, value]) => row[column] === value)) || null, error: null };
          },
        };
        return query;
      } };
      return { service, data };
    });
}

test('upload capabilities are unpredictable 256-bit values and cannot be derived from path UUID', () => {
  const first = newGuestUploadProof();
  const second = newGuestUploadProof();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.doesNotMatch(first, new RegExp(a));
});

test('missing, borrowed, malformed and wrong-purpose proofs deny URL signing', async () => {
  const { service } = await serviceFixture();
  for (const proof of ['', proofB, 'not-a-proof']) {
    assert.equal(await authorizeGuestUploadProof(service, { path: front, proof, purpose: 'mockup' }), false);
  }
  assert.equal(await authorizeGuestUploadProof(service, { path: print, proof: proofPrint, purpose: 'mockup' }), false);
  assert.equal(await authorizeGuestUploadProof(service, { path: source, proof: proofSource, purpose: 'production' }), false);
  assert.equal(await authorizeGuestUploadProof(service, { path: `guest/${a}/../front.png`, proof: proofA, purpose: 'mockup' }), false);
});

test('valid ownership proofs authorize each distinct front/back mockup only', async () => {
  const { service } = await serviceFixture();
  assert.equal(await authorizeGuestUploadProof(service, { path: front, proof: proofA, purpose: 'mockup' }), true);
  assert.equal(await authorizeGuestUploadProof(service, { path: back, proof: proofB, purpose: 'mockup' }), true);
  assert.equal(await authorizeGuestUploadProof(service, { path: front, proof: proofB, purpose: 'mockup' }), false);
});

test('expired, revoked, or database-unavailable proof fails closed', async () => {
  assert.equal(await authorizeGuestUploadProof((await serviceFixture({ expired: true })).service, { path: front, proof: proofA, purpose: 'mockup' }), false);
  assert.equal(await authorizeGuestUploadProof((await serviceFixture({ revoked: [front] })).service, { path: front, proof: proofA, purpose: 'mockup' }), false);
  await assert.rejects(authorizeGuestUploadProof((await serviceFixture({ denied: ['guest_custom_upload_grants'] })).service, { path: front, proof: proofA, purpose: 'mockup' }), /permission failure/);
});

test('approved design token binds the exact side and path, not an arbitrary guest URL', async () => {
  const { service } = await serviceFixture();
  const valid = { designId: design, guestDesignToken: token };
  assert.equal(await authorizeGuestMockupBinding(service, { ...valid, path: front, side: 'front' }), true);
  assert.equal(await authorizeGuestMockupBinding(service, { ...valid, path: back, side: 'back' }), true);
  assert.equal(await authorizeGuestMockupBinding(service, { ...valid, path: back, side: 'front' }), false);
  assert.equal(await authorizeGuestMockupBinding(service, { ...valid, path: print, side: 'front' }), false);
  assert.equal(await authorizeGuestMockupBinding(service, { ...valid, path: front, side: 'sideways' }), false);
  assert.equal(await authorizeGuestMockupBinding(service, { ...valid, path: front, side: 'front', designId: a }), false);
  assert.equal(await authorizeGuestMockupBinding(service, { ...valid, path: front, side: 'front', guestDesignToken: b }), false);
});

test('design token cannot bypass revoked, expired, or wrong-purpose upload grant', async () => {
  const { service, data } = await serviceFixture();
  const request = { designId: design, guestDesignToken: token, path: front, side: 'front' };
  assert.equal(await authorizeGuestMockupBinding(service, request), true);
  data.guest_custom_upload_grants[front].revoked_at = new Date().toISOString();
  assert.equal(await authorizeGuestMockupBinding(service, request), false);
  delete data.guest_custom_upload_grants[front].revoked_at;
  data.guest_custom_upload_grants[front].expires_at = '2000-01-01T00:00:00.000Z';
  assert.equal(await authorizeGuestMockupBinding(service, request), false);
  data.guest_custom_upload_grants[front].expires_at = expiresAt;
  data.guest_custom_upload_grants[front].purpose = 'production';
  assert.equal(await authorizeGuestMockupBinding(service, request), false);
  data.guest_custom_upload_grants[front].purpose = 'mockup';
  delete data.guest_custom_upload_grants[front];
  assert.equal(await authorizeGuestMockupBinding(service, request), false);
  await assert.rejects(authorizeGuestMockupBinding((await serviceFixture({ denied: ['guest_custom_upload_grants'] })).service, request), /permission failure/);
});

test('expired or converted design sessions cannot reauthorize old mockups', async () => {
  const { service, data } = await serviceFixture();
  data.guest_design_sessions[0].expires_at = '2000-01-01T00:00:00.000Z';
  assert.equal(await authorizeGuestMockupBinding(service, { designId: design, guestDesignToken: token, side: 'front', path: front }), false);
  data.guest_design_sessions[0].expires_at = expiresAt;
  data.guest_design_sessions[0].converted_at = new Date().toISOString();
  assert.equal(await authorizeGuestMockupBinding(service, { designId: design, guestDesignToken: token, side: 'front', path: front }), false);
});

test('server rejects cross-guest design-source substitution and production-to-mockup swaps', async () => {
  const { service } = await serviceFixture();
  const valid = { photoPaths: [source], productionFiles: { front: { path: print } }, approvedMockupPaths: { front }, proofs: { [source]: proofSource, [print]: proofPrint, [front]: proofA }, designPath: 'bootleg' };
  assert.deepEqual(await verifyGuestDesignArtifactProofs(service, valid), { ok: true });
  assert.equal((await verifyGuestDesignArtifactProofs(service, { ...valid, proofs: { ...valid.proofs, [source]: proofB } })).reason, 'source');
  assert.equal((await verifyGuestDesignArtifactProofs(service, { ...valid, productionFiles: { front: { path: back } } })).reason, 'production');
  assert.equal((await verifyGuestDesignArtifactProofs(service, { ...valid, approvedMockupPaths: { front: print } })).reason, 'mockup');
  assert.equal((await verifyGuestDesignArtifactProofs(service, { ...valid, approvedMockupPaths: { front, back: front } })).reason, 'duplicate_mockup');
});

test('seasonal design may use its own production file as the source, never as a mockup', async () => {
  const { service } = await serviceFixture();
  const valid = { photoPaths: [print], productionFiles: { front: { path: print } }, approvedMockupPaths: { front }, proofs: { [print]: proofPrint, [front]: proofA }, designPath: 'seasonal' };
  assert.deepEqual(await verifyGuestDesignArtifactProofs(service, valid), { ok: true });
  assert.equal((await verifyGuestDesignArtifactProofs(service, { ...valid, approvedMockupPaths: { front: print } })).reason, 'mockup');
});

for (const designPath of ['seasonal', 'bootleg', 'memorial', 'upload']) {
  test(`${designPath}: approved front/back mockups remain distinct from both 300-DPI files`, async () => {
    const { service } = await serviceFixture();
    const proofMap = { [front]: proofA, [back]: proofB, [print]: proofPrint, [backPrint]: proofBackPrint, [source]: proofSource };
    const result = await verifyGuestDesignArtifactProofs(service, {
      designPath,
      photoPaths: designPath === 'seasonal' ? [print, backPrint] : [source],
      productionFiles: { front: { path: print, dpi: 300 }, back: { path: backPrint, dpi: 300 } },
      approvedMockupPaths: { front, back },
      proofs: proofMap,
    });
    assert.deepEqual(result, { ok: true });
    assert.notEqual(front, print);
    assert.notEqual(back, backPrint);
    assert.notEqual(print, backPrint);
  });
}

test('guest asset registry persists proofs for refresh; legacy paths do not acquire any', () => {
  const stored = new Map();
  const oldStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  try {
    assert.equal(guestUploadProofForPath('guest/99999999-9999-4999-8999-999999999999/legacy.png', 'mockup'), '');
    assert.equal(rememberGuestUploadProof(front, proofA, 'mockup'), true);
    assert.equal(rememberGuestUploadProof(print, proofPrint, 'production'), true);
    assert.equal(guestUploadProofForPath(front, 'mockup'), proofA);
    assert.equal(guestUploadProofForPath(front, 'production'), '');
    assert.equal(guestUploadProofsForDesign({ photo_assets: [], production_files: { front: { path: print } }, preflight: { customerMockupPaths: { front } } })[front], proofA);
    assert.equal(guestUploadProofsForDesign({ photo_assets: [{ path: back }] })[back], undefined);
    assert.doesNotMatch(JSON.stringify(stored), /guest\/99999999-9999/);
  } finally { globalThis.localStorage = oldStorage; }
});

test('Edge signer checks authorization before privileged createSignedUrl; migrations deny client table access', () => {
  const checkout = readFileSync(new URL('../supabase/functions/checkout/index.ts', import.meta.url), 'utf8');
  const signer = checkout.split('if (action === "signGuestCustomUpload") {')[1].split('if (action === "createGuestCustomDesign") {')[0];
  assert.ok(signer.indexOf('if (!proofAuthorized && !bindingAuthorized)') < signer.indexOf('.createSignedUrl(path, 3600)'));
  assert.match(checkout, /verifyGuestDesignArtifactProofs\(service,/);
  assert.match(checkout, /guest_custom_mockup_bindings"\)\.insert\(bindings\)/);
  const migration = readFileSync(new URL('../supabase/migrations/20261101000100_guest_custom_upload_ownership_grants.sql', import.meta.url), 'utf8');
  for (const table of ['guest_custom_upload_grants', 'guest_custom_mockup_bindings']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  }
  const preview = readFileSync(new URL('../src/components/storefront/CartGarmentPreview.jsx', import.meta.url), 'utf8');
  assert.match(preview, /Saved preview unavailable/);
});

test('actual Edge signing action rejects unowned paths before hitting service-role storage', async () => {
  const checkout = readFileSync(new URL('../supabase/functions/checkout/index.ts', import.meta.url), 'utf8');
  const route = 'if (action === "signGuestCustomUpload") {'
    + checkout.split('if (action === "signGuestCustomUpload") {')[1]
      .split('if (action === "createGuestCustomDesign") {')[0];
  const executeRoute = new (Object.getPrototypeOf(async function () {}).constructor)(
    'action', 'body', 'service', 'req', 'respond', 'enforceActionRateLimit', 'guestUploadPath',
    'authorizeGuestUploadProof', 'authorizeGuestMockupBinding', route
  );
  const { service: fixture, data } = await serviceFixture();
  let signedCount = 0;
  const service = {
    ...fixture,
    storage: { from: () => ({ createSignedUrl: async (path) => {
      signedCount += 1;
      return { data: { signedUrl: `https://fixture.invalid/${path}` }, error: null };
    } }) },
  };
  const run = (body) => executeRoute(
    'signGuestCustomUpload', body, service, {},
    (_req, json, status = 200) => ({ status, json }),
    async () => null,
    (path) => validGuestUploadPath(path) ? path : null,
    authorizeGuestUploadProof, authorizeGuestMockupBinding
  );
  for (const body of [
    { path: front, purpose: 'mockup' },
    { path: front, purpose: 'mockup', uploadProof: proofB },
    { path: print, purpose: 'mockup', uploadProof: proofPrint },
    { path: front, purpose: 'mockup', guestDesignToken: b, designId: design, side: 'front' },
    { path: back, purpose: 'mockup', guestDesignToken: token, designId: design, side: 'front' },
  ]) {
    assert.equal((await run(body)).status, 403);
    assert.equal(signedCount, 0);
  }
  assert.equal((await run({ path: `guest/${a}/../front.png`, purpose: 'mockup', uploadProof: proofA })).status, 400);
  assert.equal((await run({ path: front, purpose: 'mockup', uploadProof: proofA })).status, 200);
  assert.equal((await run({ path: back, purpose: 'mockup', guestDesignToken: token, designId: design, side: 'back' })).status, 200);
  assert.equal(signedCount, 2);
  // Regression: an otherwise valid design token never resurrects a revoked grant.
  data.guest_custom_upload_grants[back].revoked_at = new Date().toISOString();
  assert.equal((await run({ path: back, purpose: 'mockup', guestDesignToken: token, designId: design, side: 'back' })).status, 403);
  assert.equal(signedCount, 2);
  delete data.guest_custom_upload_grants[back].revoked_at;
  data.guest_custom_upload_grants[back].expires_at = '2000-01-01T00:00:00.000Z';
  assert.equal((await run({ path: back, purpose: 'mockup', guestDesignToken: token, designId: design, side: 'back' })).status, 403);
  assert.equal(signedCount, 2);
  data.guest_custom_upload_grants[back].expires_at = expiresAt;
  data.guest_custom_upload_grants[back].purpose = 'source';
  assert.equal((await run({ path: back, purpose: 'mockup', guestDesignToken: token, designId: design, side: 'back' })).status, 403);
  assert.equal(signedCount, 2);
  data.guest_custom_upload_grants[back].purpose = 'mockup';
  data.guest_design_sessions[0].expires_at = '2000-01-01T00:00:00.000Z';
  assert.equal((await run({ path: back, purpose: 'mockup', guestDesignToken: token, designId: design, side: 'back' })).status, 403);
  assert.equal(signedCount, 2);
});

test('authenticated RLS denial never triggers an unproven guest signing fallback', async () => {
  const sourceText = readFileSync(new URL('../src/lib/customStudioV2Assets.js', import.meta.url), 'utf8');
  const source = sourceText.split('export async function refreshStudioV2AssetUrl(')[1]
    .split('async function refreshAsset(')[0];
  const create = new (Object.getPrototypeOf(async function () {}).constructor)(
    'supabase', 'optionalAccountUser', 'guestUploadProofForPath',
    `async function refreshStudioV2AssetUrl(${source}\nreturn refreshStudioV2AssetUrl('guest/${a}/photo.png', 'old-preview');`
  );
  let guestCalls = 0;
  const supabase = {
    storage: { from: () => ({ createSignedUrl: async () => ({ error: new Error('RLS denied'), data: null }) }) },
    functions: { invoke: async () => { guestCalls += 1; return { data: { signedUrl: 'unintended-url' }, error: null }; } },
  };
  assert.equal(await create(supabase, async () => ({ id: a }), () => ''), 'old-preview');
  assert.equal(guestCalls, 0);
  assert.equal(await create(supabase, async () => ({ id: a }), () => proofA), 'unintended-url');
  assert.equal(guestCalls, 1); // Independently proven guest capability permits the fallback.
});


test('eight uploads per side keep all sixteen authorized source assets without weakening the guest rate limit', () => {
  const checkout = readFileSync(new URL('../supabase/functions/checkout/index.ts', import.meta.url), 'utf8');
  const designRoute = checkout.split('if (action === "createGuestCustomDesign") {')[1].split('if (action === "createDtfUpload") {')[0];
  assert.match(designRoute, /submittedPhotoAssets\.length > 16/);
  assert.match(designRoute, /const photoAssets = submittedPhotoAssets\s*\.map\(/);
  assert.doesNotMatch(designRoute, /const photoAssets = .*\n\s*\.slice\(0, 8\)/);
  assert.match(designRoute, /verifyGuestDesignArtifactProofs\(service,/);
  assert.match(checkout, /if \(action === "createGuestCustomUpload"\) \{\s*const limited = await enforceActionRateLimit\(service, req, action, 20\)/);
});

test('proof collection retains sixteen distinct Front and Back artwork paths', () => {
  const artworkPaths = Array.from({ length: 16 }, (_, index) => {
    const prefix = (index + 1).toString(16).padStart(8, '0');
    return `guest/${prefix}-0000-4000-8000-000000000000/source-${index}.png`;
  });
  for (const path of artworkPaths) assert.equal(rememberGuestUploadProof(path, 'f'.repeat(64), 'source'), true);
  const proofs = guestUploadProofsForDesign({ photo_assets: artworkPaths.map((path) => ({ path })) });
  assert.deepEqual(Object.keys(proofs).sort(), artworkPaths.slice().sort());
});
