import { supabase } from "@/lib/supabaseClient";

export const adminSupportTicketsApi = {
  async list() {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return data || [];
  },

  async update(id, patch) {
    const payload = {};

    if ("status" in patch) payload.status = patch.status;
    if ("priority" in patch) payload.priority = patch.priority;

    const { data, error } = await supabase
      .from("support_tickets")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },
};
