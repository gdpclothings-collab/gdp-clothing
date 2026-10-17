// The only bridge between the public Seasonal preview catalog and the private
// approved master. This data is short-lived and must never be persisted in cart
// snapshots, printed reports, session storage, analytics or customer records.
const SHA256 = /^[a-f0-9]{64}$/i;
const MAX_LAYERS = 10;

export async function approvedSeasonalPrintSources(supabase, snapshot) {
  const layers = Array.isArray(snapshot?.layers) ? snapshot.layers : [];
  if (!layers.length || layers.length > MAX_LAYERS) throw new Error('Seasonal artwork selection is invalid.');
  const requested = new Map();
  for (const layer of layers) {
    const id = String(layer.artworkId || '');
    const sha = String(layer.sourceSha256 || '').toLowerCase();
    if (!id || !SHA256.test(sha)) throw new Error('The approved Seasonal print source is not verified. Choose the artwork again.');
    if (requested.has(id) && requested.get(id) !== sha) throw new Error('Seasonal artwork versions disagree. Choose the artwork again.');
    requested.set(id, sha);
  }

  const { data, error } = await supabase.functions.invoke('seasonal-print-source', {
    body: { artworkIds: [...requested.keys()] },
  });
  if (error || !Array.isArray(data?.sources)) {
    throw new Error('The approved high-resolution Seasonal artwork is unavailable. Your design is preserved; retry when the source is ready.');
  }

  const found = new Map();
  for (const source of data.sources) {
    const id = String(source?.artworkId || '');
    const sha = String(source?.sourceSha256 || '').toLowerCase();
    if (!requested.has(id) || requested.get(id) !== sha || found.has(id) ||
        !['png', 'svg'].includes(source?.format) ||
        typeof source?.signedUrl !== 'string' || !/^https:\/\//.test(source.signedUrl)) {
      throw new Error('The Seasonal source changed during final review. Choose the artwork again.');
    }
    const bbox = source.inkBboxPx;
    if (source.format === 'png' && (!Array.isArray(bbox) || bbox.length !== 4 ||
        bbox.some(value => !Number.isInteger(Number(value)) || Number(value) < 0) ||
        Number(bbox[2]) <= Number(bbox[0]) || Number(bbox[3]) <= Number(bbox[1]))) {
      throw new Error('The approved Seasonal master has no valid ink boundaries. Contact GDP Clothing.');
    }
    found.set(id, {
      artworkId: id, signedUrl: source.signedUrl, sourceSha256: sha,
      format: source.format, inkBboxPx: source.format === 'png' ? bbox.map(Number) : null,
    });
  }
  if (found.size !== requested.size) throw new Error('Some approved Seasonal print masters could not be retrieved. Your cart has not changed.');
  return [...found.values()];
}

export async function verifySeasonalPrintMaster(blob, sha256, format) {
  if (!blob || !blob.size || !SHA256.test(String(sha256 || '')) || !globalThis.crypto?.subtle) {
    throw new Error('Seasonal print master integrity verification is unavailable.');
  }
  // Verify actual bytes, not the signed URL, metadata or the small WebP preview.
  const bytes = await blob.arrayBuffer();
  const isPng = bytes.byteLength >= 8 && [137, 80, 78, 71, 13, 10, 26, 10]
    .every((value, index) => new Uint8Array(bytes, 0, 8)[index] === value);
  if (format === 'png' && !isPng) throw new Error('The approved Seasonal source is not a PNG.');
  if (format === 'svg') {
    // Explicitly reject HTML and unrelated formats; the decoded SVG remains
    // an image-only resource and never executes markup in the app DOM.
    const text = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.byteLength, 4096)));
    if (!/^(?:\s*<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)?<svg\b/i.test(text)) {
      throw new Error('The approved Seasonal source is not an SVG.');
    }
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (actual !== sha256.toLowerCase()) throw new Error('The Seasonal production master has changed. Printing was stopped to protect the order.');
  return true;
}
