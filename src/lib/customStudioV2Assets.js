import { supabase } from '@/lib/supabaseClient';

async function optionalAccountUser() {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user || null;
  return user?.is_anonymous === true ? null : user;
}

export async function refreshStudioV2AssetUrl(path, fallbackUrl = '') {
  const storagePath = String(path || '').trim();
  if (!storagePath) return String(fallbackUrl || '');
  if (/^https?:\/\//i.test(storagePath)) return storagePath;

  const user = await optionalAccountUser();
  if (user) {
    const { data, error } = await supabase.storage.from('customer-uploads').createSignedUrl(storagePath, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  try {
    const { data, error } = await supabase.functions.invoke('checkout', {
      body: { action: 'signGuestCustomUpload', path: storagePath },
    });
    if (!error && !data?.error && data?.signedUrl) return data.signedUrl;
  } catch {
    // Keep the previous preview URL below. Final rendering still validates every source.
  }

  return String(fallbackUrl || '');
}

async function refreshAsset(asset) {
  if (!asset || typeof asset !== 'object') return asset;
  const [url, originalUrl, cleanedUrl] = await Promise.all([
    refreshStudioV2AssetUrl(asset.path, asset.url),
    asset.originalPath ? refreshStudioV2AssetUrl(asset.originalPath, asset.originalUrl) : Promise.resolve(asset.originalUrl || ''),
    asset.cleanedPath ? refreshStudioV2AssetUrl(asset.cleanedPath, asset.cleanedUrl) : Promise.resolve(asset.cleanedUrl || ''),
  ]);
  return { ...asset, url, originalUrl, cleanedUrl };
}

async function refreshProtectedSide(sideState) {
  const photos = await Promise.all((sideState?.photos || []).map(async (layer) => ({
    ...layer,
    asset: await refreshAsset(layer.asset),
  })));
  const legacyPhoto = sideState?.photo ? await refreshAsset(sideState.photo) : null;
  const primary = photos[0]?.asset || legacyPhoto;
  return {
    ...sideState,
    photos,
    photo: primary || null,
    transform: photos[0]?.transform || sideState?.transform || { scale: 100, rotation: 0, x: 0, y: 0 },
  };
}

async function refreshUploadSide(sideState) {
  const artwork = sideState?.artwork ? await refreshAsset(sideState.artwork) : null;
  // A free-enhanced upload retains its original as a separate customer-owned
  // asset; refresh both signed URLs so Restore works after reopening a draft.
  const hydratedArtwork = artwork?.originalArtwork
    ? { ...artwork, originalArtwork: await refreshAsset(artwork.originalArtwork) }
    : artwork;
  return { ...sideState, artwork: hydratedArtwork };
}

export async function refreshStudioV2DraftAssets(state) {
  if (!state || typeof state !== 'object') return state;
  const next = structuredClone(state);
  for (const path of ['bootleg', 'memorial']) {
    for (const side of ['front', 'back']) {
      next[path].sides[side] = await refreshProtectedSide(next[path].sides[side]);
    }
  }
  for (const side of ['front', 'back']) {
    next.upload.sides[side] = await refreshUploadSide(next.upload.sides[side]);
  }
  return next;
}
