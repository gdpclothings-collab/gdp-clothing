import React, { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Plus,
  CheckCircle2,
  X,
  Save,
  CalendarClock,
  ToggleLeft,
  ToggleRight,
  TicketPercent,
  Gift,
  Truck,
} from "lucide-react";
import { adminDiscountsApi } from "@/lib/adminDiscountsApi";

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function formatDate(value) {
  if (!value) return "No end date";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DiscountsModule() {
  const [discounts, setDiscounts] = useState([]);
  const [references, setReferences] = useState({ products: [], collections: [] });
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [rows, refs] = await Promise.all([
        adminDiscountsApi.list(),
        adminDiscountsApi.references(),
      ]);
      setDiscounts(rows);
      setReferences(refs);
    } catch (err) {
      console.error("Discounts module load failed:", err);
      setError(err?.message || "Could not load discounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  };

  const toggleActive = async (discount) => {
    try {
      await adminDiscountsApi.setActive(discount.id, !discount.active);
      showNotice(`${discount.code} ${discount.active ? "disabled" : "enabled"}.`);
      await load();
    } catch (err) {
      console.error("Discount toggle failed:", err);
      showNotice(err?.message || "Discount update failed.");
    }
  };

  const summary = useMemo(() => {
    const now = Date.now();
    return {
      total: discounts.length,
      active: discounts.filter((discount) => discount.active).length,
      scheduled: discounts.filter(
        (discount) => discount.active && discount.startsAt && new Date(discount.startsAt).getTime() > now
      ).length,
      expired: discounts.filter(
        (discount) => discount.endsAt && new Date(discount.endsAt).getTime() < now
      ).length,
    };
  }, [discounts]);

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Discounts" value={summary.total} icon={BadgePercent} />
        <SummaryCard label="Active" value={summary.active} icon={ToggleRight} />
        <SummaryCard label="Scheduled" value={summary.scheduled} icon={CalendarClock} />
        <SummaryCard label="Expired" value={summary.expired} icon={ToggleLeft} />
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Discounts</div>
            <div className="text-xs text-[#777] mt-0.5">Codes, eligibility, limits and schedules</div>
          </div>
          <button
            onClick={() => setEditor({ discount: null })}
            className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2"
          >
            <Plus size={15} /> Create discount
          </button>
        </div>

        {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Code</Th>
                <Th>Offer</Th>
                <Th>Applies to</Th>
                <Th>Usage</Th>
                <Th>Schedule</Th>
                <Th>Status</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-14 text-center text-[#777]">Loading discounts…</td></tr>
              ) : discounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <BadgePercent size={22} className="mx-auto text-[#aaa]" />
                    <div className="font-medium mt-3">No discounts yet</div>
                  </td>
                </tr>
              ) : (
                discounts.map((discount) => (
                  <tr key={discount.id} className="border-t border-[#eeeeee] hover:bg-[#fafafa]">
                    <Td>
                      <button onClick={() => setEditor({ discount })} className="text-left">
                        <div className="font-mono font-semibold">{discount.code}</div>
                        {discount.minPurchase != null && (
                          <div className="text-[11px] text-[#777] mt-0.5">Min {money(discount.minPurchase)}</div>
                        )}
                      </button>
                    </Td>
                    <Td>
                      <div className="inline-flex items-center gap-2">
                        <OfferIcon type={discount.type} />
                        <span>{offerText(discount)}</span>
                      </div>
                    </Td>
                    <Td className="capitalize">{discount.appliesTo.replaceAll("_", " ")}</Td>
                    <Td>
                      {discount.usageCount}
                      {discount.usageLimit ? ` / ${discount.usageLimit}` : ""}
                    </Td>
                    <Td>
                      <div className="text-xs">{discount.startsAt ? formatDate(discount.startsAt) : "Starts immediately"}</div>
                      <div className="text-[11px] text-[#888] mt-0.5">{discount.endsAt ? `Ends ${formatDate(discount.endsAt)}` : "No end date"}</div>
                    </Td>
                    <Td><ActivePill active={discount.active} endsAt={discount.endsAt} startsAt={discount.startsAt} /></Td>
                    <Td right>
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setEditor({ discount })}
                          className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(discount)}
                          className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] text-xs"
                        >
                          {discount.active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editor && (
        <DiscountEditor
          discount={editor.discount}
          references={references}
          onClose={() => setEditor(null)}
          onSaved={async (message) => {
            setEditor(null);
            showNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function DiscountEditor({ discount, references, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: discount?.code || "",
    type: discount?.type || "percentage",
    value: discount?.value ?? 10,
    appliesTo: discount?.appliesTo || "all",
    appliesToId: discount?.appliesToId || "",
    minPurchase: discount?.minPurchase ?? "",
    active: discount?.active !== false,
    startsAt: discount?.startsAt ? new Date(discount.startsAt).toISOString().slice(0, 16) : "",
    endsAt: discount?.endsAt ? new Date(discount.endsAt).toISOString().slice(0, 16) : "",
    usageLimit: discount?.usageLimit ?? "",
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const targetOptions =
    form.appliesTo === "product"
      ? references.products
      : form.appliesTo === "collection"
        ? references.collections
        : [];

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminDiscountsApi.save(discount?.id || null, {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: form.type === "free_shipping" ? 0 : Number(form.value || 0),
        appliesTo: form.appliesTo,
        appliesToId: ["product", "collection"].includes(form.appliesTo) ? form.appliesToId || null : null,
        minPurchase: form.minPurchase === "" ? null : Number(form.minPurchase),
        active: form.active,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
      });
      await onSaved(discount?.id ? "Discount updated." : "Discount created.");
    } catch (err) {
      console.error("Discount save failed:", err);
      window.alert(err?.message || "Discount save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Close discount editor" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[600px] bg-[#f6f6f6] shadow-2xl overflow-y-auto">
        <form onSubmit={submit}>
          <div className="sticky top-0 z-20 h-16 px-5 border-b border-[#dedede] bg-white flex items-center justify-between">
            <div>
              <div className="font-semibold">{discount?.id ? "Edit discount" : "Create discount"}</div>
              <div className="text-xs text-[#777]">GDP Clothing promotion rules</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
              <button type="submit" disabled={saving || !form.code.trim()} className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40">
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <Section title="Discount code">
              <Field label="Code">
                <input value={form.code} onChange={(event) => set("code", event.target.value.toUpperCase())} className={inputClass} placeholder="GDP10" required />
              </Field>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Type">
                  <select value={form.type} onChange={(event) => set("type", event.target.value)} className={inputClass}>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                    <option value="free_shipping">Free shipping</option>
                  </select>
                </Field>
                {form.type !== "free_shipping" && (
                  <Field label={form.type === "percentage" ? "Percentage" : "Amount"}>
                    <input type="number" min="0" step="0.01" value={form.value} onChange={(event) => set("value", event.target.value)} className={inputClass} />
                  </Field>
                )}
              </div>
            </Section>

            <Section title="Eligibility">
              <Field label="Applies to">
                <select
                  value={form.appliesTo}
                  onChange={(event) => {
                    set("appliesTo", event.target.value);
                    set("appliesToId", "");
                  }}
                  className={inputClass}
                >
                  <option value="all">All products</option>
                  <option value="product">Specific product</option>
                  <option value="collection">Specific collection</option>
                </select>
              </Field>

              {targetOptions.length > 0 && (
                <Field label={form.appliesTo === "product" ? "Product" : "Collection"}>
                  <select value={form.appliesToId} onChange={(event) => set("appliesToId", event.target.value)} className={inputClass}>
                    <option value="">Choose…</option>
                    {targetOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </Field>
              )}

              <Field label="Minimum purchase">
                <input type="number" min="0" step="0.01" value={form.minPurchase} onChange={(event) => set("minPurchase", event.target.value)} className={inputClass} placeholder="No minimum" />
              </Field>
              <Field label="Usage limit">
                <input type="number" min="1" value={form.usageLimit} onChange={(event) => set("usageLimit", event.target.value)} className={inputClass} placeholder="Unlimited" />
              </Field>
            </Section>

            <Section title="Schedule">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Starts">
                  <input type="datetime-local" value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Ends">
                  <input type="datetime-local" value={form.endsAt} onChange={(event) => set("endsAt", event.target.value)} className={inputClass} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(event) => set("active", event.target.checked)} />
                Discount is enabled
              </label>
            </Section>
          </div>
        </form>
      </aside>
    </div>
  );
}

function offerText(discount) {
  if (discount.type === "percentage") return `${discount.value}% off`;
  if (discount.type === "fixed") return `${money(discount.value)} off`;
  return "Free shipping";
}

function OfferIcon({ type }) {
  if (type === "fixed") return <Gift size={15} />;
  if (type === "free_shipping") return <Truck size={15} />;
  return <TicketPercent size={15} />;
}

function ActivePill({ active, startsAt, endsAt }) {
  const now = Date.now();
  let label = active ? "Active" : "Inactive";
  let cls = active ? "bg-emerald-100 text-emerald-800" : "bg-[#eeeeee] text-[#555]";

  if (active && startsAt && new Date(startsAt).getTime() > now) {
    label = "Scheduled";
    cls = "bg-blue-100 text-blue-800";
  }
  if (endsAt && new Date(endsAt).getTime() < now) {
    label = "Expired";
    cls = "bg-amber-100 text-amber-800";
  }

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>{label}</span>;
}

function SummaryCard({ label, value, icon: Icon }) {
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

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#eaeaea] text-sm font-semibold">{title}</div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
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

function Td({ children, right, className = "" }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"} ${className}`}>{children}</td>;
}

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
