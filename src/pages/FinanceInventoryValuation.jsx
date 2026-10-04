import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, PackageSearch, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { adminInventoryValuationApi } from "@/lib/adminInventoryValuationApi";

const money = (value) => value === null || value === undefined
  ? "—"
  : Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });

const number = (value) => Number(value || 0).toLocaleString("en-CA");

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export default function FinanceInventoryValuation() {
  const [data, setData] = useState({ summary: {}, variants: [], locations: [], costEvents: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [draftCosts, setDraftCosts] = useState({});
  const [reasons, setReasons] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminInventoryValuationApi.load(1500));
    } catch (err) {
      console.error("Inventory valuation load failed:", err);
      setError(err?.message || "Could not load inventory valuation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const summary = data?.summary || {};
  const variants = Array.isArray(data?.variants) ? data.variants : [];
  const locations = Array.isArray(data?.locations) ? data.locations : [];
  const events = Array.isArray(data?.costEvents) ? data.costEvents : [];

  const filteredVariants = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return variants;
    return variants.filter((row) => [row.product_name, row.variant_name, row.sku, row.color, row.size]
      .some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [search, variants]);

  const saveCost = async (row) => {
    const rawCost = draftCosts[row.variant_id];
    const reason = String(reasons[row.variant_id] || "").trim();
    if (rawCost === undefined || rawCost === "" || !Number.isFinite(Number(rawCost)) || Number(rawCost) < 0) {
      setError("Enter a valid non-negative unit cost before saving.");
      return;
    }
    if (!reason) {
      setError("Enter a reason for the inventory cost change.");
      return;
    }
    setSaving(row.variant_id);
    setError("");
    setNotice("");
    try {
      await adminInventoryValuationApi.setCostBasis(row.variant_id, rawCost, reason);
      setDraftCosts((current) => { const next = { ...current }; delete next[row.variant_id]; return next; });
      setReasons((current) => { const next = { ...current }; delete next[row.variant_id]; return next; });
      setNotice(`Cost basis saved for ${row.product_name}${row.variant_name ? ` · ${row.variant_name}` : ""}. Historical order COGS snapshots were not changed.`);
      await load();
    } catch (err) {
      console.error("Inventory cost update failed:", err);
      setError(err?.message || "Could not update the inventory cost basis.");
    } finally {
      setSaving("");
    }
  };

  const complete = Boolean(summary.valuationComplete);
  const coverage = Number(summary.coveragePercent || 0);

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
        <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><PackageSearch size={16}/> Inventory Valuation</div>
        <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Finance</Link>
      </div>
    </header>

    <div className="border-b border-[#dedfe3] bg-white">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
        <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 21</div>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Inventory Valuation &amp; Cost Coverage</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Value physical inventory using the existing product/variant cost basis. On-hand is available + committed stock; incoming stock stays separate until it is actually received.</p></div>
          <button type="button" onClick={load} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>
        </div>
      </div>
    </div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      {loading ? <div className="py-16 text-center text-sm text-[#777]">Loading inventory valuation…</div> : <>
        <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-3">
          <Metric label="Inventory asset value" value={complete ? money(summary.inventoryValue) : "Incomplete"} strong sub={complete ? "All on-hand units have cost coverage" : "Hidden until cost coverage is complete"}/>
          <Metric label="Known value" value={money(summary.knownValue)} sub="Value from currently costed units only"/>
          <Metric label="On-hand units" value={number(summary.onHandUnits)} sub="Available + committed"/>
          <Metric label="Incoming units" value={number(summary.incomingUnits)} sub="Excluded from asset value"/>
          <Metric label="Cost coverage" value={`${Number.isFinite(coverage) ? coverage.toFixed(1) : "0.0"}%`} sub={`${number(summary.costedUnits)} of ${number(summary.onHandUnits)} units costed`}/>
          <Metric label="Uncosted variants" value={number(summary.uncostedVariants)} alert={Number(summary.uncostedVariants || 0) > 0} sub={`${number(summary.uncostedUnits)} uncosted units`}/>
        </div>

        <section className={`rounded-xl border overflow-hidden ${complete ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="p-4 flex gap-3 text-sm">
            {complete ? <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-700"/> : <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-700"/>}
            <div><div className="font-semibold">{complete ? "Inventory valuation coverage is complete" : "Inventory asset value is intentionally withheld"}</div><div className="mt-1 text-xs leading-5">{complete ? "Every on-hand unit has a configured cost basis and there are no negative-stock variants." : `${number(summary.uncostedUnits)} on-hand units still have no cost basis. Finance shows only known value until every stocked unit is costed, preventing a misleading inventory asset total.`}</div>{Number(summary.negativeVariants || 0) > 0 && <div className="mt-1 text-xs font-semibold text-red-700">{number(summary.negativeVariants)} variant(s) have negative on-hand stock and must be corrected before valuation is considered complete.</div>}</div>
          </div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed] flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-sm font-semibold">Variant cost basis &amp; valuation</div><div className="text-xs text-[#777] mt-0.5">Changing a variant cost affects current inventory valuation and future cost snapshots only. Existing order COGS snapshots remain historical.</div></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU, colour, size…" className="h-9 w-full md:w-[320px] rounded-lg border border-[#d5d5d5] px-3 text-sm"/></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1460px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Product / Variant</Th><Th>SKU</Th><Th right>Available</Th><Th right>Committed</Th><Th right>On hand</Th><Th right>Incoming</Th><Th right>Current unit cost</Th><Th right>Known value</Th><Th>Set / correct cost basis</Th></tr></thead><tbody>{filteredVariants.length ? filteredVariants.map((row) => <tr key={row.variant_id} className={`border-t border-[#eeeeee] align-top ${row.effective_cost === null || row.effective_cost === undefined ? "bg-amber-50/35" : ""}`}><Td><div className="font-semibold">{row.product_name}</div><div className="text-xs text-[#777] mt-0.5">{row.variant_name || [row.color,row.size].filter(Boolean).join(" / ") || "Default variant"}</div>{Array.isArray(row.locations) && row.locations.length > 0 && <div className="text-[11px] text-[#8a8a8a] mt-1">{row.locations.map((location) => `${location.locationCode || location.locationName}: ${number(location.onHand)}`).join(" · ")}</div>}</Td><Td>{row.sku || "—"}</Td><Td right>{number(row.available_units)}</Td><Td right>{number(row.committed_units)}</Td><Td right strong>{number(row.on_hand_units)}</Td><Td right>{number(row.incoming_units)}</Td><Td right><div className={row.effective_cost === null || row.effective_cost === undefined ? "font-semibold text-amber-700" : "font-semibold"}>{row.effective_cost === null || row.effective_cost === undefined ? "Missing" : money(row.effective_cost)}</div><div className="text-[10px] text-[#777] mt-0.5">{row.cost_source === "variant" ? "Variant cost" : row.cost_source === "product" ? "Product fallback" : "No cost basis"}</div></Td><Td right strong>{row.known_value === null || row.known_value === undefined ? "—" : money(row.known_value)}</Td><Td><div className="min-w-[390px] space-y-2"><div className="flex gap-2"><input type="number" min="0" max="100000" step="0.01" value={draftCosts[row.variant_id] ?? ""} onChange={(event) => setDraftCosts((current) => ({ ...current, [row.variant_id]: event.target.value }))} placeholder={row.effective_cost === null || row.effective_cost === undefined ? "Unit cost" : `Current ${money(row.effective_cost)}`} className="h-9 w-32 rounded-lg border border-[#d5d5d5] px-2 text-sm"/><input value={reasons[row.variant_id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [row.variant_id]: event.target.value }))} maxLength={500} placeholder="Reason, e.g. supplier invoice cost" className="h-9 min-w-0 flex-1 rounded-lg border border-[#d5d5d5] px-2 text-sm"/><button type="button" onClick={() => saveCost(row)} disabled={saving === row.variant_id} className="h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"><Save size={13}/>{saving === row.variant_id ? "Saving" : "Save"}</button></div></div></Td></tr>) : <Empty cols={9}>{search ? "No inventory variants match your search." : "No stocked or incoming inventory variants."}</Empty>}</tbody></table></div>
        </section>

        <div className="grid xl:grid-cols-2 gap-5">
          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><SectionHeader title="Valuation by location" subtitle="Incoming units are shown separately and do not contribute to on-hand asset value."/><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Location</Th><Th right>On hand</Th><Th right>Costed</Th><Th right>Uncosted</Th><Th right>Incoming</Th><Th right>Known value</Th></tr></thead><tbody>{locations.length ? locations.map((row) => <tr key={row.location_id} className="border-t border-[#eeeeee]"><Td><div className="font-semibold">{row.location_name}</div><div className="text-xs text-[#777]">{row.location_code || "No code"}{row.is_default ? " · Default" : ""}</div></Td><Td right strong>{number(row.on_hand_units)}</Td><Td right>{number(row.costed_units)}</Td><Td right>{number(row.uncosted_units)}</Td><Td right>{number(row.incoming_units)}</Td><Td right strong>{money(row.known_value)}</Td></tr>) : <Empty cols={6}>No inventory locations with stock.</Empty>}</tbody></table></div></section>

          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><SectionHeader title="Recent cost-basis changes" subtitle="Finance changes are append-only audit events; costs are never silently rewritten here."/><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Changed</Th><Th>Variant</Th><Th right>Previous</Th><Th right>New</Th><Th>Reason</Th></tr></thead><tbody>{events.length ? events.map((event) => <tr key={event.id} className="border-t border-[#eeeeee] align-top"><Td>{dateTime(event.changed_at)}</Td><Td><div className="font-semibold">{event.product_name}</div><div className="text-xs text-[#777]">{event.variant_name || event.sku || "Variant"}</div></Td><Td right>{event.previous_effective_cost === null || event.previous_effective_cost === undefined ? "—" : money(event.previous_effective_cost)}</Td><Td right strong>{money(event.new_variant_cost)}</Td><Td><div className="max-w-[280px] text-xs text-[#555] whitespace-pre-wrap">{event.reason}</div></Td></tr>) : <Empty cols={5}>No Finance cost-basis changes yet.</Empty>}</tbody></table></div></section>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Accounting boundary</div><div className="mt-1 text-xs leading-5">This phase does not post a journal entry, change inventory quantities, change sales revenue, or rewrite historical order COGS. It establishes a current inventory cost basis and valuation coverage only. Purchase receiving and returns remain the authority for stock movement.</div></div></div>
      </>}
    </main>
  </div>;
}

function Metric({ label, value, sub = "", strong = false, alert = false }) { return <div className={`rounded-xl border bg-white p-4 ${alert ? "border-amber-200" : "border-[#dedede]"}`}><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"} ${alert ? "text-amber-700" : ""}`}>{value}</div>{sub && <div className="text-xs text-[#777] mt-1">{sub}</div>}</div>; }
function SectionHeader({ title, subtitle = "" }) { return <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">{title}</div>{subtitle && <div className="text-xs text-[#777] mt-0.5">{subtitle}</div>}</div>; }
function Th({ children, right = false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-3 py-3 ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
