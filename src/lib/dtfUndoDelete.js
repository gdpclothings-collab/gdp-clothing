export const DTF_UNDO_DELETE_MS = 10_000;

// Preserve the exact artwork object (including its File and live preview URL) for one undo.
export function createDtfDeleteSnapshot(items, artworkId, workspace, now = Date.now()) {
  const index = items.findIndex((item) => item.id === artworkId);
  if (index < 0) return null;
  return {
    token: `${artworkId}:${now}`,
    item: items[index],
    index,
    mode: workspace.mode,
    sheetWidth: workspace.sheetWidth,
    sheetLength: workspace.sheetLength,
    expiresAt: now + DTF_UNDO_DELETE_MS,
  };
}

export function restoreDtfDeletedArtwork(items, snapshot, mode, now = Date.now()) {
  if (!snapshot || snapshot.mode !== mode || now >= snapshot.expiresAt) return null;
  if (items.some((item) => item.id === snapshot.item.id)) return null;
  // A print-ready film must only contain its one complete uploaded sheet.
  if (mode === "upload" && items.length > 0) return null;
  const result = [...items];
  result.splice(Math.min(Math.max(0, snapshot.index), result.length), 0, snapshot.item);
  return result;
}
