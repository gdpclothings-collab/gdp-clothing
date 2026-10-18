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