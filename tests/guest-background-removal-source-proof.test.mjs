import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { issueGuestCleanedSourceProof } from '../supabase/functions/remove-photo-background/guest-cleaned-source-proof.mjs';
import { authorizeGuestUploadProof } from '../supabase/functions/checkout/guest-upload-authorization.mjs';
import {
  guestUploadProofForPath,
  guestUploadProofsForDesign,
  missingGuestSourceProofPath,
  registerProcessedGuestArtworkProof,
} from '../src/lib/guestUploadProofs.js';

const guestPath = 'guest/53535353-5353-4535-8535-535353535353/portrait-transparent.png';
const otherPath = 'guest/64646464-6464-4646-8646-646464646464/portrait-transparent.png';
const expiresAt = '2090-01-01T00:00:00.000Z';

function grantFixture({ insertError = false } = {}) {
  const grants = new Map();
  const service = {
    from(table) {
      assert.equal(table, 'guest_custom_upload_grants');
      return {
        async insert(row) {
          if (insertError) return { error: new Error('No grant permission') };
          grants.set(row.path, { ...row, expires_at: expiresAt, revoked_at: null });
          return { error: null };
        },
        select() { return this; },
        eq(column, value) { this.path = value; assert.equal(column, 'path'); return this; },
        async maybeSingle() { return { data: grants.get(this.path) || null, error: null }; },
      };
    },
  };
  return { service, grants };
}

test('background-removed guest source receives an independent, source-only 256-bit ownership proof', async () => {
  const { service, grants } = grantFixture();
  const proof = await issueGuestCleanedSourceProof(service, guestPath);
  assert.match(proof, /^[0-9a-f]{64}$/);
  assert.notEqual(proof, await issueGuestCleanedSourceProof(service, otherPath));
  assert.notEqual(grants.get(guestPath).proof_hash, proof);
  assert.equal(grants.get(guestPath).purpose, 'source');
  assert.equal(await authorizeGuestUploadProof(service, { path: guestPath, proof, purpose: 'source' }), true);
  for (const purpose of ['mockup', 'production']) {
    assert.equal(await authorizeGuestUploadProof(service, { path: guestPath, proof, purpose }), false);
  }
  assert.equal(await authorizeGuestUploadProof(service, { path: otherPath, proof, purpose: 'source' }), false);
  assert.equal(await authorizeGuestUploadProof(service, { path: guestPath, proof: '0'.repeat(64), purpose: 'source' }), false);
  assert.deepEqual(await (await import('../supabase/functions/checkout/guest-upload-authorization.mjs')).verifyGuestDesignArtifactProofs(service, {
    photoPaths: [guestPath], productionFiles: {}, approvedMockupPaths: {}, proofs: { [guestPath]: proof }, designPath: 'bootleg',
  }), { ok: true });
  grants.get(guestPath).revoked_at = new Date().toISOString();
  assert.equal(await authorizeGuestUploadProof(service, { path: guestPath, proof, purpose: 'source' }), false);
});

test('arbitrary, account-owned and legacy paths cannot be backfilled with a guest proof', async () => {
  const { service, grants } = grantFixture();
  for (const invalid of [
    'guest/53535353-5353-4535-8535-535353535353/original.jpg',
    'guest/53535353-5353-4535-8535-535353535353/../portrait-transparent.png',
    'customer-id/background-removal/photo-transparent.png',
    '',
  ]) await assert.rejects(issueGuestCleanedSourceProof(service, invalid), /Invalid guest/);
  assert.equal(grants.size, 0);
  await assert.rejects(issueGuestCleanedSourceProof(grantFixture({ insertError: true }).service, guestPath), /Could not register/);
});

test('browser records newly issued cleaned proof and blocks legacy processed sources with no proof', async () => {
  const stored = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  try {
    assert.equal(missingGuestSourceProofPath([guestPath]), guestPath);
    assert.equal(registerProcessedGuestArtworkProof({ cleanedPath: guestPath }), false);
    const { service } = grantFixture();
    const proof = await issueGuestCleanedSourceProof(service, guestPath);
    assert.equal(registerProcessedGuestArtworkProof({ cleanedPath: guestPath, cleanedUploadProof: proof }), true);
    assert.equal(guestUploadProofForPath(guestPath, 'source'), proof);
    assert.equal(missingGuestSourceProofPath([guestPath]), '');
    assert.equal(missingGuestSourceProofPath([guestPath, otherPath]), otherPath);
    assert.deepEqual(guestUploadProofsForDesign({ photo_assets: [{ path: guestPath }] }), { [guestPath]: proof });
    assert.equal(registerProcessedGuestArtworkProof({ cleanedPath: '11111111-1111-4111-8111-111111111111/background-removal/clip.png' }), true);
  } finally { globalThis.localStorage = previousStorage; }
});

test('the live background-removal response never returns guest cutouts before source authorization', () => {
  const edge = readFileSync(new URL('../supabase/functions/remove-photo-background/index.ts', import.meta.url), 'utf8');
  const uploaded = edge.indexOf('.upload(cleanedPath, cleanedBytes');
  const granted = edge.indexOf('issueGuestCleanedSourceProof(service, cleanedPath)');
  const signed = edge.indexOf('.createSignedUrls([originalPath, cleanedPath]');
  assert.ok(uploaded >= 0 && uploaded < granted && granted < signed);
  assert.match(edge, /\.\.\.\(cleanedUploadProof \? \{ cleanedUploadProof \} : \{\}\)/);
  const client = readFileSync(new URL('../src/lib/customerApi.js', import.meta.url), 'utf8');
  assert.match(client, /if \(!registerProcessedGuestArtworkProof\(response\)\)/);
  const finalize = readFileSync(new URL('../src/pages/CustomStudioV2.jsx', import.meta.url), 'utf8');
  assert.ok(finalize.indexOf('missingGuestSourceProofPath(sourcePaths)') < finalize.indexOf('Rendering ${side} print artwork at 300 DPI'));
});
