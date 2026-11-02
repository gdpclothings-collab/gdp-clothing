// Server-side authorization for private guest artwork. Paths are identifiers,
// never proof of ownership; these helpers are shared with fixture-only tests.
const guestPathPattern = /^guest\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[A-Za-z0-9._-]+$/i;
const proofPattern = /^[0-9a-f]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const guestUploadPurposes = Object.freeze(['source', 'production', 'mockup']);

export function validGuestUploadPath(path) {
  return typeof path === 'string' && guestPathPattern.test(path)
    && !['.', '..'].includes(path.slice(path.lastIndexOf('/') + 1));
}

export function newGuestUploadProof() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashGuestUploadProof(proof) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(proof));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function authorizeGuestUploadProof(service, { path, proof, purpose, now = Date.now() }) {
  if (!validGuestUploadPath(path) || !proofPattern.test(String(proof || '')) || !guestUploadPurposes.includes(purpose)) return false;
  const { data, error } = await service.from('guest_custom_upload_grants')
    .select('proof_hash,purpose,expires_at,revoked_at')
    .eq('path', path).maybeSingle();
  if (error) throw error; // Fail closed when the authorization database is unavailable.
  return Boolean(data && data.purpose === purpose && !data.revoked_at
    && Date.parse(data.expires_at) > now
    && data.proof_hash === await hashGuestUploadProof(proof));
}

export async function authorizeGuestMockupBinding(service, { path, designId, guestDesignToken, side, now = Date.now() }) {
  if (!validGuestUploadPath(path) || !uuidPattern.test(String(designId || ''))
    || !uuidPattern.test(String(guestDesignToken || '')) || !['front', 'back'].includes(side)) return false;
  const tokenHash = await hashGuestUploadProof(guestDesignToken);
  const { data: session, error: sessionError } = await service.from('guest_design_sessions')
    .select('expires_at,converted_at').eq('design_id', designId).eq('token_hash', tokenHash).maybeSingle();
  if (sessionError) throw sessionError;
  if (!session || session.converted_at || !(Date.parse(session.expires_at) > now)) return false;
  const { data: binding, error: bindingError } = await service.from('guest_custom_mockup_bindings')
    .select('path').eq('design_id', designId).eq('side', side).maybeSingle();
  if (bindingError) throw bindingError;
  if (binding?.path !== path) return false;
  // Design tokens do not override revocation or expiration of the underlying upload grant.
  // The grant is service-only and must still authorize this exact mockup path.
  const { data: grant, error: grantError } = await service.from('guest_custom_upload_grants')
    .select('purpose,expires_at,revoked_at').eq('path', path).maybeSingle();
  if (grantError) throw grantError;
  return Boolean(grant && grant.purpose === 'mockup' && !grant.revoked_at
    && Date.parse(grant.expires_at) > now);
}

// Validation runs before saving any design snapshot or production-file metadata.
// A client-provided manifest is not itself evidence of upload ownership.
export async function verifyGuestDesignArtifactProofs(service, {
  photoPaths = [], productionFiles = {}, approvedMockupPaths = {}, proofs = {}, designPath,
  accountUserId = null,
}) {
  const owned = async (path, purpose) => {
    if (validGuestUploadPath(path)) return authorizeGuestUploadProof(service, { path, purpose, proof: proofs[path] });
    return Boolean(accountUserId && uuidPattern.test(accountUserId)
      && path.startsWith(`${accountUserId}/`)
      && /^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i.test(path)
      && !['.', '..'].includes(path.slice(path.lastIndexOf('/') + 1)));
  };
  const productionPaths = Object.values(productionFiles).map((file) => file.path);
  for (const path of photoPaths) {
    const purpose = designPath === 'seasonal' && productionPaths.includes(path) ? 'production' : 'source';
    if (!(await owned(path, purpose))) return { ok: false, reason: 'source' };
  }
  for (const path of productionPaths) {
    if (!(await owned(path, 'production'))) return { ok: false, reason: 'production' };
  }
  const mockupPaths = Object.values(approvedMockupPaths);
  if (new Set(mockupPaths).size !== mockupPaths.length) return { ok: false, reason: 'duplicate_mockup' };
  for (const path of mockupPaths) {
    if (productionPaths.includes(path) || !(await owned(path, 'mockup'))) return { ok: false, reason: 'mockup' };
  }
  return { ok: true };
}
