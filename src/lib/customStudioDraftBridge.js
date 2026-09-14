export const STUDIO_DRAFT_KEY = "gdp.custom-studio.draft.v2";
export const STUDIO_EDIT_CART_KEY = "gdp.custom-studio.edit-cart.v1";
const EDIT_INTENT_TTL_MS = 30 * 60 * 1000;

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readCurrentStudioDraft() {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(STUDIO_DRAFT_KEY));
}

export function writeStudioDraft(draft) {
  if (typeof window === "undefined" || !draft || typeof draft !== "object") return false;
  try {
    window.localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearStudioEditIntent() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STUDIO_EDIT_CART_KEY);
  } catch {
    // Editing must remain non-fatal if browser storage is unavailable.
  }
}

export function beginStudioCartEdit(item) {
  if (typeof window === "undefined" || !item?.key) return false;
  const draft = item.studioDraft || null;
  if (draft) writeStudioDraft(draft);
  try {
    window.sessionStorage.setItem(STUDIO_EDIT_CART_KEY, JSON.stringify({
      key: item.key,
      startedAt: Date.now(),
    }));
  } catch {
    return false;
  }
  return Boolean(draft || item.seasonalDraft);
}

export function peekStudioEditKey() {
  if (typeof window === "undefined") return "";
  let parsed = null;
  try {
    parsed = safeParse(window.sessionStorage.getItem(STUDIO_EDIT_CART_KEY));
  } catch {
    return "";
  }
  const key = String(parsed?.key || "");
  const startedAt = Number(parsed?.startedAt || 0);
  if (!key || !startedAt || Date.now() - startedAt > EDIT_INTENT_TTL_MS) {
    clearStudioEditIntent();
    return "";
  }
  return key;
}

export function captureStudioDraftForCartItem(item) {
  if (!item?.isCustom || item?.isDtf || item?.studioDraft) return item;
  const studioDraft = readCurrentStudioDraft();
  return studioDraft ? { ...item, studioDraft } : item;
}
