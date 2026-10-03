import { supabase } from "@/lib/supabaseClient";

const BUCKET = "finance-receipts";
const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const clean = (value) => String(value || "").trim();

function validateExpenseId(expenseId) {
  const id = clean(expenseId);
  if (!id) throw new Error("Expense is required.");
  return id;
}

function validateFile(file) {
  if (!file || typeof file.name !== "string" || typeof file.size !== "number") {
    throw new Error("Choose a receipt or invoice file.");
  }

  const mimeType = clean(file.type).toLowerCase();
  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) throw new Error("Receipt must be a PDF, JPG, PNG, or WebP file.");
  if (file.size < 1) throw new Error("Receipt file is empty.");
  if (file.size > MAX_BYTES) throw new Error("Receipt file must be 10 MB or smaller.");

  const fileName = clean(file.name).slice(0, 255) || `receipt.${extension}`;
  return { mimeType, extension, fileName, sizeBytes: file.size };
}

function uniqueObjectName(extension) {
  const id = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${id}.${extension}`;
}

async function removeStoragePath(path) {
  if (!path) return "";
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return error ? "The bookkeeping link is updated, but an old private storage object could not be cleaned up automatically." : "";
}

export const adminExpenseReceiptApi = {
  bucket: BUCKET,
  maxBytes: MAX_BYTES,

  async upload(expenseId, file) {
    const id = validateExpenseId(expenseId);
    const metadata = validateFile(file);
    const path = `${id}/${uniqueObjectName(metadata.extension)}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: metadata.mimeType,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    let linked;
    try {
      const { data, error } = await supabase.rpc("set_admin_expense_receipt", {
        p_expense_id: id,
        p_receipt_path: path,
        p_file_name: metadata.fileName,
        p_mime_type: metadata.mimeType,
        p_size_bytes: metadata.sizeBytes,
      });
      if (error) throw error;
      linked = data || {};
    } catch (error) {
      await removeStoragePath(path);
      throw error;
    }

    const previousPath = linked?.previousPath || linked?.previouspath || null;
    const cleanupWarning = previousPath && previousPath !== path
      ? await removeStoragePath(previousPath)
      : "";

    return { ...linked, cleanupWarning };
  },

  async remove(expenseId) {
    const id = validateExpenseId(expenseId);
    const { data, error } = await supabase.rpc("remove_admin_expense_receipt", {
      p_expense_id: id,
    });
    if (error) throw error;

    const previousPath = data?.previousPath || data?.previouspath || null;
    const cleanupWarning = previousPath ? await removeStoragePath(previousPath) : "";
    return { ...(data || {}), cleanupWarning };
  },

  async createViewUrl(path) {
    const objectPath = clean(path);
    if (!objectPath) throw new Error("Receipt file is not attached.");

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, 60);
    if (error) throw error;
    const signedUrl = data?.signedUrl;
    if (!signedUrl) throw new Error("Could not create a secure receipt link.");
    return signedUrl;
  },
};
