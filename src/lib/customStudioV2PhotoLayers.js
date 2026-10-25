// Keep photo layer identity stable when a multi-file upload completes after other editor updates.
// This is intentionally a pure state helper: it does not hide, delete or upload files.
export function appendStudioV2PhotoLayers(existing = [], incoming = [], maximum = 8) {
  const limit = Math.max(1, Math.floor(Number(maximum) || 8));
  const byId = new Map();
  for (const layer of Array.isArray(existing) ? existing : []) {
    if (!layer?.id || byId.has(layer.id)) continue;
    byId.set(layer.id, layer);
    if (byId.size >= limit) return [...byId.values()].map((item, index) => ({ ...item, order: index }));
  }
  for (const layer of Array.isArray(incoming) ? incoming : []) {
    if (!layer?.id || byId.has(layer.id)) continue;
    if (byId.size >= limit) break;
    byId.set(layer.id, layer);
  }
  return [...byId.values()].map((item, index) => ({ ...item, order: index }));
}

export function uploadedPhotoIdsPresent(layers = [], ids = []) {
  if (!Array.isArray(ids) || !ids.length) return false;
  const present = new Set((Array.isArray(layers) ? layers : []).map((layer) => layer?.id));
  return ids.every((id) => present.has(id));
}
