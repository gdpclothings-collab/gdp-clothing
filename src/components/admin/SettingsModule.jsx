import React, { useEffect, useState } from "react";
import {
  Store,
  CreditCard,
  ShoppingCart,
  Truck,
  ReceiptText,
  UserRoundCog,
  ShieldCheck,
  Bell,
  Palette,
  Save,
  CheckCircle2,
  RefreshCw,
  Database,
} from "lucide-react";
import { adminSettingsApi } from "@/lib/adminSettingsApi";
import AdvancedSettingsModule from "@/components/admin/AdvancedSettingsModule";

export default function SettingsModule() {
  const [data, setData] = useState({ settings: null, profiles: [] });
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminSettingsApi.load();
      setData(result);
      setForm(result.settings || defaultSettings());
    } catch (err) {
      console.error("Settings module load failed:", err);
      setError(err?.message || "Could not load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await adminSettingsApi.save({
        ...form,
        lowStockThreshold: Number(form.lowStockThreshold || 0),
      });
      setNotice("Store settings saved.");
      window.setTimeout(() => setNotice(""), 2500);
      await load();
    } catch (err) {
      console.error("Settings save failed:", err);
      window.alert(err?.message || "Settings save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
        <div className="py-16 text-center text-sm text-[#777]">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-[#777]">
          Store-wide identity and commerce defaults. Module-specific settings now live inside their owning admin modules.
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2">
            <RefreshCw size={14} /> Reload
          </button>
          <button onClick={save} disabled={saving} className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40">
            <Save size={14} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid xl:grid-cols-[1.25fr_.75fr] gap-6">
        <div className="space-y-4">
          <SettingsSection icon={Store} title="Store details" description="GDP Clothing identity and contact information">
            <Field label="Store name">
              <input value={form.storeName || ""} onChange={(event) => set("storeName", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Slogan">
              <input value={form.slogan || ""} onChange={(event) => set("slogan", event.target.value)} className={inputClass} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Contact email">
                <input type="email" value={form.contactEmail || ""} onChange={(event) => set("contactEmail", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Phone">
                <input value={form.phone || ""} onChange={(event) => set("phone", event.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Business address">
              <textarea value={form.address || ""} onChange={(event) => set("address", event.target.value)} className={textareaClass} rows={3} />
            </Field>
          </SettingsSection>

          <SettingsSection icon={ShoppingCart} title="Regional & order defaults" description="Store-wide currency, timezone, order numbering and inventory alert threshold">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Currency">
                <select value={form.currency || "CAD"} onChange={(event) => set("currency", event.target.value)} className={inputClass}>
                  <option value="CAD">CAD — Canadian Dollar</option>
                  <option value="USD">USD — US Dollar</option>
                </select>
              </Field>
              <Field label="Order prefix">
                <input value={form.orderPrefix || "GDP"} onChange={(event) => set("orderPrefix", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Timezone">
                <input value={form.timezone || "America/Regina"} onChange={(event) => set("timezone", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Low-stock threshold">
                <input type="number" min="0" value={form.lowStockThreshold ?? 5} onChange={(event) => set("lowStockThreshold", event.target.value)} className={inputClass} />
              </Field>
            </div>
          </SettingsSection>

          <SettingsSection icon={Palette} title="Brand & social" description="Store logo, brand color and social channels">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Logo URL">
                <input value={form.logo || ""} onChange={(event) => set("logo", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Primary color">
                <input value={form.primaryColor || ""} onChange={(event) => set("primaryColor", event.target.value)} className={inputClass} placeholder="#000000" />
              </Field>
              <Field label="Instagram">
                <input value={form.instagram || ""} onChange={(event) => set("instagram", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Facebook">
                <input value={form.facebook || ""} onChange={(event) => set("facebook", event.target.value)} className={inputClass} />
              </Field>
              <Field label="TikTok">
                <input value={form.tiktok || ""} onChange={(event) => set("tiktok", event.target.value)} className={inputClass} />
              </Field>
              <Field label="YouTube">
                <input value={form.youtube || ""} onChange={(event) => set("youtube", event.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Footer text">
              <textarea value={form.footerText || ""} onChange={(event) => set("footerText", event.target.value)} className={textareaClass} rows={3} />
            </Field>
          </SettingsSection>
        </div>

        <div className="space-y-4">
          <SettingsNavCard icon={CreditCard} title="Payments" text="Stripe checkout, payment capture and payout configuration are server-side." status="Connected architecture" />
          <SettingsNavCard icon={Truck} title="Shipping & delivery" text="Order shipping methods, tracking and fulfillment status are active." status="Operational" />
          <SettingsNavCard icon={ReceiptText} title="Taxes" text="Tax amounts are stored per order; advanced regional tax rules are the next market layer." status="Core ready" />
          <SettingsNavCard icon={Bell} title="Notifications" text="Notification templates and staff controls are managed in Team & notifications below." status="Managed below" />
          <SettingsNavCard icon={ShieldCheck} title="Privacy & policies" text="Keep customer-facing privacy, refund and fulfillment policies aligned with checkout." status="Store policy layer" />
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-800">
            <div className="font-semibold text-blue-900 mb-1">Settings ownership</div>
            Store-wide identity and defaults stay here. Custom Studio behavior lives in <strong>Custom Studio → Settings</strong>. Garment-specific controls stay in <strong>Products</strong>. Service configuration lives in <strong>Apps & integrations</strong>.
          </div>

          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e8e8e8] flex items-center gap-2">
              <UserRoundCog size={16} />
              <div className="text-sm font-semibold">Users & permissions</div>
            </div>
            <div className="divide-y divide-[#eeeeee]">
              {(data.profiles || []).map((profile) => (
                <div key={profile.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f0f0f0] grid place-items-center text-xs font-semibold">
                    {(profile.display_name || "U").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{profile.display_name || "User"}</div>
                    <div className="text-[11px] text-[#777] capitalize">{profile.role}</div>
                  </div>
                  <span className="rounded-full bg-[#eeeeee] px-2 py-1 text-[10px] font-medium capitalize">{profile.role}</span>
                </div>
              ))}
              {!data.profiles?.length && <div className="p-4 text-sm text-[#777]">No profiles found.</div>}
            </div>
          </section>
        </div>
      </div>

      <AdvancedSettingsModule visibleTabs={["staff", "notifications"]} />
    </div>
  );
}

function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e8e8e8] flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f1f1f1] grid place-items-center"><Icon size={15} /></div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-[#777] mt-0.5">{description}</div>
        </div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function SettingsNavCard({ icon: Icon, title, text, status }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#f1f1f1] grid place-items-center shrink-0"><Icon size={16} /></div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-[#777] mt-1 leading-5">{text}</div>
          <div className="mt-2 inline-flex rounded-full bg-[#f1f1f1] px-2 py-1 text-[10px] font-medium">{status}</div>
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

function defaultSettings() {
  return {
    id: 1,
    storeName: "GDP Clothing",
    slogan: "Design Your Dream, Wear Your Vision!",
    currency: "CAD",
    timezone: "America/Regina",
    orderPrefix: "GDP",
    lowStockThreshold: 5,
    contactEmail: "",
    phone: "",
    address: "",
    logo: "",
    primaryColor: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    youtube: "",
    footerText: "",
  };
}

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textareaClass = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";
