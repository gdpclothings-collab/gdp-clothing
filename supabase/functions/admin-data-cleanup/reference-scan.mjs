import { createStorageReferenceMatcher } from "./policy.mjs";

// Every table that may carry a Storage path must be scanned. Missing tables,
// unreadable rows, implicit API row limits, and oversized datasets fail closed.
export const REQUIRED_REFERENCE_TABLES = Object.freeze([
  "orders", "order_items", "custom_designs", "design_proofs", "products",
  "product_variants", "artwork_library", "content_pages", "store_settings",
  "gdp_invoices",
]);
const PAGE_SIZE = 1000;
const MAX_ROWS_PER_TABLE = 5000;

export async function scanStorageReferences(service, paths) {
  const matcher = createStorageReferenceMatcher(paths);
  // With zero eligible files, no reference search can authorize deletion.
  if (paths.length === 0) return matcher;

  for (const table of REQUIRED_REFERENCE_TABLES) {
    let total = null;
    for (let from = 0; from < MAX_ROWS_PER_TABLE; from += PAGE_SIZE) {
      const query = service.from(table).select("*", from === 0 ? { count: "exact" } : {}).order("id", { ascending: true });
      const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error || !Array.isArray(data) || data.some((row) => !row || typeof row !== "object")) {
        throw new Error("Protected storage reference scan incomplete.");
      }
      if (from === 0) {
        if (!Number.isSafeInteger(count) || count < 0) {
          throw new Error("Protected storage reference count unavailable.");
        }
        total = count;
        if (total >= MAX_ROWS_PER_TABLE) throw new Error("Reference scan exceeded safety limit.");
      }
      const expected = Math.min(PAGE_SIZE, Math.max(0, total - from));
      if (data.length !== expected) throw new Error("Protected storage reference page incomplete.");
      matcher.scan(JSON.stringify(data));
      matcher.scan("\n");
      if (from + data.length >= total) break;
    }
  }
  return matcher;
}
