// Possession of a random upload proof is required to refresh guest assets.
// Legacy carts without proofs remain readable but cannot mint new signed URLs.
const KEY = 'gdp_guest_upload_proofs_v1';
const MAX_PROOFS = 300;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const memory = new Map();
const validProof = (value) => /^[0-9a-f]{64}$/.test(String(value || ''));
const validPath = (path) => /^guest\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i.test(String(path || ''));

function readProofs() {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(KEY) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) return stored;
  } catch { /* An unavailable or corrupt store never authorizes a path. */ }
  return {};
}

export function rememberGuestUploadProof(path, proof, purpose = 'source') {
  if (!validPath(path) || !validProof(proof) || !['source', 'mockup', 'production'].includes(purpose)) return false;
  const entry = { proof, purpose, addedAt: Date.now() };
  memory.set(path, entry);
  const entries = Object.entries({ ...readProofs(), [path]: entry })
    .filter(([key, value]) => validPath(key) && validProof(value?.proof)
      && Date.now() - Number(value.addedAt) < MAX_AGE_MS && Number(value.addedAt) <= Date.now())
    .sort(([, first], [, second]) => Number(second.addedAt) - Number(first.addedAt))
    .slice(0, MAX_PROOFS);
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(Object.fromEntries(entries))); }
  catch { /* In-memory ownership proof still works until the tab is closed. */ }
  return true;
}

export function guestUploadProofForPath(path, purpose) {
  if (!validPath(path) || !['source', 'mockup', 'production'].includes(purpose)) return '';
  const entry = memory.get(path) || readProofs()[path];
  if (!entry || entry.purpose !== purpose || !validProof(entry.proof)
    || !(Date.now() - Number(entry.addedAt) < MAX_AGE_MS)
    || Number(entry.addedAt) > Date.now()) return '';
  return entry.proof;
}

export function guestUploadProofsForDesign(payload) {
  const paths = [
    ...(payload.photo_assets || []).map((asset) => asset.path),
    ...Object.values(payload.production_files || {}).map((file) => file?.path),
    payload.customer_mockup_path,
    ...Object.values(payload.preflight?.customerMockupPaths || {}),
  ];
  const proofs = {};
  for (const path of paths) {
    for (const purpose of ['source', 'production', 'mockup']) {
      const proof = guestUploadProofForPath(path, purpose);
      if (proof) proofs[path] = proof;
    }
  }
  return proofs;
}
