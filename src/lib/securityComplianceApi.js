import { supabase } from "@/lib/supabaseClient";

function assertResult(result, fallback) {
  if (result.error) throw result.error;
  return result.data ?? fallback;
}

export const securityComplianceApi = {
  async load() {
    const [snapshotResult, controlsResult] = await Promise.all([
      supabase.rpc("security_compliance_snapshot"),
      supabase
        .from("security_compliance_controls")
        .select("*")
        .order("category", { ascending: true })
        .order("title", { ascending: true }),
    ]);

    return {
      snapshot: assertResult(snapshotResult, {}),
      controls: assertResult(controlsResult, []),
    };
  },

  async updateControl(controlKey, changes) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const payload = {
      updated_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: authData?.user?.id || null,
    };

    if (changes.status !== undefined) payload.status = changes.status;
    if (changes.evidence !== undefined) payload.evidence = changes.evidence;
    if (changes.owner_label !== undefined) payload.owner_label = changes.owner_label;

    const result = await supabase
      .from("security_compliance_controls")
      .update(payload)
      .eq("control_key", controlKey)
      .select("*")
      .single();

    return assertResult(result, null);
  },
};
