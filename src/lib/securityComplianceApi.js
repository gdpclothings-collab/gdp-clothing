import { supabase } from "@/lib/supabaseClient";

function assertResult(result, fallback) {
  if (result.error) throw result.error;
  return result.data ?? fallback;
}

export const securityComplianceApi = {
  async load() {
    const [snapshotResult, controlsResult, incidentsResult, privacyRequestsResult] = await Promise.all([
      supabase.rpc("security_compliance_snapshot"),
      supabase
        .from("security_compliance_controls")
        .select("*")
        .order("category", { ascending: true })
        .order("title", { ascending: true }),
      supabase
        .from("security_incidents")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(50),
      supabase
        .from("privacy_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    return {
      snapshot: assertResult(snapshotResult, {}),
      controls: assertResult(controlsResult, []),
      incidents: assertResult(incidentsResult, []),
      privacyRequests: assertResult(privacyRequestsResult, []),
    };
  },

  async createIncident({ title, severity = "medium", personalInformationInvolved = false }) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const result = await supabase
      .from("security_incidents")
      .insert({
        title,
        severity,
        status: "open",
        personal_information_involved: Boolean(personalInformationInvolved),
        created_by: authData?.user?.id || null,
      })
      .select("*")
      .single();

    return assertResult(result, null);
  },

  async updateIncident(id, changes) {
    const payload = { updated_at: new Date().toISOString() };
    for (const key of [
      "severity",
      "status",
      "rrosh_assessment",
      "notification_required",
      "containment_notes",
      "root_cause",
      "remediation",
    ]) {
      if (changes[key] !== undefined) payload[key] = changes[key];
    }

    const result = await supabase
      .from("security_incidents")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    return assertResult(result, null);
  },

  async updatePrivacyRequest(id, changes) {
    const payload = { updated_at: new Date().toISOString() };
    if (changes.status !== undefined) payload.status = changes.status;
    if (changes.response_notes !== undefined) payload.response_notes = changes.response_notes;
    if (changes.status === "completed") payload.completed_at = new Date().toISOString();

    const result = await supabase
      .from("privacy_requests")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    return assertResult(result, null);
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
