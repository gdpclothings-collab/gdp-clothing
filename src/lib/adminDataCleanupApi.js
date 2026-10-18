import { supabase } from "@/lib/supabaseClient";

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke("admin-data-cleanup", {
    body: { action, ...payload },
  });
  if (error) {
    let reason = "";
    try { reason = (await error.context?.json())?.error || ""; } catch { /* network or non-JSON error */ }
    throw new Error(reason || error.message || "Admin cleanup service unavailable.");
  }
  if (data?.error) throw new Error(data.error);
  return data?.data ?? null;
}

export const adminDataCleanupApi = {
  previewFiles(bucket) { return invoke("preview_files", { bucket }); },
  previewOrders() { return invoke("preview_orders"); },
  previewAccounts() { return invoke("preview_accounts"); },
  history() { return invoke("history"); },
  deleteFiles(bucket, paths) { return invoke("delete_files", { bucket, paths, confirm: "DELETE FILES" }); },
  deleteOrders(ids) { return invoke("delete_orders", { ids, confirm: "DELETE ORDERS" }); },
  deleteAccount(id, email) { return invoke("delete_account", { id, email, confirm: "DELETE ACCOUNT" }); },
};