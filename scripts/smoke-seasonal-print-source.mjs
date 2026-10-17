import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Read-only live smoke against a previously published PNG and SVG.
// Never log expiring master URLs, auth headers, file bytes, or full responses.
const base = 'https://mcmancxsqlhxnjhlnfkz.supabase.co';
const cases = [
  { id: '1333031f-439a-47c2-a16c-0ab154f85bc8', kind: 'png',
    sha: '2b1c017e78d75dd33836f26d56cafa8f3596efcc32cef6036cc9d195e8928107' },
  { id: '7e72bcb4-124b-48f5-b127-e15631ece59a', kind: 'svg',
    sha: '8fe96545514639bfd43f3c1e1a09a95d0605562cefef7ecb7534f09a7a70f9fa' },
];

const signed = await fetch(`${base}/functions/v1/seasonal-print-source`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', Origin: 'https://gdpclothing.ca' },
  body: JSON.stringify({ artworkIds: cases.map(item => item.id) }),
  signal: AbortSignal.timeout(20000),
});
assert.equal(signed.status, 200, 'Signing live approved originals must return HTTP 200');
const body = await signed.json();
assert.equal(body.sources?.length, cases.length, 'Both PNG and SVG masters must be signable');

for (const expected of cases) {
  const entry = body.sources.find(item => item.artworkId === expected.id);
  assert.ok(entry, `Signed source for ${expected.kind} is missing`);
  assert.equal(entry.sourceSha256, expected.sha, 'Published original hash differs from the approved library');
  assert.equal(entry.format, expected.kind, 'Original format mismatch');
  assert.ok(entry.signedUrl.startsWith(`${base}/storage/v1/object/sign/artwork-production/`),
    'Production master URL must be signed by private GDP Storage');
  const downloaded = await fetch(entry.signedUrl, { signal: AbortSignal.timeout(45000) });
  assert.equal(downloaded.status, 200, 'The signed approved master must be downloadable');
  const buffer = Buffer.from(await downloaded.arrayBuffer());
  assert.ok(buffer.length > 250, 'Empty/truncated original production master');
  assert.equal(createHash('sha256').update(buffer).digest('hex'), expected.sha, 'Downloaded master bytes failed the approved SHA-256 check');
  if (expected.kind === 'png') {
    assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(entry.inkBboxPx?.length, 4);
    const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
    assert.ok(entry.inkBboxPx[2] <= width && entry.inkBboxPx[3] <= height, 'Master ink bounds exceed actual PNG canvas');
  } else {
    assert.ok(buffer.toString('utf8',0,3000).includes('<svg'), 'Approved vector original is not SVG');
    assert.equal(entry.inkBboxPx, null, 'SVG must use vector ink-boundary measurement');
  }
  console.log(`PASS: ${expected.kind.toUpperCase()} master signed, downloaded, and source hash verified`);
}

// Draft/unpublished/missing identifiers may NEVER become a way to get private masters.
const blocked = await fetch(`${base}/functions/v1/seasonal-print-source`, {
  method: 'POST', headers: { 'content-type': 'application/json', Origin: 'https://gdpclothing.ca' },
  body: JSON.stringify({ artworkIds: ['00000000-0000-4000-8000-000000000001'] }),
  signal: AbortSignal.timeout(20000),
});
assert.equal(blocked.status, 404, 'Unpublished/missing masters must not produce signed URLs');
console.log('PASS: inaccessible original denied; no direct storage grants or payment writes');
