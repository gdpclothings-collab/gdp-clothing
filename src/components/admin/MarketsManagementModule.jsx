import React, { useEffect, useState } from "react";
import {
  Globe2,
  Truck,
  ReceiptText,
  Plus,
  RefreshCw,
  CheckCircle2,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";
import { adminMarketsApi } from "@/lib/adminMarketsApi";

function money(value, currency = "CAD") {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency,
  });
}

export default function MarketsManagementModule() {
  const [tab, setTab] = useState("markets");
  const [data, setData] = useState({ markets: [], profiles: [], rates: [], taxes: [] });
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminMarketsApi.load());
    } catch (err) {
      console.error("Markets load failed:", err);
      setError(err?.message || "Could not load markets.");
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

  const toggleMarket = async (market) => {
    await adminMarketsApi.setMarketActive(market.id, !market.active);
    showNotice(`${market.name} ${market.active ? "disabled" : "enabled"}.`);
    await load();
  };

  const toggleRate = async (rate) => {
    await adminMarketsApi.setShippingRateActive(rate.id, !rate.active);
    showNotice(`${rate.name} ${rate.active ? "disabled" : "enabled"}.`);
    await load();
  };

  const toggleTax = async (rule) => {
    await adminMarketsApi.setTaxRuleActive(rule.id, !rule.active);
    showNotice(`${rule.name} ${rule.active ? "disabled" : "enabled"}.`);
    await load();
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Metric label="Markets" value={data.markets.length} icon={Globe2} />
        <Metric label="Shipping rates" value={data.rates.length} icon={Truck} />
        <Metric label="Tax rules" value={data.taxes.length} icon={ReceiptText} />
      </div>

      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#d5d5d5] bg-white p-1 w-fit">
          {[
            { id: "markets", label: "Markets", Icon: Globe2 },
            { id: "shipping", label: "Shipping", Icon: Truck },
            { id: "taxes", label: "Taxes", Icon: ReceiptText },
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

        <button onClick={load} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 w-fit">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {tab === "markets" && (
        <MarketsTab
          markets={data.markets}
          loading={loading}
          onEdit={(market) => setEditor({ type: "market", item: market })}
          onCreate={() => setEditor({ type: "market", item: null })}
          onToggle={toggleMarket}
        />
      )}

      {tab === "shipping" && (
        <ShippingTab
          rates={data.rates}
          profiles={data.profiles}
          loading={loading}
          onEdit={(item) => setEditor({ type: "shipping", item })}
          onCreate={() => setEditor({ type: "shipping", item: null })}
          onToggle={toggleRate}
        />
      )}

      {tab === "taxes" && (
        <TaxesTab
          taxes={data.taxes}
          loading={loading}
          onEdit={(item) => setEditor({ type: "tax", item })}
          onCreate={() => setEditor({ type: "tax", item: null })}
          onToggle={toggleTax}
        />
      )}

      {editor?.type === "market" && (
        <MarketEditor
          market={editor.item}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            showNotice(editor.item ? "Market updated." : "Market created.");
            await load();
          }}
        />
      )}

      {editor?.type === "shipping" && (
        <ShippingEditor
          rate={editor.item}
          markets={data.markets}
          profiles={data.profiles}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            showNotice(editor.item ? "Shipping rate updated." : "Shipping rate created.");
            await load();
          }}
        />
      )}

      {editor?.type === "tax" && (
        <TaxEditor
          rule={editor.item}
          markets={data.markets}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            showNotice(editor.item ? "Tax rule updated." : "Tax rule created.");
            await load();
          }}
        />
      )}
    </div>
  );
}

function MarketsTab({ markets, loading, onCreate, onEdit, onToggle }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <Header
        title="Markets"
        subtitle="Regional currency, countries, domain and pricing configuration"
        action={<button onClick={onCreate} className={primaryButton}><Plus size={14} /> Add market</button>}
      />
      <div className="p-4 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-[#777]">Loading markets…</div>
        ) : markets.length ? (
          markets.map((market) => (
            <div key={market.id} className="rounded-xl border border-[#e1e1e1] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f2f2f2] grid place-items-center"><Globe2 size={17} /></div>
                <div className="flex gap-1">
                  {market.is_primary && <Badge text="Primary" />}
                  <Status active={market.active} />
                </div>
              </div>
              <div className="font-semibold text-lg mt-4">{market.name}</div>
              <div className="text-xs text-[#777] mt-1">{market.code} · {(market.countries || []).join(", ") || "No countries"}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Mini label="Currency" value={market.currency} />
                <Mini label="Language" value={market.language} />
                <Mini label="Price adjustment" value={`${Number(market.pricing_adjustment || 0)}%`} />
                <Mini label="Domain" value={market.domain || "Store default"} />
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => onEdit(market)} className={secondaryButton}>Edit</button>
                {!market.is_primary && (
                  <button onClick={() => onToggle(market)} className={secondaryButton}>
                    {market.active ? "Disable" : "Enable"}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-sm text-[#777]">No markets configured.</div>
        )}
      </div>
    </section>
  );
}

function ShippingTab({ rates, profiles, loading, onCreate, onEdit, onToggle }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <Header
        title="Shipping rates"
        subtitle={profiles.length ? `${profiles.length} shipping profile(s) configured` : "No shipping profiles"}
        action={<button onClick={onCreate} className={primaryButton}><Plus size={14} /> Add rate</button>}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#fafafa] text-[#707070] text-xs">
            <tr>
              <Th>Rate</Th>
              <Th>Profile</Th>
              <Th>Market</Th>
              <Th right>Price</Th>
              <Th>Order condition</Th>
              <Th>Delivery</Th>
              <Th>Status</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center text-[#777]">Loading shipping rates…</td></tr>
            ) : rates.length ? (
              rates.map((rate) => (
                <tr key={rate.id} className="border-t border-[#eeeeee]">
                  <Td>
                    <div className="font-semibold">{rate.name}</div>
                    <div className="text-[11px] text-[#777]">{rate.method_code}</div>
                  </Td>
                  <Td>{rate.shipping_profiles?.name || "—"}</Td>
                  <Td>{rate.markets?.name || "All markets"}</Td>
                  <Td right><span className="font-semibold">{money(rate.price)}</span></Td>
                  <Td>
                    {rate.min_order != null || rate.max_order != null
                      ? `${rate.min_order != null ? `Min ${money(rate.min_order)}` : ""}${rate.min_order != null && rate.max_order != null ? " · " : ""}${rate.max_order != null ? `Max ${money(rate.max_order)}` : ""}`
                      : "No order minimum"}
                  </Td>
                  <Td>
                    {rate.min_delivery_days != null || rate.max_delivery_days != null
                      ? `${rate.min_delivery_days ?? "?"}–${rate.max_delivery_days ?? "?"} days`
                      : "Not specified"}
                  </Td>
                  <Td><Status active={rate.active} /></Td>
                  <Td right>
                    <div className="inline-flex gap-2">
                      <button onClick={() => onEdit(rate)} className={secondaryButton}>Edit</button>
                      <button onClick={() => onToggle(rate)} className={secondaryButton}>{rate.active ? "Disable" : "Enable"}</button>
                    </div>
                  </Td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} className="py-12 text-center text-[#777]">No shipping rates configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TaxesTab({ taxes, loading, onCreate, onEdit, onToggle }) {
  return (
    <>
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-2">
        <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-amber-900">Tax rates must be verified before checkout uses them.</div>
          <div className="text-xs text-amber-800 mt-1">
            This workspace stores regional tax configuration; it does not replace professional tax advice or automatic tax registration rules.
          </div>
        </div>
      </div>
      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <Header
          title="Tax rules"
          subtitle="Regional tax rates and shipping-tax behavior"
          action={<button onClick={onCreate} className={primaryButton}><Plus size={14} /> Add tax rule</button>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Rule</Th>
                <Th>Market</Th>
                <Th>Country</Th>
                <Th>Region</Th>
                <Th right>Rate</Th>
                <Th>Shipping taxed</Th>
                <Th>Status</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-[#777]">Loading tax rules…</td></tr>
              ) : taxes.length ? (
                taxes.map((rule) => (
                  <tr key={rule.id} className="border-t border-[#eeeeee]">
                    <Td><span className="font-semibold">{rule.name}</span></Td>
                    <Td>{rule.markets?.name || "All"}</Td>
                    <Td>{rule.country_code}</Td>
                    <Td>{rule.region_code || "All regions"}</Td>
                    <Td right><span className="font-semibold">{(Number(rule.rate || 0) * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%</span></Td>
                    <Td>{rule.tax_shipping ? "Yes" : "No"}</Td>
                    <Td><Status active={rule.active} /></Td>
                    <Td right>
                      <div className="inline-flex gap-2">
                        <button onClick={() => onEdit(rule)} className={secondaryButton}>Edit</button>
                        <button onClick={() => onToggle(rule)} className={secondaryButton}>{rule.active ? "Disable" : "Enable"}</button>
                      </div>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="py-12 text-center text-[#777]">No tax rules configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function MarketEditor({ market, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: market?.code || "",
    name: market?.name || "",
    countries: (market?.countries || []).join(", "),
    currency: market?.currency || "CAD",
    language: market?.language || "en",
    domain: market?.domain || "",
    pricingAdjustment: String(market?.pricing_adjustment ?? 0),
    active: market?.active !== false,
    isPrimary: Boolean(market?.is_primary),
  });

  const save = async () => {
    setSaving(true);
    try {
      await adminMarketsApi.saveMarket(market?.id || null, {
        ...form,
        countries: form.countries.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean),
      });
      await onSaved();
    } catch (err) {
      console.error("Market save failed:", err);
      window.alert(err?.message || "Could not save market.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={market ? "Edit market" : "Add market"} onClose={onClose} onSave={save} saving={saving}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Market code"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={inputClass} /></Field>
        <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></Field>
        <Field label="Countries" helper="Comma separated ISO codes"><input value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} className={inputClass} /></Field>
        <Field label="Currency"><input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className={inputClass} /></Field>
        <Field label="Language"><input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={inputClass} /></Field>
        <Field label="Pricing adjustment %"><input type="number" step="0.01" value={form.pricingAdjustment} onChange={(e) => setForm({ ...form, pricingAdjustment: e.target.value })} className={inputClass} /></Field>
      </div>
      <Field label="Domain"><input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className={inputClass} placeholder="Optional custom market domain" /></Field>
      <Toggle label="Market active" checked={form.active} onChange={(active) => setForm({ ...form, active })} />
      <Toggle label="Primary market" checked={form.isPrimary} onChange={(isPrimary) => setForm({ ...form, isPrimary })} />
    </Editor>
  );
}

function ShippingEditor({ rate, markets, profiles, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    profileId: rate?.profile_id || profiles[0]?.id || "",
    marketId: rate?.market_id || "",
    name: rate?.name || "",
    methodCode: rate?.method_code || "",
    price: String(rate?.price ?? 0),
    minOrder: rate?.min_order == null ? "" : String(rate.min_order),
    maxOrder: rate?.max_order == null ? "" : String(rate.max_order),
    minDeliveryDays: rate?.min_delivery_days == null ? "" : String(rate.min_delivery_days),
    maxDeliveryDays: rate?.max_delivery_days == null ? "" : String(rate.max_delivery_days),
    active: rate?.active !== false,
  });

  const save = async () => {
    setSaving(true);
    try {
      await adminMarketsApi.saveShippingRate(rate?.id || null, form);
      await onSaved();
    } catch (err) {
      console.error("Shipping rate save failed:", err);
      window.alert(err?.message || "Could not save shipping rate.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={rate ? "Edit shipping rate" : "Add shipping rate"} onClose={onClose} onSave={save} saving={saving}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Profile">
          <select value={form.profileId} onChange={(e) => setForm({ ...form, profileId: e.target.value })} className={inputClass}>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </Field>
        <Field label="Market">
          <select value={form.marketId} onChange={(e) => setForm({ ...form, marketId: e.target.value })} className={inputClass}>
            <option value="">All active markets</option>
            {markets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
          </select>
        </Field>
        <Field label="Rate name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></Field>
        <Field label="Method code"><input value={form.methodCode} onChange={(e) => setForm({ ...form, methodCode: e.target.value })} className={inputClass} placeholder="standard_shipping" /></Field>
        <Field label="Price"><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputClass} /></Field>
        <Field label="Minimum order"><input type="number" min="0" step="0.01" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} className={inputClass} /></Field>
        <Field label="Maximum order"><input type="number" min="0" step="0.01" value={form.maxOrder} onChange={(e) => setForm({ ...form, maxOrder: e.target.value })} className={inputClass} /></Field>
        <Field label="Min delivery days"><input type="number" min="0" value={form.minDeliveryDays} onChange={(e) => setForm({ ...form, minDeliveryDays: e.target.value })} className={inputClass} /></Field>
        <Field label="Max delivery days"><input type="number" min="0" value={form.maxDeliveryDays} onChange={(e) => setForm({ ...form, maxDeliveryDays: e.target.value })} className={inputClass} /></Field>
      </div>
      <Toggle label="Shipping rate active" checked={form.active} onChange={(active) => setForm({ ...form, active })} />
    </Editor>
  );
}

function TaxEditor({ rule, markets, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    marketId: rule?.market_id || "",
    countryCode: rule?.country_code || "CA",
    regionCode: rule?.region_code || "",
    name: rule?.name || "",
    ratePercent: rule ? String(Number(rule.rate || 0) * 100) : "",
    taxShipping: Boolean(rule?.tax_shipping),
    active: rule?.active !== false,
    priority: String(rule?.priority ?? 100),
  });

  const save = async () => {
    setSaving(true);
    try {
      await adminMarketsApi.saveTaxRule(rule?.id || null, form);
      await onSaved();
    } catch (err) {
      console.error("Tax rule save failed:", err);
      window.alert(err?.message || "Could not save tax rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Editor title={rule ? "Edit tax rule" : "Add tax rule"} onClose={onClose} onSave={save} saving={saving}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Market">
          <select value={form.marketId} onChange={(e) => setForm({ ...form, marketId: e.target.value })} className={inputClass}>
            <option value="">All markets</option>
            {markets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
          </select>
        </Field>
        <Field label="Rule name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></Field>
        <Field label="Country code"><input value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} className={inputClass} /></Field>
        <Field label="Region code"><input value={form.regionCode} onChange={(e) => setForm({ ...form, regionCode: e.target.value.toUpperCase() })} className={inputClass} placeholder="SK, AB, ON…" /></Field>
        <Field label="Rate %"><input type="number" min="0" max="100" step="0.001" value={form.ratePercent} onChange={(e) => setForm({ ...form, ratePercent: e.target.value })} className={inputClass} /></Field>
        <Field label="Priority"><input type="number" min="0" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass} /></Field>
      </div>
      <Toggle label="Tax shipping charges" checked={form.taxShipping} onChange={(taxShipping) => setForm({ ...form, taxShipping })} />
      <Toggle label="Tax rule active" checked={form.active} onChange={(active) => setForm({ ...form, active })} />
    </Editor>
  );
}

function Editor({ title, onClose, onSave, saving, children }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 p-3 sm:p-8 flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6">
        <div className="h-16 px-5 border-b border-[#e3e3e3] flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
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

function Header({ title, subtitle, action }) {
  return (
    <div className="p-3 border-b border-[#e8e8e8] flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-[#777] mt-0.5">{subtitle}</div>
      </div>
      {action}
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
    <div className="rounded-lg bg-[#f7f7f7] p-2.5 min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-[#888]">{label}</div>
      <div className="text-xs font-semibold mt-1 truncate">{value}</div>
    </div>
  );
}

function Badge({ text }) {
  return <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-1 text-[9px] font-semibold uppercase">{text}</span>;
}

function Status({ active }) {
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${active ? "bg-emerald-100 text-emerald-800" : "bg-[#eeeeee] text-[#555]"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Field({ label, helper = null, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      {helper && <span className="ml-2 text-[10px] text-[#888]">{helper}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm rounded-lg border border-[#e2e2e2] bg-[#fafafa] px-3 py-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
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
const primaryButton = "h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40";
const secondaryButton = "h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center justify-center gap-2";
