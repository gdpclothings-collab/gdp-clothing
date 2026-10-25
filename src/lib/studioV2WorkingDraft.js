import { scopedStorageKey } from './customerStorageScope.js';

export const STUDIO_V2_WORKING_DRAFT_KEY = 'gdp.custom-studio.working-draft.v1';
export const STUDIO_V2_WORKING_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_DRAFT_CHARACTERS = 500_000;
const VALID_DESIGN_PATHS = new Set(['seasonal', 'bootleg', 'memorial', 'upload']);
const SIGNED_URL_MARKERS = /[?&](?:token|signature|sig|X-Amz-[^=]+)=/i;
const TEMPORARY_IMAGE_URL = /^(?:data:|blob:)/i;

// Retain editable layout and durable paths, not customer image bytes or
// temporary signed links. Remote images are re-signed when reopened.
function safeValue(value, key = '', parent = null, seen = new WeakSet()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (TEMPORARY_IMAGE_URL.test(value) || SIGNED_URL_MARKERS.test(value)) return undefined;
    if (['accessToken', 'refreshToken', 'signedUrl', 'jwt'].includes(key)) return undefined;
    if (['url', 'originalUrl', 'cleanedUrl', 'file_url'].includes(key) &&
        parent && (parent.path || parent.originalPath || parent.cleanedPath)) return undefined;
    return value;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => safeValue(item, '', null, seen)).filter((item) => item !== undefined);
    seen.delete(value);
    return result;
  }
  const result = {};
  for (const [childKey, child] of Object.entries(value)) {
    if (['accessToken', 'refreshToken', 'signedUrl', 'jwt', 'guestDesignToken'].includes(childKey)) continue;
    const safe = safeValue(child, childKey, value, seen);
    if (safe !== undefined) result[childKey] = safe;
  }
  seen.delete(value);
  return result;
}

function sessionStore(storage) {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage; } catch { return null; }
}
function keyFor(user) { return scopedStorageKey(STUDIO_V2_WORKING_DRAFT_KEY, user); }

export function clearStudioV2WorkingDraft(user, storage) {
  try { sessionStore(storage)?.removeItem(keyFor(user)); } catch { /* Optional browser storage. */ }
}

export function saveStudioV2WorkingDraft(state, user, storage, now = Date.now()) {
  if (!state?.productId || !VALID_DESIGN_PATHS.has(state.designPath)) return false;
  const safeState = safeValue(state);
  if (!safeState) return false;
  safeState.approval = { ...safeState.approval, rightsConfirmed: false, finalDesignApproved: false };
  for (const path of VALID_DESIGN_PATHS) {
    for (const side of ['front', 'back']) {
      if (safeState[path]?.sides?.[side]) safeState[path].sides[side].confirmed = false;
    }
  }
  try {
    const serialized = JSON.stringify({ version: 1, savedAt: now, state: safeState });
    if (serialized.length > MAX_DRAFT_CHARACTERS) return false;
    const target = sessionStore(storage);
    if (!target) return false;
    target.setItem(keyFor(user), serialized);
    return true;
  } catch { return false; }
}

export function loadStudioV2WorkingDraft(user, storage, now = Date.now()) {
  const target = sessionStore(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(keyFor(user));
    if (!raw) return null;
    if (raw.length > MAX_DRAFT_CHARACTERS) {
      clearStudioV2WorkingDraft(user, target);
      return null;
    }
    const saved = JSON.parse(raw);
    const valid = saved?.version === 1 && Number.isFinite(saved?.savedAt) &&
      saved.savedAt <= now && now - saved.savedAt <= STUDIO_V2_WORKING_DRAFT_TTL_MS &&
      saved.state?.productId && VALID_DESIGN_PATHS.has(saved.state.designPath);
    if (!valid) {
      clearStudioV2WorkingDraft(user, target);
      return null;
    }
    const restored = safeValue(saved.state);
    if (!restored) return null;
    restored.approval = { ...restored.approval, rightsConfirmed: false, finalDesignApproved: false };
    for (const path of VALID_DESIGN_PATHS) {
      for (const side of ['front', 'back']) {
        if (restored[path]?.sides?.[side]) restored[path].sides[side].confirmed = false;
      }
    }
    return restored;
  } catch {
    clearStudioV2WorkingDraft(user, target);
    return null;
  }
}
