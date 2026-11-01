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

// Reorder the visible list (top = foreground) while keeping the saved order
// canonical (bottom = 0, foreground = largest). The preview and 300-DPI
// production renderer both draw photos in ascending saved order.
export function reorderStudioV2PhotoLayers(layers = [], fromTopIndex, toTopIndex) {
  const bottomToTop = [...(Array.isArray(layers) ? layers : [])]
    .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0));
  const count = bottomToTop.length;
  if (!Number.isInteger(fromTopIndex) || !Number.isInteger(toTopIndex)
    || fromTopIndex < 0 || toTopIndex < 0
    || fromTopIndex >= count || toTopIndex >= count
    || fromTopIndex === toTopIndex) return bottomToTop;

  const topToBottom = bottomToTop.reverse();
  const [moved] = topToBottom.splice(fromTopIndex, 1);
  topToBottom.splice(toTopIndex, 0, moved);
  return topToBottom.reverse().map((layer, index) => ({ ...layer, order: index }));
}
