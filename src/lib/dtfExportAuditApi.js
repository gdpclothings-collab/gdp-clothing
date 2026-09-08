import { supabase } from "@/lib/supabaseClient";

export const dtfExportAuditApi = {
  async record({ exportType, width, length, artworkCount, source = "builder", orderId = null, orderItemId = null }) {
    const { error } = await supabase.from("dtf_export_audit_log").insert({
      export_type: exportType,
      film_width: Number(width),
      film_length: Number(length),
      artwork_count: Number(artworkCount || 0),
      source,
      order_id: orderId,
      order_item_id: orderItemId,
    });
    if (error) throw error;
  },
};
