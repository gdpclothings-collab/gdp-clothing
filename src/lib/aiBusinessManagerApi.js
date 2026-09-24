import { supabase } from "@/lib/supabaseClient";

async function invokeBusinessManager(body = { action: "summary" }) {
  const { data, error } = await supabase.functions.invoke("ai-business-manager-readonly", { body });

  if (error) {
    let message = error?.message || "Business Manager summary failed.";
    try {
      const payload = await error?.context?.json?.();
      if (payload?.message) message = payload.message;
    } catch {
      // Keep the connector error when the response body cannot be read.
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.message || "Business Manager summary failed.");
  return data?.data ?? data ?? {};
}

export const aiBusinessManagerApi = {
  loadSummary() {
    return invokeBusinessManager({ action: "summary" });
  },
};
