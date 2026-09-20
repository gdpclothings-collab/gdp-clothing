import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Flame, RefreshCw, Search, Target, UsersRound } from "lucide-react";
import { LEAD_STATUSES, salesLeadApi } from "@/lib/salesLeadApi";

const priorityStyles = {
  hot: "border-red-200 bg-red-50 text-red-700",
  warm: "border-amber-200 bg-amber-50 text-amber-700",
  cold: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function SalesLeads() {
  const [leads, setLeads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftFollowUp, setDraftFollowUp] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await salesLeadApi.list();
      setLeads(rows);
      setSelectedId((current) => current || rows[0]?.id || null);
    } catch (loadError) {
      setError(loadError?.message || "Unable to load sales leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selected = useMemo(
    () => leads.find((lead) => lead.id === selectedId) || null,
    [leads, selectedId]
  );

  useEffect(() => {
    setDraftNotes(selected?.admin_notes || "");
    setDraftFollowUp(toLocalInputValue(selected?.next_follow_up_at));
  }, [selected?.id, selected?.admin_notes, selected?.next_follow_up_at]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (priority !== "all" && lead.priority !== priority) return false;
      if (status !== "all" && lead.status !== status) return false;
      if (!needle) return true;
      return [lead.customer_name, lead.customer_email, lead.customer_phone, lead.business_name, lead.order_type, lead.garment_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [leads, priority, status, query]);

  const stats = useMemo(() => ({
    total: leads.length,
    hot: leads.filter((lead) => lead.priority === "hot" && !["won", "lost"].includes(lead.status)).length,
    new: leads.filter((lead) => lead.status === "new").length,
    won: leads.filter((lead) => lead.status === "won").length,
  }), [leads]);

  const updateLead = async (id, patch) => {
    setSaving(true);
    setError("");
    try {
      const updated = await salesLeadApi.update(id, patch);
      setLeads((current) => current.map((lead) => lead.id === id ? updated : lead));
      return updated;
    } catch (updateError) {
      setError(updateError?.message || "Unable to update the lead.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async () => {
    if (!selected) return;
    await updateLead(selected.id, {
      admin_notes: draftNotes,
      next_follow_up_at: draftFollowUp ? new Date(draftFollowUp).toISOString() : null,
    });
  };

  const markContacted = async () => {
    if (!selected) return;
    await updateLead(selected.id, {
      status: "contacted",
      last_contacted_at: new Date().toISOString(),
    });
  };

  return (
    <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-40 h-16 border-b border-white/10 bg-[#111214] text-white shadow-sm">
        <div className="flex h-full items-center gap-3 px-3 md:px-5">
          <Link to="/admin" className="flex shrink-0 items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#d7193f] text-xs font-black text-white shadow-sm shadow-black/30">GDP</div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-none">GDP Clothing</div>
              <div className="mt-1 text-xs text-white/70">Sales CRM</div>
            </div>
          </Link>
          <div className="mx-auto hidden items-center gap-2 text-sm text-white/75 md:flex"><UsersRound size={16} /> Qualified Prospects</div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/admin" className="flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold hover:bg-white/15"><ArrowLeft size={15} /> Admin</Link>
            <Link to="/custom-orders" className="hidden h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold hover:bg-white/15 sm:flex"><ExternalLink size={15} /> Intake form</Link>
          </div>
        </div>
      </header>

      <section className="border-b border-[#dedfe3] bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-7 lg:px-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#a70f2d]">GDP Sales System</div>
              <h1 className="mt-1 text-[28px] font-bold tracking-tight md:text-[32px]">Qualified Prospects</h1>
              <p className="mt-1 max-w-3xl text-base leading-6 text-[#555961]">Custom, bulk, team and DTF inquiries ranked by server-side lead score.</p>
            </div>
            <button onClick={load} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d6d8dd] bg-white px-3.5 text-sm font-bold hover:bg-[#f7f7f8] disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total leads" value={stats.total} icon={UsersRound} />
            <StatCard label="Hot open" value={stats.hot} icon={Flame} />
            <StatCard label="New" value={stats.new} icon={Target} />
            <StatCard label="Won" value={stats.won} icon={Target} />
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 md:px-7 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)] lg:px-10">
        <section className="min-w-0 rounded-2xl border border-[#dedfe3] bg-white shadow-sm">
          <div className="grid gap-3 border-b border-[#ececef] p-4 md:grid-cols-[1fr_170px_170px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878a91]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, business..." className="h-10 w-full rounded-lg border border-[#d9dbe0] pl-9 pr-3 text-sm outline-none focus:border-[#b61234]" />
            </div>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 rounded-lg border border-[#d9dbe0] px-3 text-sm font-semibold outline-none">
              <option value="all">All priorities</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#d9dbe0] px-3 text-sm font-semibold outline-none">
              <option value="all">All statuses</option>
              {LEAD_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          {error ? <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

          <div className="divide-y divide-[#ececef]">
            {loading ? <div className="p-8 text-center text-sm text-[#70737a]">Loading sales leads...</div> : null}
            {!loading && filtered.length === 0 ? <div className="p-10 text-center text-sm text-[#70737a]">No leads match these filters yet.</div> : null}
            {!loading && filtered.map((lead) => (
              <button key={lead.id} onClick={() => setSelectedId(lead.id)} className={`grid w-full gap-3 p-4 text-left transition hover:bg-[#fafafa] md:grid-cols-[minmax(0,1fr)_110px_105px_120px] md:items-center ${selectedId === lead.id ? "bg-[#fff7f8]" : "bg-white"}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-extrabold text-[#25272b]">{lead.customer_name}</div>
                    {lead.business_name ? <div className="hidden truncate text-xs text-[#777a81] sm:block">· {lead.business_name}</div> : null}
                  </div>
                  <div className="mt-1 truncate text-xs text-[#70737a]">{lead.customer_email} · {formatOrderType(lead.order_type)} · Qty {lead.quantity}</div>
                </div>
                <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold capitalize ${priorityStyles[lead.priority] || priorityStyles.cold}`}>{lead.priority}</span></div>
                <div className="text-sm font-black tabular-nums text-[#31343a]">{lead.lead_score}/100</div>
                <div className="text-xs font-semibold capitalize text-[#65686f]">{lead.status} · {formatShortDate(lead.created_at)}</div>
              </button>
            ))}
          </div>
        </section>

        <aside className="self-start rounded-2xl border border-[#dedfe3] bg-white shadow-sm lg:sticky lg:top-20">
          {!selected ? <div className="p-7 text-sm text-[#70737a]">Select a lead to see the full qualification details.</div> : (
            <div>
              <div className="border-b border-[#ececef] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-black tracking-tight">{selected.customer_name}</div>
                    <div className="mt-1 text-sm text-[#666970]">{selected.business_name || "Individual customer"}</div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-extrabold capitalize ${priorityStyles[selected.priority] || priorityStyles.cold}`}>{selected.priority} · {selected.lead_score}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <Detail label="Email" value={selected.customer_email} />
                  <Detail label="Phone" value={selected.customer_phone || "—"} />
                  <Detail label="Order" value={formatOrderType(selected.order_type)} />
                  <Detail label="Quantity" value={selected.quantity} />
                  <Detail label="Garment" value={selected.garment_type || "—"} />
                  <Detail label="Artwork" value={selected.artwork_ready ? "Ready" : "Not ready / unknown"} />
                  <Detail label="Budget" value={formatBudget(selected.budget_range)} />
                  <Detail label="Deadline" value={selected.deadline ? new Date(`${selected.deadline}T12:00:00`).toLocaleDateString() : "—"} />
                  <Detail label="Contact by" value={selected.preferred_contact || "email"} />
                  <Detail label="Source" value={selected.utm_source || selected.source || "—"} />
                </div>
                {selected.notes ? <div className="mt-4 rounded-xl bg-[#f7f7f8] p-3 text-sm leading-6 text-[#555961]"><div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#777a81]">Customer notes</div>{selected.notes}</div> : null}
              </div>

              <div className="space-y-4 p-5">
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#65686f]">Status</span>
                  <select value={selected.status} disabled={saving} onChange={(e) => updateLead(selected.id, { status: e.target.value })} className="h-10 w-full rounded-lg border border-[#d9dbe0] px-3 text-sm font-bold outline-none">
                    {LEAD_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#65686f]">Next follow-up</span>
                  <input type="datetime-local" value={draftFollowUp} onChange={(e) => setDraftFollowUp(e.target.value)} className="h-10 w-full rounded-lg border border-[#d9dbe0] px-3 text-sm outline-none" />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#65686f]">Admin notes</span>
                  <textarea rows={5} value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} placeholder="Quote details, follow-up result, sizes, pricing notes..." className="w-full resize-y rounded-lg border border-[#d9dbe0] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#b61234]" />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={saveDetails} disabled={saving} className="h-10 rounded-lg bg-[#171717] px-3 text-sm font-extrabold text-white hover:bg-black disabled:opacity-50">{saving ? "Saving..." : "Save details"}</button>
                  <button onClick={markContacted} disabled={saving} className="h-10 rounded-lg border border-[#d6d8dd] bg-white px-3 text-sm font-extrabold hover:bg-[#f7f7f8] disabled:opacity-50">Mark contacted</button>
                </div>

                <div className="border-t border-[#ececef] pt-4 text-xs leading-5 text-[#74777e]">
                  Created {formatLongDate(selected.created_at)}{selected.last_contacted_at ? ` · Last contacted ${formatLongDate(selected.last_contacted_at)}` : ""}
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#e0e1e5] bg-[#fafafa] p-4">
      <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-[#72757c]"><span>{label}</span><Icon size={15} /></div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function Detail({ label, value }) {
  return <div className="rounded-lg border border-[#ececef] p-2.5"><div className="font-bold uppercase tracking-wide text-[#8a8d94]">{label}</div><div className="mt-1 break-words font-semibold text-[#34363b]">{value}</div></div>;
}

function formatOrderType(value) {
  return ({ custom_apparel: "Custom apparel", bulk_apparel: "Bulk apparel", dtf_transfers: "DTF transfers", team_event: "Team / event", other: "Other" })[value] || value || "—";
}

function formatBudget(value) {
  return ({ under_250: "Under $250", "250_499": "$250–$499", "500_999": "$500–$999", "1000_2499": "$1,000–$2,499", "2500_plus": "$2,500+" })[value] || "Not specified";
}

function formatShortDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatLongDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function toLocalInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}
