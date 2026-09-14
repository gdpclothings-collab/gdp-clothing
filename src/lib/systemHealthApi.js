import { supabase } from "@/lib/supabaseClient";

async function invokeHealth(body = { action: "snapshot" }) {
  const { data, error } = await supabase.functions.invoke("system-health", { body });

  if (error) {
    let message = error?.message || "System health check failed.";
    try {
      const payload = await error?.context?.json?.();
      if (payload?.message) message = payload.message;
    } catch {
      // Keep the connector error message when the response body cannot be read.
    }
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.message || "System health check failed.");
  }

  return data?.data ?? data ?? {};
}

export const systemHealthApi = {
  loadSnapshot() {
    return invokeHealth({ action: "snapshot" });
  },
};
