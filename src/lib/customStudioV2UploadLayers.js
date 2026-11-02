// Canonical artwork stack for Upload My Own Artwork.
// Arrays are bottom-to-top, matching the production renderer. Legacy single-file
// designs are lazily adapted without rewriting an existing customer's draft.
export const MAX_UPLOAD_ARTWORKS = 8;

const DEFAULT_TRANSFORM = { scale: 100, widthScale: 100, heightScale: 100, rotation: 0, x: 0, y: 0 };

export function uploadArtworkLayers(editor = {}) {
  if (Array.isArray(editor.layers)) return editor.layers;
  return editor.artwork?.path ? [{
    id: 'legacy-primary-artwork',
    asset: editor.artwork,
    transform: editor.transform || DEFAULT_TRANSFORM,
    visible: true,
  }] : [];
}

export function selectUploadArtworkLayer(editor, layers, requestedId = '') {
  const safeLayers = layers.slice(0, MAX_UPLOAD_ARTWORKS);
  const selected = safeLayers.find((layer) => layer.id === requestedId)
    || safeLayers.find((layer) => layer.id === editor?.activeLayerId)
    || safeLayers[safeLayers.length - 1];
  return {
    layers: safeLayers,
    activeLayerId: selected?.id || '',
    artwork: selected?.asset || null,
    transform: selected?.transform || { ...DEFAULT_TRANSFORM },
  };
}

export function patchUploadArtworkEditor(editor = {}, patch = {}) {
  const layers = uploadArtworkLayers(editor);
  if (Array.isArray(patch.layers)) {
    return { ...patch, ...selectUploadArtworkLayer(editor, patch.layers, patch.activeLayerId || '') };
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'activeLayerId')) {
    return { ...patch, ...selectUploadArtworkLayer(editor, layers, patch.activeLayerId) };
  }
  if (!Object.prototype.hasOwnProperty.call(patch, 'artwork') &&
      !Object.prototype.hasOwnProperty.call(patch, 'transform')) return patch;
  const selectedId = editor.activeLayerId || layers[layers.length - 1]?.id;
  const index = layers.findIndex((layer) => layer.id === selectedId);
  const artwork = Object.prototype.hasOwnProperty.call(patch, 'artwork') ? patch.artwork : editor.artwork;
  const transform = Object.prototype.hasOwnProperty.call(patch, 'transform') ? patch.transform : editor.transform;
  if (!artwork) {
    const next = layers.filter((layer) => layer.id !== selectedId);
    return { ...patch, ...selectUploadArtworkLayer(editor, next, next[next.length - 1]?.id) };
  }
  const current = index >= 0 ? layers[index] : null;
  const updated = { ...current, id: selectedId || 'legacy-primary-artwork', asset: artwork, transform: transform || DEFAULT_TRANSFORM, visible: current?.visible !== false };
  const next = layers.slice();
  if (index >= 0) next[index] = updated;
  else next.push(updated);
  return { ...patch, ...selectUploadArtworkLayer(editor, next, updated.id) };
}

export function appendUploadArtworkLayers(editor = {}, additions = [], activeId = '') {
  const previous = uploadArtworkLayers(editor);
  const knownIds = new Set(previous.map((layer) => layer.id));
  const next = previous.slice();
  for (const layer of additions) {
    if (!layer?.id || !layer?.asset?.path || knownIds.has(layer.id) || next.length >= MAX_UPLOAD_ARTWORKS) continue;
    next.push({ ...layer, visible: layer.visible !== false });
    knownIds.add(layer.id);
  }
  return selectUploadArtworkLayer(editor, next, activeId || next[next.length - 1]?.id);
}

export function reorderUploadArtworkLayers(layers, sourceTopIndex, destinationTopIndex) {
  const topFirst = [...layers].reverse();
  if (sourceTopIndex < 0 || sourceTopIndex >= topFirst.length ||
      destinationTopIndex < 0 || destinationTopIndex >= topFirst.length ||
      sourceTopIndex === destinationTopIndex) return layers;
  const [moved] = topFirst.splice(sourceTopIndex, 1);
  topFirst.splice(destinationTopIndex, 0, moved);
  return topFirst.reverse();
}
