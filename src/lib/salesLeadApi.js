import { supabase } from "@/lib/supabaseClient";

export const ORDER_TYPES = [
  { value: "custom_apparel", label: "Custom apparel" },
  { value: "bulk_apparel", label: "Bulk shirts / hoodies" },
  { value: "dtf_transfers", label: "DTF transfers" },
  { value: "team_event", label: "Team / event order" },
  { value: "other", label: "Other" },
];

export const BUDGET_RANGES = [
  { value: "", label: "Not sure yet" },
  { value: "under_250", label: "Under $250" },
  { value: "250_499", label: "$250–$499" },
  { value: "500_999", label: "$500–$999" },
  { value: "1000_2499", label: "$1,000–$2,499" },
  { value: "2500_plus", label: "$2,500+" },
];

export const LEAD_STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "quoted", label: "Quoted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "nurture", label: "Nurture" },
];

function clean(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

export const salesLeadApi = {
  async submit(payload) {
    const { data, error } = await supabase.functions.invoke("submit-sales-lead", {
      body: payload,
    });

    if (error) {
      throw new Error(error.message || "Unable to submit your request.");
    }
    if (data?.error) {
      throw new Error(data.message || "Unable to submit your request.");
    }

    return data?.data || data;
  },

  async list() {
    const { data, error } = await supabase
      .from("sales_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return data || [];
  },

  async update(id, patch) {
    const allowed = {
      status: patch.status,
      admin_notes: patch.admin_notes,
      next_follow_up_at: patch.next_follow_up_at,
      last_contacted_at: patch.last_contacted_at,
    };

    const normalized = Object.fromEntries(
      Object.entries(allowed).filter(([, value]) => value !== undefined)
    );

    if (typeof normalized.admin_notes === "string") {
      normalized.admin_notes = clean(normalized.admin_notes, 5000) || null;
    }

    const { data, error } = await supabase
      .from("sales_leads")
      .update(normalized)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },
};
