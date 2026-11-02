export const CLEANUP_BUCKETS = Object.freeze(["customer-uploads", "dtf-artwork"]);
export const PRIMARY_ADMIN_EMAIL = "gdpclothings@gmail.com";
export const MAX_BATCH = 10;
export const MIN_FILE_AGE_MS = 24 * 60 * 60 * 1000;

export function validStoragePath(path) {
  return typeof path === "string" && path.length > 0 && path.length <= 900 &&
    !path.startsWith("/") && !path.endsWith("/") &&
    !path.split("/").some((part) => !part || part === "." || part === "..") &&
    !/[\u0000-\u001f\\]/.test(path);
}

export function allowFile(bucket, path, createdAt, now = Date.now()) {
  if (!CLEANUP_BUCKETS.includes(bucket) || !validStoragePath(path)) return false;
  const created = Date.parse(createdAt || "");
  return Number.isFinite(created) && created <= now - MIN_FILE_AGE_MS;
}

export function allowOrder(order) {
  if (!order || !["test", "live"].includes(order.payment_mode)) return false;
  if (["paid", "refunded", "partially_refunded"].includes(order.payment_status)) return false;
  if (["paid", "completed", "fulfilled", "shipped", "delivered", "refunded", "partially_refunded"].includes(order.status)) return false;
  if (["fulfilled", "shipped", "out_for_delivery", "delivered", "picked_up"].includes(order.fulfillment_status)) return false;
  if (order.payment_mode === "test") return true;
  return !order.stripe_payment_intent_id && !order.stripe_checkout_session_id &&
    ["failed", "pending"].includes(order.payment_status) &&
    ["payment_failed", "cancelled", "pending_payment", "draft"].includes(order.status);
}

export function allowAccount(user, role, actorId) {
  return Boolean(user?.id) && user.id !== actorId &&
    user.email?.toLowerCase() !== PRIMARY_ADMIN_EMAIL &&
    role === "customer" && !user.deleted_at;
}

export function isReferencedByText(path, content) {
  if (!validStoragePath(path)) return true;
  // Treat stored URL encoded paths and filename references as in-use.
  const needles = [path, encodeURIComponent(path), path.split("/").map(encodeURIComponent).join("/")];
  return needles.some((needle) => content.includes(needle));
}

export function selectedTargets(targets, max = MAX_BATCH) {
  if (!Array.isArray(targets) || targets.length === 0 || targets.length > max) return null;
  if (!targets.every((target) => typeof target === "string" && target.length <= 900)) return null;
  if (new Set(targets).size !== targets.length) return null;
  return targets;
}

// The admin cleanup preview checks hundreds of Storage paths against structured
// commerce records. Match all encoded/plain path variants in ONE pass through
// each reference page, instead of rescanning the full payload for every file.
// Incomplete/oversized scans throw so no file can become deletion-eligible.
export function createStorageReferenceMatcher(paths) {
  if (!Array.isArray(paths) || paths.length > 2000 || paths.some((path) => !validStoragePath(path))) {
    throw new Error("Invalid storage reference scan.");
  }
  // Reject excessive input before allocating the trie or consuming CPU.
  let needleUnits = 0;
  const variantsByPath = paths.map((path) => {
    const variants = [...new Set([path, encodeURIComponent(path), path.split("/").map(encodeURIComponent).join("/")])];
    needleUnits += variants.reduce((sum, needle) => sum + needle.length, 0);
    return { path, variants };
  });
  if (needleUnits > 600000) throw new Error("Storage reference scan exceeds safe limits.");
  const nodes = [{ next: new Map(), fail: 0, paths: [] }];
  for (const { path, variants } of variantsByPath) {
    for (const needle of variants) {
      let state = 0;
      for (let i = 0; i < needle.length; i++) {
        const ch = needle[i];
        let child = nodes[state].next.get(ch);
        if (child === undefined) {
          child = nodes.length;
          nodes[state].next.set(ch, child);
          nodes.push({ next: new Map(), fail: 0, paths: [] });
        }
        state = child;
      }
      nodes[state].paths.push(path);
    }
  }

  // Aho-Corasick failure links keep matching linear in input size, including
  // overlapping filenames and paths embedded inside complete URLs or JSON.
  const queue = [...nodes[0].next.values()];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const [ch, child] of nodes[current].next) {
      let fallback = nodes[current].fail;
      while (fallback && !nodes[fallback].next.has(ch)) fallback = nodes[fallback].fail;
      nodes[child].fail = nodes[fallback].next.get(ch) ?? 0;
      nodes[child].paths.push(...nodes[nodes[child].fail].paths);
      queue.push(child);
    }
  }

  const referenced = new Set();
  let state = 0;
  return {
    scan(chunk) {
      if (typeof chunk !== "string") throw new Error("Incomplete storage reference data.");
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];
        while (state && !nodes[state].next.has(ch)) state = nodes[state].fail;
        state = nodes[state].next.get(ch) ?? 0;
        for (const path of nodes[state].paths) referenced.add(path);
      }
    },
    isReferenced(path) {
      return referenced.has(path);
    },
  };
}
