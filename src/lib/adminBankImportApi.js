import { supabase } from "@/lib/supabaseClient";

const clean = (value) => String(value || "").trim();

function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    clientKey: clean(row.clientKey),
    sourceRowNumber: Number(row.sourceRowNumber) || 1,
    occurredOn: clean(row.occurredOn),
    direction: clean(row.direction),
    amount: clean(row.amount),
    description: clean(row.description),
    reference: clean(row.reference),
    sourceType: clean(row.sourceType) || "other",
    sourceReference: clean(row.sourceReference),
    expectedAmount: row.expectedAmount === "" || row.expectedAmount == null ? "" : String(row.expectedAmount),
    notes: clean(row.notes),
    raw: row.raw && typeof row.raw === "object" ? row.raw : {},
  }));
}

export const adminBankImportApi = {
  async preview(rows) {
    const normalized = normalizeRows(rows);
    if (!normalized.length) return [];
    const { data, error } = await supabase.rpc("preview_admin_bank_statement_import", {
      p_rows: normalized,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async importStatement({ filename, fileSha256, sourceRowCount, rows }) {
    const normalized = normalizeRows(rows);
    if (!clean(filename)) throw new Error("CSV filename is required.");
    if (!/^[0-9a-f]{64}$/i.test(clean(fileSha256))) throw new Error("CSV file fingerprint is invalid.");
    if (!normalized.length) throw new Error("Select at least one row to import.");
    if (normalized.length > 500) throw new Error("Import at most 500 selected rows at once.");
    const { data, error } = await supabase.rpc("import_admin_bank_statement", {
      p_filename: clean(filename).slice(0, 255),
      p_file_sha256: clean(fileSha256).toLowerCase(),
      p_source_row_count: Number(sourceRowCount) || normalized.length,
      p_rows: normalized,
    });
    if (error) throw error;
    return data;
  },

  async history(limit = 50) {
    const { data, error } = await supabase.rpc("get_admin_bank_import_history", {
      p_limit: Math.max(10, Math.min(Number(limit) || 50, 100)),
    });
    if (error) throw error;
    return data || { batches: [] };
  },
};
