export function customerStorageScope(user) {
  const userId = String(user?.id || "").trim();
  return userId ? `user_${userId}` : "guest";
}

export function scopedStorageKey(baseKey, user) {
  return `${baseKey}__${customerStorageScope(user)}`;
}

export function readStoredJson(key, fallback = []) {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in hardened/private browser modes.
  }
}

export function removeStoredKey(key) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage is optional; in-memory state remains usable.
  }
}
