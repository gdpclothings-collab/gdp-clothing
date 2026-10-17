import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { approvedSeasonalPrintSources, verifySeasonalPrintMaster } from '../src/lib/seasonalPrintMaster.js';
import { renderSeasonalProductionPng } from '../src/lib/seasonalProductionRender.js';

const BASE = 'https://mcmancxsqlhxnjhlnfkz.supabase.co';
const ID = '1333031f-439a-47c2-a16c-0ab154f85bc8';
const PNG = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82]);
const expected = createHash('sha256').update(PNG).digest('hex');
const signedUrl = `${BASE}/storage/v1/object/sign/artwork-production/approved-master.png?token=ephemeral`;
const snapshot = { version: 6, printArea: { width: 12, height: 16, dpi: 300 },
  layers: [{ artworkId: ID, sourceSha256: expected, layerId: 'layer-1',
    x: 1, y: 2, width: 10, height: 9, rotation: 0, order: 0,
    previewUrl: 'data:image/webp;base64,THUMBNAIL_NOT_FOR_PRINT' }] };
const response = { sources: [{ artworkId: ID, sourceSha256: expected,
  signedUrl, inkBboxPx: [50, 25, 350, 325], format: 'png' }] };
const mockApi = (data, error = null) => ({
  supabaseUrl: BASE,
  functions: { invoke: async (name, args) => {
    assert.equal(name, 'seasonal-print-source');
    assert.deepEqual(args.body.artworkIds, [ID]);
    return { data, error };
  } },
});

test('resolve only signed, approved originals and never put raw paths into output', async () => {
  const sources = await approvedSeasonalPrintSources(mockApi(response), snapshot);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].signedUrl, signedUrl);
  assert.equal(sources[0].sourceSha256, expected);
  assert.ok(!JSON.stringify(snapshot).includes('approved-master.png'));
});

test('deny missing/foreign/changed source, including a thumbnail fallback', async () => {
  await assert.rejects(approvedSeasonalPrintSources(mockApi({ sources: [] }), snapshot), /could not be retrieved/);
  await assert.rejects(approvedSeasonalPrintSources(mockApi(null, Error('offline')), snapshot), /unavailable/);
  await assert.rejects(approvedSeasonalPrintSources(mockApi({ sources: [{ ...response.sources[0], sourceSha256: 'a'.repeat(64) }] }), snapshot), /changed/);
  await assert.rejects(approvedSeasonalPrintSources(mockApi({ sources: [{ ...response.sources[0], signedUrl: 'https://example.com/source.png' }] }), snapshot), /changed/);
  await assert.rejects(approvedSeasonalPrintSources(mockApi({ sources: [{ ...response.sources[0], signedUrl: 'data:image/webp;base64,bad' }] }), snapshot), /changed/);
});

test('verify byte-level source SHA-256 and reject mismatched thumbnail', async () => {
  globalThis.crypto = webcrypto;
  assert.equal(await verifySeasonalPrintMaster(new Blob([PNG], { type:'image/png' }), expected, 'png'), true);
  await assert.rejects(verifySeasonalPrintMaster(new Blob(['data:image/webp']), expected, 'png'), /not a PNG/);
  const changed = Uint8Array.from([...PNG, 1]);
  await assert.rejects(verifySeasonalPrintMaster(new Blob([changed]), expected, 'png'), /changed/);
});

test('signed masters are composited using ORIGINAL ink bounding pixels, not preview thumbnail', async () => {
  globalThis.crypto = webcrypto;
  globalThis.window = { setTimeout, clearTimeout };
  const seen = [];
  const context = {
    clearRect(){}, save(){}, restore(){}, translate(){}, rotate(){},
    drawImage(...args){ seen.push(args); },
    set imageSmoothingEnabled(_x){}, set imageSmoothingQuality(_x){}
  };
  globalThis.document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    return { width: 0, height: 0, getContext: () => context,
      toBlob(cb){cb(new Blob(['exported'],{type:'image/png'}));} };
  } };
  globalThis.createImageBitmap = async (_blob) => ({width: 400,height:350,close(){}});
  const seenUrls = [];
  globalThis.fetch = async url => {
    seenUrls.push(url);
    return {ok:true, blob: async () => new Blob([PNG], {type:'image/png'}) };
  };
  const sources = await approvedSeasonalPrintSources(mockApi(response), snapshot);
  const result = await renderSeasonalProductionPng(snapshot, sources, 300);
  assert.equal(result.widthPx,3600);
  assert.equal(result.heightPx,4800);
  assert.deepEqual(seenUrls,[signedUrl]);
  assert.equal(seen.length,1);
  assert.equal(seen[0][1],50); // source crop left, not canvas edge
  assert.equal(seen[0][2],25);
  assert.equal(seen[0][3],300); // original alpha crop width
  assert.equal(seen[0][4],300); // original alpha crop height
  assert.equal(seen[0][7],3000); // final print pixels width
  assert.equal(seen[0][8],2700);
});

test('renderer refuses unsigned sources; no preview fallback can be printed', async () => {
  await assert.rejects(renderSeasonalProductionPng(snapshot, [], 300), /not provided/);
  const renderer = readFileSync('src/lib/seasonalProductionRender.js', 'utf8');
  const producer = readFileSync('src/lib/customStudioV2Production.js', 'utf8');
  const edge = readFileSync('supabase/functions/seasonal-print-source/index.ts', 'utf8');
  assert.ok(!renderer.includes('layer.previewUrl || layer.preview_url'));
  assert.ok(renderer.includes('verifySeasonalPrintMaster(blob, source.sourceSha256'));
  assert.ok(producer.includes('const masters = await approvedSeasonalPrintSources(supabase, snapshot);'));
  assert.ok(producer.includes('sourceSha256: artwork.source_sha256'));
  assert.ok(edge.includes('.eq("rights_status", "confirmed")'));
  assert.ok(edge.includes('.eq("studio_visible", true)'));
  assert.ok(edge.includes('createSignedUrl(artwork!.production_path'));
});
