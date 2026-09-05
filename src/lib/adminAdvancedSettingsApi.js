import { supabase } from "@/lib/supabaseClient";

export const adminAdvancedSettingsApi = {
  async load() {
    const [
      rolesResult,
      permissionsResult,
      rolePermissionsResult,
      assignmentsResult,
      profilesResult,
      templatesResult,
      integrationsResult,
    ] = await Promise.all([
      supabase.from("staff_roles").select("*").order("system_role", { ascending: false }).order("name"),
      supabase.from("staff_permissions").select("*").order("category").order("name"),
      supabase.from("staff_role_permissions").select("*"),
      supabase.from("staff_assignments").select("*, staff_roles(id,key,name)").order("assigned_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name, role, phone, created_at").order("display_name"),
      supabase.from("notification_templates").select("*").order("channel").order("name"),
      supabase.from("app_integrations").select("*").order("category").order("display_name"),
    ]);

    for (const result of [
      rolesResult,
      permissionsResult,
      rolePermissionsResult,
      assignmentsResult,
      profilesResult,
      templatesResult,
      integrationsResult,
    ]) {
      if (result.error) throw result.error;
    }

    return {
      roles: rolesResult.data || [],
      permissions: permissionsResult.data || [],
      rolePermissions: rolePermissionsResult.data || [],
      assignments: assignmentsResult.data || [],
      profiles: profilesResult.data || [],
      templates: templatesResult.data || [],
      integrations: integrationsResult.data || [],
    };
  },

  async saveRole(id, payload) {
    const row = {
      key: String(payload.key || payload.name || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      name: String(payload.name || "").trim(),
      description: payload.description || null,
      system_role: Boolean(payload.systemRole),
      active: payload.active !== false,
    };

    const query = id
      ? supabase.from("staff_roles").update(row).eq("id", id)
      : supabase.from("staff_roles").insert(row);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async replaceRolePermissions(roleId, permissionKeys) {
    const { error: clearError } = await supabase
      .from("staff_role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (clearError) throw clearError;

    const clean = [...new Set(permissionKeys || [])].filter(Boolean);
    if (!clean.length) return;

    const { error } = await supabase
      .from("staff_role_permissions")
      .insert(
        clean.map((permissionKey) => ({
          role_id: roleId,
          permission_key: permissionKey,
        }))
      );

    if (error) throw error;
  },

  async assignStaff(userId, roleId, active = true) {
    const { error } = await supabase
      .from("staff_assignments")
      .upsert(
        {
          user_id: userId,
          role_id: roleId,
          active: Boolean(active),
        },
        { onConflict: "user_id" }
      );

    if (error) throw error;
  },

  async removeStaffAssignment(userId) {
    const { error } = await supabase
      .from("staff_assignments")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
  },

  async saveTemplate(id, payload) {
    const row = {
      key: String(payload.key || payload.name || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      channel: payload.channel || "email",
      name: String(payload.name || "").trim(),
      subject: payload.subject || null,
      body: payload.body || "",
      variables: payload.variables || [],
      active: payload.active !== false,
    };

    const query = id
      ? supabase.from("notification_templates").update(row).eq("id", id)
      : supabase.from("notification_templates").insert(row);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async setTemplateActive(id, active) {
    const { error } = await supabase
      .from("notification_templates")
      .update({ active: Boolean(active) })
      .eq("id", id);

    if (error) throw error;
  },

  async saveIntegration(id, payload) {
    const row = {
      provider: String(payload.provider || "").trim().toLowerCase(),
      display_name: String(payload.displayName || "").trim(),
      category: payload.category || "other",
      status: payload.status || "not_configured",
      enabled: Boolean(payload.enabled),
      public_config: payload.publicConfig || {},
      last_error: payload.lastError || null,
    };

    const query = id
      ? supabase.from("app_integrations").update(row).eq("id", id)
      : supabase.from("app_integrations").insert(row);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async setIntegrationEnabled(id, enabled) {
    const { error } = await supabase
      .from("app_integrations")
      .update({
        enabled: Boolean(enabled),
        status: enabled ? "active" : "paused",
      })
      .eq("id", id);

    if (error) throw error;
  },
};
