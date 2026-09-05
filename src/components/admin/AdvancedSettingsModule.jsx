import React, { useEffect, useMemo, useState } from "react";
import {
  UserRoundCog,
  Bell,
  Blocks,
  Plus,
  RefreshCw,
  CheckCircle2,
  X,
  Save,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { adminAdvancedSettingsApi } from "@/lib/adminAdvancedSettingsApi";

export default function AdvancedSettingsModule() {
  const [tab, setTab] = useState("staff");
  const [data, setData] = useState({
    roles: [],
    permissions: [],
    rolePermissions: [],
    assignments: [],
    profiles: [],
    templates: [],
    integrations: [],
  });
  const [roleEditor, setRoleEditor] = useState(null);
  const [templateEditor, setTemplateEditor] = useState(null);
  const [integrationEditor, setIntegrationEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminAdvancedSettingsApi.load());
    } catch (err) {
      console.error("Advanced settings load failed:", err);
      setError(err?.message || "Could not load advanced settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  return (
    <div className="mt-6">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e8e8e8] flex flex-col md:flex-row md:items-center gap-3">
          <div>
            <div className="text-sm font-semibold">Advanced administration</div>
            <div className="text-xs text-[#777] mt-0.5">
              Staff role templates, notification content and integration metadata
            </div>
          </div>

          <div className="md:ml-auto inline-flex rounded-lg border border-[#d5d5d5] bg-[#fafafa] p-1">
            {[
              ["staff", "Staff", UserRoundCog],
              ["notifications", "Notifications", Bell],
              ["integrations", "Integrations", Blocks],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-2 ${
                  tab === id ? "bg-[#222] text-white" : "hover:bg-white"
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {tab === "staff" && (
          <StaffTab
            data={data}
            loading={loading}
            onCreateRole={() => setRoleEditor({ role: null })}
            onEditRole={(role) => setRoleEditor({ role })}
            onChanged={async (message) => {
              showNotice(message);
              await load();
            }}
          />
        )}

        {tab === "notifications" && (
          <NotificationsTab
            templates={data.templates}
            loading={loading}
            onCreate={() => setTemplateEditor({ template: null })}
            onEdit={(template) => setTemplateEditor({ template })}
            onChanged={async (message) => {
              showNotice(message);
              await load();
            }}
          />
        )}

        {tab === "integrations" && (
          <IntegrationsTab
            integrations={data.integrations}
            loading={loading}
            onCreate={() => setIntegrationEditor({ integration: null })}
            onEdit={(integration) => setIntegrationEditor({ integration })}
            onChanged={async (message) => {
              showNotice(message);
              await load();
            }}
          />
        )}
      </section>

      {roleEditor && (
        <RoleEditor
          role={roleEditor.role}
          permissions={data.permissions}
          rolePermissions={data.rolePermissions}
          onClose={() => setRoleEditor(null)}
          onSaved={async (message) => {
            setRoleEditor(null);
            showNotice(message);
            await load();
          }}
        />
      )}

      {templateEditor && (
        <TemplateEditor
          template={templateEditor.template}
          onClose={() => setTemplateEditor(null)}
          onSaved={async (message) => {
            setTemplateEditor(null);
            showNotice(message);
            await load();
          }}
        />
      )}

      {integrationEditor && (
        <IntegrationEditor
          integration={integrationEditor.integration}
          onClose={() => setIntegrationEditor(null)}
          onSaved={async (message) => {
            setIntegrationEditor(null);
            showNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function StaffTab({ data, loading, onCreateRole, onEditRole, onChanged }) {
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  const assignmentMap = useMemo(
    () => new Map(data.assignments.map((assignment) => [assignment.user_id, assignment])),
    [data.assignments]
  );

  const assign = async () => {
    if (!selectedUser || !selectedRole) return;
    try {
      await adminAdvancedSettingsApi.assignStaff(selectedUser, selectedRole, true);
      setSelectedUser("");
      setSelectedRole("");
      await onChanged("Staff role template assigned.");
    } catch (err) {
      console.error("Staff assignment failed:", err);
      window.alert(err?.message || "Could not assign staff role.");
    }
  };

  const remove = async (userId) => {
    try {
      await adminAdvancedSettingsApi.removeStaffAssignment(userId);
      await onChanged("Staff role template removed.");
    } catch (err) {
      console.error("Staff assignment removal failed:", err);
      window.alert(err?.message || "Could not remove assignment.");
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 flex gap-2">
        <ShieldCheck size={15} className="text-blue-700 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 leading-5">
          These are fine-grained role templates for the commerce architecture. Existing Supabase admin authorization remains unchanged, so assigning a template does not silently grant database access.
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_1.2fr] gap-5">
        <section className="rounded-xl border border-[#e1e1e1] overflow-hidden">
          <div className="px-3 py-3 border-b border-[#eeeeee] bg-[#fafafa] flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Role templates</div>
              <div className="text-xs text-[#777] mt-0.5">{data.roles.length} configured</div>
            </div>
            <button onClick={onCreateRole} className="w-8 h-8 rounded-lg border border-[#d5d5d5] bg-white grid place-items-center">
              <Plus size={14} />
            </button>
          </div>
          <div className="divide-y divide-[#eeeeee]">
            {loading ? (
              <div className="p-6 text-center text-sm text-[#777]">Loading roles…</div>
            ) : data.roles.map((role) => {
              const permissionCount = data.rolePermissions.filter((item) => item.role_id === role.id).length;
              return (
                <button key={role.id} onClick={() => onEditRole(role)} className="w-full px-4 py-3 text-left hover:bg-[#fafafa]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{role.name}</span>
                    {role.system_role && <span className="rounded-full bg-[#eeeeee] px-2 py-0.5 text-[9px] font-semibold">SYSTEM</span>}
                    <span className="ml-auto text-xs text-[#777]">{permissionCount} permissions</span>
                  </div>
                  <div className="text-[11px] text-[#777] mt-1">{role.description || role.key}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[#e1e1e1] overflow-hidden">
          <div className="px-3 py-3 border-b border-[#eeeeee] bg-[#fafafa]">
            <div className="text-sm font-semibold">Assignments</div>
            <div className="text-xs text-[#777] mt-0.5">Map profiles to operational role templates</div>
          </div>

          <div className="p-3 border-b border-[#eeeeee] flex flex-col sm:flex-row gap-2">
            <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} className={inputClass}>
              <option value="">Choose profile</option>
              {data.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name || profile.id} · current {profile.role}
                </option>
              ))}
            </select>
            <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} className={inputClass}>
              <option value="">Choose role template</option>
              {data.roles.filter((role) => role.active).map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <button onClick={assign} disabled={!selectedUser || !selectedRole} className="h-10 px-3 rounded-lg bg-[#222] text-white text-xs font-semibold disabled:opacity-40">
              Assign
            </button>
          </div>

          <div className="divide-y divide-[#eeeeee]">
            {data.profiles.map((profile) => {
              const assignment = assignmentMap.get(profile.id);
              return (
                <div key={profile.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f0f0f0] grid place-items-center text-xs font-semibold">
                    {(profile.display_name || "U").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{profile.display_name || "User"}</div>
                    <div className="text-[11px] text-[#777]">
                      Auth role: {profile.role} · Template: {assignment?.staff_roles?.name || "None"}
                    </div>
                  </div>
                  {assignment && (
                    <button onClick={() => remove(profile.id)} className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] text-xs">
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function NotificationsTab({ templates, loading, onCreate, onEdit, onChanged }) {
  const toggle = async (template) => {
    try {
      await adminAdvancedSettingsApi.setTemplateActive(template.id, !template.active);
      await onChanged(`${template.name} ${template.active ? "disabled" : "enabled"}.`);
    } catch (err) {
      console.error("Template toggle failed:", err);
      window.alert(err?.message || "Could not update template.");
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Notification templates</div>
          <div className="text-xs text-[#777] mt-0.5">Reusable content for transactional email, SMS, push or internal alerts</div>
        </div>
        <button onClick={onCreate} className={primaryButton}><Plus size={14} /> Add template</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#e1e1e1]">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-[#fafafa] text-[#707070] text-xs">
            <tr>
              <Th>Template</Th>
              <Th>Channel</Th>
              <Th>Subject</Th>
              <Th>Variables</Th>
              <Th>Status</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="py-12 text-center text-[#777]">Loading templates…</td></tr>
            ) : templates.length ? (
              templates.map((template) => (
                <tr key={template.id} className="border-t border-[#eeeeee]">
                  <Td>
                    <button onClick={() => onEdit(template)} className="text-left">
                      <div className="font-semibold">{template.name}</div>
                      <div className="text-[11px] text-[#777]">{template.key}</div>
                    </button>
                  </Td>
                  <Td><span className="capitalize">{template.channel}</span></Td>
                  <Td>{template.subject || "—"}</Td>
                  <Td>{(template.variables || []).join(", ") || "—"}</Td>
                  <Td><Status active={template.active} /></Td>
                  <Td right>
                    <div className="inline-flex gap-2">
                      <button onClick={() => onEdit(template)} className={secondaryButton}>Edit</button>
                      <button onClick={() => toggle(template)} className={secondaryButton}>
                        {template.active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </Td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="6" className="py-12 text-center text-[#777]">No notification templates.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IntegrationsTab({ integrations, loading, onCreate, onEdit, onChanged }) {
  const toggle = async (integration) => {
    try {
      await adminAdvancedSettingsApi.setIntegrationEnabled(
        integration.id,
        !integration.enabled
      );
      await onChanged(
        `${integration.display_name} ${integration.enabled ? "paused" : "enabled"}.`
      );
    } catch (err) {
      console.error("Integration toggle failed:", err);
      window.alert(err?.message || "Could not update integration.");
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2">
        <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 leading-5">
          This table stores non-secret integration metadata only. API keys, webhook secrets and service-role credentials stay in secure server environment variables.
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Integration registry</div>
          <div className="text-xs text-[#777] mt-0.5">Operational status and safe public configuration metadata</div>
        </div>
        <button onClick={onCreate} className={primaryButton}><Plus size={14} /> Add integration</button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-[#777]">Loading integrations…</div>
        ) : integrations.map((integration) => (
          <div key={integration.id} className="rounded-xl border border-[#e1e1e1] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#f2f2f2] grid place-items-center">
                <Blocks size={16} />
              </div>
              <Status active={integration.enabled} text={integration.status} />
            </div>
            <button onClick={() => onEdit(integration)} className="font-semibold text-left mt-4">
              {integration.display_name}
            </button>
            <div className="text-xs text-[#777] mt-1">{integration.provider} · {integration.category}</div>
            <div className="mt-3 text-[11px] text-[#777]">
              {Object.keys(integration.public_config || {}).length} public config field(s)
            </div>
            {integration.last_error && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-100 p-2 text-[11px] text-red-700">
                {integration.last_error}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => onEdit(integration)} className={secondaryButton}>Edit</button>
              <button onClick={() => toggle(integration)} className={secondaryButton}>
                {integration.enabled ? "Pause" : "Enable"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleEditor({ role, permissions, rolePermissions, onClose, onSaved }) {
  const existing = rolePermissions
    .filter((item) => item.role_id === role?.id)
    .map((item) => item.permission_key);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    key: role?.key || "",
    name: role?.name || "",
    description: role?.description || "",
    systemRole: Boolean(role?.system_role),
    active: role?.active !== false,
    permissionKeys: existing,
  });

  const grouped = useMemo(() => {
    const map = new Map();
    for (const permission of permissions) {
      if (!map.has(permission.category)) map.set(permission.category, []);
      map.get(permission.category).push(permission);
    }
    return [...map.entries()];
  }, [permissions]);

  const togglePermission = (key) =>
    setForm((current) => ({
      ...current,
      permissionKeys: current.permissionKeys.includes(key)
        ? current.permissionKeys.filter((value) => value !== key)
        : [...current.permissionKeys, key],
    }));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await adminAdvancedSettingsApi.saveRole(role?.id || null, form);
      await adminAdvancedSettingsApi.replaceRolePermissions(
        saved.id,
        form.permissionKeys
      );
      await onSaved(role?.id ? "Role template updated." : "Role template created.");
    } catch (err) {
      console.error("Role save failed:", err);
      window.alert(err?.message || "Could not save role.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={role ? "Edit role template" : "Create role template"} onClose={onClose} onSave={save} saving={saving} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Role name">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Role key">
          <input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} className={inputClass} disabled={Boolean(role?.system_role)} />
        </Field>
      </div>
      <Field label="Description">
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={textareaClass} rows="3" />
      </Field>
      <Toggle label="Role template active" checked={form.active} onChange={(active) => setForm({ ...form, active })} />

      <section className="rounded-xl border border-[#dedede] overflow-hidden">
        <div className="px-4 py-3 bg-[#fafafa] border-b border-[#e8e8e8]">
          <div className="text-sm font-semibold">Permissions</div>
          <div className="text-xs text-[#777] mt-0.5">{form.permissionKeys.length} selected</div>
        </div>
        <div className="p-4 grid md:grid-cols-2 gap-4">
          {grouped.map(([category, items]) => (
            <div key={category} className="rounded-lg border border-[#e4e4e4] overflow-hidden">
              <div className="px-3 py-2 bg-[#fafafa] text-[10px] font-semibold uppercase tracking-wide text-[#777]">
                {category}
              </div>
              <div className="divide-y divide-[#eeeeee]">
                {items.map((permission) => (
                  <label key={permission.key} className="px-3 py-2.5 flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.permissionKeys.includes(permission.key)}
                      onChange={() => togglePermission(permission.key)}
                    />
                    <div>
                      <div className="font-medium">{permission.name}</div>
                      <div className="text-[10px] text-[#777] mt-0.5">{permission.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Editor>
  );
}

function TemplateEditor({ template, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    key: template?.key || "",
    channel: template?.channel || "email",
    name: template?.name || "",
    subject: template?.subject || "",
    body: template?.body || "",
    variables: (template?.variables || []).join(", "),
    active: template?.active !== false,
  });

  const save = async () => {
    setSaving(true);
    try {
      await adminAdvancedSettingsApi.saveTemplate(template?.id || null, {
        ...form,
        variables: form.variables
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      await onSaved(template?.id ? "Notification template updated." : "Notification template created.");
    } catch (err) {
      console.error("Template save failed:", err);
      window.alert(err?.message || "Could not save notification template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={template ? "Edit notification template" : "Create notification template"} onClose={onClose} onSave={save} saving={saving}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Name">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Key">
          <input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Channel">
          <select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })} className={inputClass}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
            <option value="internal">Internal</option>
          </select>
        </Field>
        <Field label="Variables">
          <input value={form.variables} onChange={(event) => setForm({ ...form, variables: event.target.value })} className={inputClass} placeholder="order_number, customer_name" />
        </Field>
      </div>
      <Field label="Subject">
        <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className={inputClass} />
      </Field>
      <Field label="Message body">
        <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} className={textareaClass} rows="8" />
      </Field>
      <Toggle label="Template active" checked={form.active} onChange={(active) => setForm({ ...form, active })} />
    </Editor>
  );
}

function IntegrationEditor({ integration, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    provider: integration?.provider || "",
    displayName: integration?.display_name || "",
    category: integration?.category || "other",
    status: integration?.status || "not_configured",
    enabled: Boolean(integration?.enabled),
    publicConfig: JSON.stringify(integration?.public_config || {}, null, 2),
    lastError: integration?.last_error || "",
  });

  const save = async () => {
    let publicConfig = {};
    try {
      publicConfig = form.publicConfig.trim()
        ? JSON.parse(form.publicConfig)
        : {};
    } catch {
      window.alert("Public configuration must be valid JSON.");
      return;
    }

    setSaving(true);
    try {
      await adminAdvancedSettingsApi.saveIntegration(integration?.id || null, {
        ...form,
        publicConfig,
      });
      await onSaved(integration?.id ? "Integration metadata updated." : "Integration added.");
    } catch (err) {
      console.error("Integration save failed:", err);
      window.alert(err?.message || "Could not save integration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={integration ? "Edit integration" : "Add integration"} onClose={onClose} onSave={save} saving={saving}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Provider">
          <input value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Display name">
          <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Category">
          <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className={inputClass}>
            <option value="not_configured">Not configured</option>
            <option value="configured">Configured</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="error">Error</option>
          </select>
        </Field>
      </div>
      <Field label="Safe public configuration JSON">
        <textarea value={form.publicConfig} onChange={(event) => setForm({ ...form, publicConfig: event.target.value })} className="w-full rounded-lg border border-[#d4d4d4] bg-[#111] text-[#eee] px-3 py-2 text-xs font-mono outline-none" rows="8" />
      </Field>
      <Field label="Last error / note">
        <textarea value={form.lastError} onChange={(event) => setForm({ ...form, lastError: event.target.value })} className={textareaClass} rows="3" />
      </Field>
      <Toggle label="Integration enabled" checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} />
    </Editor>
  );
}

function Editor({ title, onClose, onSave, saving, children, wide }) {
  return (
    <div className="fixed inset-0 z-[85] bg-black/40 p-3 sm:p-8 flex items-start justify-center overflow-y-auto">
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-2xl"} bg-white rounded-2xl shadow-2xl overflow-hidden my-6`}>
        <div className="h-16 px-5 border-b border-[#e3e3e3] flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="px-5 py-4 border-t border-[#e3e3e3] flex justify-end gap-2">
          <button onClick={onClose} className={secondaryButton}>Cancel</button>
          <button onClick={onSave} disabled={saving} className={primaryButton}>
            <Save size={14} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm rounded-lg border border-[#e2e2e2] bg-[#fafafa] px-3 py-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function Status({ active, text }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${
      active ? "bg-emerald-100 text-emerald-800" : "bg-[#eeeeee] text-[#555]"
    }`}>
      {text ? String(text).replaceAll("_", " ") : active ? "Active" : "Inactive"}
    </span>
  );
}

function Th({ children, right }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textareaClass = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";
const primaryButton = "h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40";
const secondaryButton = "h-8 px-2.5 rounded-lg border border-[#d5d5d5] bg-white text-xs inline-flex items-center justify-center gap-1.5";
