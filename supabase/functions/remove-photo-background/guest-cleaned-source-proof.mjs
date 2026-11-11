// A processed guest cutout is a new private source asset. It must receive its
// own capability; possession of a signed preview URL is not ownership proof.
const cleanedGuestPathPattern = /^guest\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[A-Za-z0-9._-]+-transparent\.png$/i;

export async function issueGuestCleanedSourceProof(service, path) {
  if (!cleanedGuestPathPattern.test(String(path || ''))) {
    throw new Error('Invalid guest background-removal source path.');
  }

  const proof = Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(proof));
  const proofHash = Array.from(new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0')).join('');

  const { error } = await service.from('guest_custom_upload_grants').insert({
    path,
    proof_hash: proofHash,
    purpose: 'source',
  });
  if (error) throw new Error('Could not register processed guest artwork ownership.');

  // Only the caller that requested this newly generated asset receives the
  // unhashed proof. Never issue proof for arbitrary or pre-existing paths.
  return proof;
}
