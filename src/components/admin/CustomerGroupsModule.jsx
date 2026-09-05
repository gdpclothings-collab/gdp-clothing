import React, { useEffect, useMemo, useState } from "react";
import {
  Tags,
  UsersRound,
  Plus,
  RefreshCw,
  CheckCircle2,
  Search,
  X,
  Save,
  UserPlus,
} from "lucide-react";
import { adminCustomerGroupsApi } from "@/lib/adminCustomerGroupsApi";

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function matchesDynamic(customer, rules = {}) {
  const minSpent = Number(rules.minSpent || 0);
  const minOrders = Number(rules.minOrders || 0);
  const days = Number(rules.lastOrderWithinDays || 0);

  if (minSpent > 0 && Number(customer.totalSpent || 0) < minSpent) return false;
  if (minOrders > 0 && Number(customer.orders || 0) < minOrders) return false;

  if (days > 0) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    if (!customer.lastOrderAt || new Date(customer.lastOrderAt).getTime() < cutoff) {
      return false;
    }
  }

  return true;
}

export default function CustomerGroupsModule() {
  const [tab, setTab] = useState("tags");
  const [data, setData] = useState({
    tags: [],
    assignments: [],
    segments: [],
    members: [],
    customers: [],
  });
  const [tagEditor, setTagEditor] = useState(null);
  const [segmentEditor, setSegmentEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminCustomerGroupsApi.load());
    } catch (err) {
      console.error("Customer groups load failed:", err);
      setError(err?.message || "Could not load customer groups.");
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
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Metric label="Customer tags" value={data.tags.length} icon={Tags} />
        <Metric label="Segments" value={data.segments.length} icon={UsersRound} />
        <Metric label="Customer directory" value={data.customers.length} icon={UserPlus} />
      </div>

      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#d5d5d5] bg-white p-1 w-fit">
          {[
            { id: "tags", label: "Tags", Icon: Tags },
            { id: "segments", label: "Segments", Icon: UsersRound },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-2 ${
                tab === id ? "bg-[#222] text-white" : "hover:bg-[#f5f5f5]"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 w-fit"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {tab === "tags" && (
        <TagsTab
          data={data}
          loading={loading}
          onCreate={() => setTagEditor({ tag: null })}
          onEdit={(tag) => setTagEditor({ tag })}
          onChanged={async (message) => {
            showNotice(message);
            await load();
          }}
        />
      )}

      {tab === "segments" && (
        <SegmentsTab
          data={data}
          loading={loading}
          onCreate={() => setSegmentEditor({ segment: null })}
          onEdit={(segment) => setSegmentEditor({ segment })}
          onChanged={async (message) => {
            showNotice(message);
            await load();
          }}
        />
      )}

      {tagEditor && (
        <TagEditor
          tag={tagEditor.tag}
          onClose={() => setTagEditor(null)}
          onSaved={async (message) => {
            setTagEditor(null);
            showNotice(message);
            await load();
          }}
        />
      )}

      {segmentEditor && (
        <SegmentEditor
          segment={segmentEditor.segment}
          customers={data.customers}
          members={data.members}
          onClose={() => setSegmentEditor(null)}
          onSaved={async (message) => {
            setSegmentEditor(null);
            showNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function TagsTab({ data, loading, onCreate, onEdit, onChanged }) {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  const assignmentMap = useMemo(() => {
    const map = new Map();
    for (const assignment of data.assignments) {
      const email = String(assignment.customer_email || "").toLowerCase();
      if (!map.has(email)) map.set(email, []);
      map.get(email).push(assignment);
    }
    return map;
  }, [data.assignments]);

  const visibleCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data.customers;
    return data.customers.filter((customer) =>
      [customer.name, customer.email, customer.phone]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [data.customers, search]);

  const assign = async () => {
    if (!selectedCustomer || !selectedTag) return;
    try {
      await adminCustomerGroupsApi.assignTag(selectedCustomer, selectedTag);
      setSelectedTag("");
      await onChanged("Customer tag assigned.");
    } catch (err) {
      console.error("Tag assignment failed:", err);
      window.alert(err?.message || "Could not assign tag.");
    }
  };

  const remove = async (email, tagId) => {
    try {
      await adminCustomerGroupsApi.removeTag(email, tagId);
      await onChanged("Customer tag removed.");
    } catch (err) {
      console.error("Tag removal failed:", err);
      window.alert(err?.message || "Could not remove tag.");
    }
  };

  return (
    <div className="grid xl:grid-cols-[340px_1fr] gap-5">
      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden h-fit">
        <div className="p-3 border-b border-[#e8e8e8] flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Tags</div>
            <div className="text-xs text-[#777] mt-0.5">Reusable customer labels</div>
          </div>
          <button onClick={onCreate} className="w-8 h-8 rounded-lg border border-[#d5d5d5] grid place-items-center">
            <Plus size={14} />
          </button>
        </div>
        <div className="divide-y divide-[#eeeeee]">
          {data.tags.map((tag) => {
            const count = data.assignments.filter((item) => item.tag_id === tag.id).length;
            return (
              <button key={tag.id} onClick={() => onEdit(tag)} className="w-full px-4 py-3 text-left hover:bg-[#fafafa]">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: tag.color || "#e5e5e5" }}
                  />
                  <span className="text-sm font-semibold">{tag.name}</span>
                  <span className="ml-auto text-xs text-[#777]">{count}</span>
                </div>
                {tag.description && <div className="text-[11px] text-[#777] mt-1">{tag.description}</div>}
              </button>
            );
          })}
          {!loading && !data.tags.length && (
            <div className="p-4 text-sm text-[#777]">No customer tags yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e8e8e8]">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customers"
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={selectedCustomer}
                onChange={(event) => setSelectedCustomer(event.target.value)}
                className="h-9 rounded-lg border border-[#d5d5d5] bg-white px-2 text-xs max-w-[220px]"
              >
                <option value="">Choose customer</option>
                {data.customers.map((customer) => (
                  <option key={customer.email} value={customer.email}>{customer.name} · {customer.email}</option>
                ))}
              </select>
              <select
                value={selectedTag}
                onChange={(event) => setSelectedTag(event.target.value)}
                className="h-9 rounded-lg border border-[#d5d5d5] bg-white px-2 text-xs"
              >
                <option value="">Choose tag</option>
                {data.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
              <button
                onClick={assign}
                disabled={!selectedCustomer || !selectedTag}
                className="h-9 px-3 rounded-lg bg-[#222] text-white text-xs font-semibold disabled:opacity-40"
              >
                Assign
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Customer</Th>
                <Th>Orders</Th>
                <Th right>Total spent</Th>
                <Th>Tags</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center text-[#777]">Loading customers…</td></tr>
              ) : visibleCustomers.length ? (
                visibleCustomers.map((customer) => (
                  <tr key={customer.email} className="border-t border-[#eeeeee]">
                    <Td>
                      <div className="font-semibold">{customer.name}</div>
                      <div className="text-[11px] text-[#777]">{customer.email}</div>
                    </Td>
                    <Td>{customer.orders}</Td>
                    <Td right><span className="font-semibold">{money(customer.totalSpent)}</span></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {(assignmentMap.get(customer.email) || []).map((assignment) => (
                          <button
                            key={assignment.id}
                            onClick={() => remove(customer.email, assignment.tag_id)}
                            className="inline-flex items-center gap-1 rounded-full bg-[#f0f0f0] px-2 py-1 text-[10px] font-medium"
                            title="Remove tag"
                          >
                            {assignment.customer_tags?.name || "Tag"} <X size={10} />
                          </button>
                        ))}
                        {!(assignmentMap.get(customer.email) || []).length && (
                          <span className="text-[11px] text-[#999]">No tags</span>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="py-12 text-center text-[#777]">No matching customers.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SegmentsTab({ data, loading, onCreate, onEdit, onChanged }) {
  const membersBySegment = useMemo(() => {
    const map = new Map();
    for (const member of data.members) {
      if (!map.has(member.segment_id)) map.set(member.segment_id, []);
      map.get(member.segment_id).push(member.customer_email);
    }
    return map;
  }, [data.members]);

  const toggle = async (segment) => {
    try {
      await adminCustomerGroupsApi.setSegmentActive(segment.id, !segment.active);
      await onChanged(`${segment.name} ${segment.active ? "disabled" : "enabled"}.`);
    } catch (err) {
      console.error("Segment toggle failed:", err);
      window.alert(err?.message || "Could not update segment.");
    }
  };

  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="p-3 border-b border-[#e8e8e8] flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Customer segments</div>
          <div className="text-xs text-[#777] mt-0.5">Manual lists and reusable dynamic customer rules</div>
        </div>
        <button onClick={onCreate} className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2">
          <Plus size={14} /> Create segment
        </button>
      </div>

      <div className="p-4 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-[#777]">Loading segments…</div>
        ) : data.segments.length ? (
          data.segments.map((segment) => {
            const count =
              segment.segment_type === "manual"
                ? (membersBySegment.get(segment.id) || []).length
                : data.customers.filter((customer) =>
                    matchesDynamic(customer, segment.rules || {})
                  ).length;

            return (
              <div key={segment.id} className="rounded-xl border border-[#e1e1e1] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#f2f2f2] grid place-items-center">
                    <UsersRound size={16} />
                  </div>
                  <Status active={segment.active} />
                </div>
                <button onClick={() => onEdit(segment)} className="font-semibold text-left mt-4">{segment.name}</button>
                <div className="text-xs text-[#777] mt-1">{segment.description || "No description."}</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Mini label="Type" value={segment.segment_type} />
                  <Mini label="Members" value={count} />
                </div>
                {segment.segment_type === "dynamic" && (
                  <div className="mt-3 text-[11px] text-[#777]">
                    {dynamicRuleText(segment.rules || {})}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => onEdit(segment)} className={secondaryButton}>Edit</button>
                  <button onClick={() => toggle(segment)} className={secondaryButton}>
                    {segment.active ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-sm text-[#777]">No customer segments yet.</div>
        )}
      </div>
    </section>
  );
}

function TagEditor({ tag, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: tag?.name || "",
    color: tag?.color || "#d4d4d4",
    description: tag?.description || "",
  });

  const save = async () => {
    setSaving(true);
    try {
      await adminCustomerGroupsApi.saveTag(tag?.id || null, form);
      await onSaved(tag?.id ? "Customer tag updated." : "Customer tag created.");
    } catch (err) {
      console.error("Tag save failed:", err);
      window.alert(err?.message || "Could not save tag.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={tag ? "Edit customer tag" : "Create customer tag"} onClose={onClose} onSave={save} saving={saving}>
      <Field label="Name">
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
      </Field>
      <Field label="Color">
        <div className="flex items-center gap-2">
          <input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="w-12 h-10 rounded border border-[#d4d4d4] bg-white p-1" />
          <input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className={inputClass} />
        </div>
      </Field>
      <Field label="Description">
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={textareaClass} rows={3} />
      </Field>
    </Editor>
  );
}

function SegmentEditor({ segment, customers, members, onClose, onSaved }) {
  const existingMembers = (members || [])
    .filter((member) => member.segment_id === segment?.id)
    .map((member) => String(member.customer_email || "").toLowerCase());

  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: segment?.name || "",
    description: segment?.description || "",
    segmentType: segment?.segment_type || "manual",
    active: segment?.active !== false,
    minSpent: segment?.rules?.minSpent || "",
    minOrders: segment?.rules?.minOrders || "",
    lastOrderWithinDays: segment?.rules?.lastOrderWithinDays || "",
    memberEmails: existingMembers,
  });

  const visibleCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.email].join(" ").toLowerCase().includes(term)
    );
  }, [customers, search]);

  const dynamicMatches = customers.filter((customer) =>
    matchesDynamic(customer, {
      minSpent: form.minSpent,
      minOrders: form.minOrders,
      lastOrderWithinDays: form.lastOrderWithinDays,
    })
  );

  const toggleMember = (email) =>
    setForm((current) => ({
      ...current,
      memberEmails: current.memberEmails.includes(email)
        ? current.memberEmails.filter((value) => value !== email)
        : [...current.memberEmails, email],
    }));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await adminCustomerGroupsApi.saveSegment(segment?.id || null, {
        name: form.name,
        description: form.description,
        segmentType: form.segmentType,
        active: form.active,
        rules:
          form.segmentType === "dynamic"
            ? {
                minSpent: Number(form.minSpent || 0),
                minOrders: Number(form.minOrders || 0),
                lastOrderWithinDays: Number(form.lastOrderWithinDays || 0),
              }
            : {},
      });

      if (form.segmentType === "manual") {
        await adminCustomerGroupsApi.replaceManualMembers(
          saved.id,
          form.memberEmails
        );
      } else {
        await adminCustomerGroupsApi.replaceManualMembers(saved.id, []);
      }

      await onSaved(segment?.id ? "Customer segment updated." : "Customer segment created.");
    } catch (err) {
      console.error("Segment save failed:", err);
      window.alert(err?.message || "Could not save segment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={segment ? "Edit customer segment" : "Create customer segment"} onClose={onClose} onSave={save} saving={saving} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Name">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />
        </Field>
        <Field label="Type">
          <select value={form.segmentType} onChange={(event) => setForm({ ...form, segmentType: event.target.value })} className={inputClass}>
            <option value="manual">Manual</option>
            <option value="dynamic">Dynamic rules</option>
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={textareaClass} rows={3} />
      </Field>
      <label className="flex items-center gap-2 text-sm rounded-lg border border-[#e2e2e2] bg-[#fafafa] px-3 py-2">
        <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
        Segment is active
      </label>

      {form.segmentType === "dynamic" ? (
        <section className="rounded-xl border border-[#dedede] overflow-hidden">
          <div className="px-4 py-3 bg-[#fafafa] border-b border-[#e8e8e8]">
            <div className="text-sm font-semibold">Dynamic rules</div>
            <div className="text-xs text-[#777] mt-0.5">All non-zero conditions must match.</div>
          </div>
          <div className="p-4 grid sm:grid-cols-3 gap-3">
            <Field label="Minimum paid spend">
              <input type="number" min="0" step="0.01" value={form.minSpent} onChange={(event) => setForm({ ...form, minSpent: event.target.value })} className={inputClass} placeholder="0" />
            </Field>
            <Field label="Minimum orders">
              <input type="number" min="0" value={form.minOrders} onChange={(event) => setForm({ ...form, minOrders: event.target.value })} className={inputClass} placeholder="0" />
            </Field>
            <Field label="Last order within days">
              <input type="number" min="0" value={form.lastOrderWithinDays} onChange={(event) => setForm({ ...form, lastOrderWithinDays: event.target.value })} className={inputClass} placeholder="0" />
            </Field>
          </div>
          <div className="px-4 py-3 border-t border-[#e8e8e8] text-sm">
            Estimated current matches: <span className="font-semibold">{dynamicMatches.length}</span>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-[#dedede] overflow-hidden">
          <div className="px-4 py-3 bg-[#fafafa] border-b border-[#e8e8e8] flex flex-col md:flex-row md:items-center gap-3">
            <div>
              <div className="text-sm font-semibold">Manual members</div>
              <div className="text-xs text-[#777] mt-0.5">{form.memberEmails.length} selected</div>
            </div>
            <div className="relative md:ml-auto w-full md:max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm" />
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-[#eeeeee]">
            {visibleCustomers.map((customer) => (
              <label key={customer.email} className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#fafafa]">
                <input
                  type="checkbox"
                  checked={form.memberEmails.includes(customer.email)}
                  onChange={() => toggleMember(customer.email)}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{customer.name}</div>
                  <div className="text-[11px] text-[#777]">{customer.email}</div>
                </div>
                <div className="text-xs text-[#777]">{money(customer.totalSpent)}</div>
              </label>
            ))}
          </div>
        </section>
      )}
    </Editor>
  );
}

function dynamicRuleText(rules) {
  const parts = [];
  if (Number(rules.minSpent || 0) > 0) parts.push(`spent ≥ ${money(rules.minSpent)}`);
  if (Number(rules.minOrders || 0) > 0) parts.push(`orders ≥ ${rules.minOrders}`);
  if (Number(rules.lastOrderWithinDays || 0) > 0) {
    parts.push(`ordered within ${rules.lastOrderWithinDays} days`);
  }
  return parts.length ? parts.join(" · ") : "All customers match.";
}

function Editor({ title, onClose, onSave, saving, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 p-3 sm:p-8 flex items-start justify-center overflow-y-auto">
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-xl"} bg-white rounded-2xl shadow-2xl overflow-hidden my-6`}>
        <div className="h-16 px-5 border-b border-[#e3e3e3] flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="px-5 py-4 border-t border-[#e3e3e3] flex justify-end gap-2">
          <button onClick={onClose} className={secondaryButton}>Cancel</button>
          <button onClick={onSave} disabled={saving} className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40">
            <Save size={14} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#777]">{label}</div>
        <Icon size={16} className="text-[#777]" />
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f7f7f7] p-2.5">
      <div className="text-[9px] uppercase tracking-wide text-[#888]">{label}</div>
      <div className="text-sm font-semibold mt-1 capitalize">{value}</div>
    </div>
  );
}

function Status({ active }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${active ? "bg-emerald-100 text-emerald-800" : "bg-[#eeeeee] text-[#555]"}`}>
      {active ? "Active" : "Inactive"}
    </span>
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

function Th({ children, right = false }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right = false }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textareaClass = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";
const secondaryButton = "h-8 px-2.5 rounded-lg border border-[#d5d5d5] bg-white text-xs inline-flex items-center justify-center gap-1.5";
