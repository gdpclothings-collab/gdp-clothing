// Editing-preview visibility only. These functions never modify saved layer data.
const ids = (value) => Array.isArray(value) ? value.filter((id) => typeof id === 'string' && id.length > 0) : [];

export function nextPreviewHiddenPhotoIds(previous, photoId) {
  const current = ids(previous);
  if (!photoId) return current;
  return current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId];
}

export function nextPreviewFocusPhotoIds(previous, photoId, maximum = 2) {
  const current = ids(previous);
  if (!photoId) return current;
  if (current.includes(photoId)) return current.filter((id) => id !== photoId);
  const limit = Math.max(1, Math.min(2, Number(maximum) || 2));
  return [...current.slice(-(limit - 1)), photoId];
}

export function previewPhotoVisible(layer, hiddenPhotoIds = [], focusPhotoIds = []) {
  if (!layer || layer.visible === false) return false;
  const hidden = ids(hiddenPhotoIds);
  const focused = ids(focusPhotoIds);
  return !hidden.includes(layer.id) && (!focused.length || focused.includes(layer.id));
}

export function previewIsFiltered(hiddenPhotoIds = [], focusPhotoIds = []) {
  return ids(hiddenPhotoIds).length > 0 || ids(focusPhotoIds).length > 0;
}
