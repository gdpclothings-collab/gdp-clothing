/**
 * In-memory cache for public Studio browse data (garment catalog + public
 * Studio settings). Never cache customer uploads, designs, draft checkout
 * data or authentication state here.
 *
 * Returning from Shop/Home can render immediately from the last successful
 * public snapshot, while every mount still revalidates against the backend.
 * Concurrent mounts share one request; nothing is persisted across reloads.
 */
let snapshot = null;
let pending = null;

export function getStudioBrowseSnapshot() {
  return snapshot;
}

export function refreshStudioBrowseSnapshot(loadCatalog, loadSettings) {
  if (pending) return pending;

  pending = Promise.all([
    loadCatalog(),
    loadSettings().catch(() => snapshot?.settings || {}),
  ])
    .then(([catalog, settings]) => {
      snapshot = {
        catalog: Array.isArray(catalog) ? catalog : [],
        settings: settings || {},
      };
      return snapshot;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
