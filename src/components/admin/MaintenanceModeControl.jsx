import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import MaintenanceAccessPasswordControl from "@/components/admin/MaintenanceAccessPasswordControl";
import {
  DEFAULT_MAINTENANCE_SETTINGS,
  maintenanceSettingsApi,
} from "@/lib/maintenanceSettingsApi";

export default function MaintenanceModeControl() {
  const [form, setForm] = useState(DEFAULT_MAINTENANCE_SETTINGS);
  const [saved, setSaved] = useState(DEFAULT_MAINTENANCE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const snapshot = await maintenanceSettingsApi.loadAdmin();
      setForm(snapshot.maintenance);
      setSaved(snapshot.maintenance);
    } catch (err) {
      console.error("Maintenance settings load failed:", err);
      setError(err?.message || "Could not load maintenance settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved]
  );

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!isDirty) return;

    if (!saved.enabled && form.enabled) {
      const confirmed = window.confirm(
        "Enable Maintenance Mode?\n\nPublic visitors will see the maintenance landing page instead of the storefront. Admin routes and admin storefront preview remain accessible."
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError("");
    try {
      const next = await maintenanceSettingsApi.save(form);
      setForm(next);
      setSaved(next);
      setNotice(
        next.enabled
          ? "Maintenance Mode is ON. Public visitors now see the maintenance page."
          : "Maintenance Mode is OFF. The storefront is public again."
      );
      window.setTimeout(() => setNotice(""), 4500);
    } catch (err) {
      console.error("Maintenance settings save failed:", err);
      setError(err?.message || "Could not update maintenance mode.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="mb-6 overflow-hidden rounded-2xl border border-[#dedede] bg-white">
        <div className="flex items-center gap-3 p-5 text-sm text-[#666]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#ddd] border-t-[#222]" />
          Loading site status…
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#d7d8dc] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
      {notice && (
        <div className={`flex items-start gap-2 border-b px-5 py-3 text-sm ${saved.enabled ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="border-b border-[#ececef] bg-gradient-to-r from-[#111214] via-[#17181b] to-[#222328] p-5 text-white sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/10">
              <Wrench size={19} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Website maintenance</h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${saved.enabled ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/25" : "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/25"}`}>
                  {saved.enabled ? "Maintenance ON" : "Storefront LIVE"}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
                Temporarily replace the public storefront with a branded maintenance page while keeping admin access available.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/?maintenancePreview=1"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Eye size={15} /> Preview page <ExternalLink size={13} />
            </a>
            <button
              type="button"
              onClick={load}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw size={14} /> Reload
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-6">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className={`rounded-2xl border p-4 sm:p-5 ${form.enabled ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${form.enabled ? "bg-amber-200 text-amber-950" : "bg-emerald-200 text-emerald-950"}`}>
                  {form.enabled ? <Wrench size={18} /> : <CheckCircle2 size={18} />}
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {form.enabled ? "Maintenance landing page enabled" : "Public storefront enabled"}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#555]">
                    {form.enabled
                      ? "After saving, public visitors are redirected to the maintenance experience."
                      : "Customers can browse, customize and shop normally."}
                  </p>
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 shadow-sm sm:min-w-[190px]">
                <span className="text-xs font-semibold">Maintenance Mode</span>
                <span className="relative inline-flex h-6 w-11 shrink-0">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={Boolean(form.enabled)}
                    onChange={(event) => set("enabled", event.target.checked)}
                  />
                  <span className="absolute inset-0 rounded-full bg-[#d3d5d9] transition peer-checked:bg-amber-500" />
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </span>
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow / small heading">
              <input
                value={form.eyebrow || ""}
                onChange={(event) => set("eyebrow", event.target.value)}
                className={inputClass}
                maxLength={40}
                placeholder="GDP CLOTHING"
              />
            </Field>
            <Field label="Status label">
              <input
                value={form.statusLabel || ""}
                onChange={(event) => set("statusLabel", event.target.value)}
                className={inputClass}
                maxLength={60}
                placeholder="Site maintenance"
              />
            </Field>
          </div>

          <Field label="Main headline">
            <input
              value={form.title || ""}
              onChange={(event) => set("title", event.target.value)}
              className={inputClass}
              maxLength={100}
              placeholder="We’re tuning things up."
            />
          </Field>

          <Field label="Customer message">
            <textarea
              value={form.message || ""}
              onChange={(event) => set("message", event.target.value)}
              className={textareaClass}
              rows={4}
              maxLength={360}
            />
          </Field>

          <MaintenanceAccessPasswordControl />

          <div className="grid gap-4 md:grid-cols-2">
            <OptionCard
              icon={Clock3}
              title="Estimated return"
              description="Show customers an optional target time."
              checked={Boolean(form.showEstimatedReturn)}
              onChange={(checked) => set("showEstimatedReturn", checked)}
            >
              {form.showEstimatedReturn && (
                <input
                  type="datetime-local"
                  value={toLocalInput(form.estimatedReturnAt)}
                  onChange={(event) => set("estimatedReturnAt", toIso(event.target.value))}
                  className={`${inputClass} mt-3`}
                />
              )}
            </OptionCard>

            <OptionCard
              icon={Mail}
              title="Contact button"
              description="Use the store contact email for existing-order help."
              checked={Boolean(form.showContact)}
              onChange={(checked) => set("showContact", checked)}
            >
              {form.showContact && (
                <input
                  value={form.contactLabel || ""}
                  onChange={(event) => set("contactLabel", event.target.value)}
                  className={`${inputClass} mt-3`}
                  maxLength={80}
                  placeholder="Need help with an existing order?"
                />
              )}
            </OptionCard>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e3e4e7] bg-[#f8f9fa] p-4">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#d7193f]"
              checked={Boolean(form.showSocialLinks)}
              onChange={(event) => set("showSocialLinks", event.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold">Show social links</span>
              <span className="mt-1 block text-xs leading-5 text-[#666]">Uses the Instagram, Facebook and TikTok URLs already saved in Store settings.</span>
            </span>
          </label>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-[#dedfe3] bg-[#f8f9fa] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} /> Safe admin access
            </div>
            <p className="mt-2 text-xs leading-5 text-[#666]">
              Admin routes and login stay available during maintenance. Signed-in admins can also open the regular storefront for checks.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dedfe3] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7d84]">Recommended behavior</div>
            <div className="mt-3 space-y-2 text-xs leading-5 text-[#555]">
              <div className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> Keep maintenance OFF during normal selling.</div>
              <div className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> Preview before enabling.</div>
              <div className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> Use the access password only for people you intentionally allow through.</div>
              <div className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> Add an ETA only when you are confident about it.</div>
            </div>
          </div>

          {isDirty && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              <div className="font-semibold">Unsaved maintenance changes</div>
              Your public site status will not change until you save below.
            </div>
          )}
        </aside>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#ececef] bg-[#fafafa] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-xs text-[#6a6d73]">
          Current public status: <strong className={saved.enabled ? "text-amber-700" : "text-emerald-700"}>{saved.enabled ? "Maintenance" : "Live"}</strong>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${form.enabled ? "bg-amber-600 hover:bg-amber-700" : "bg-[#222] hover:bg-black"}`}
        >
          <Save size={15} /> {saving ? "Saving…" : form.enabled ? "Save & enable maintenance" : "Save & publish storefront"}
        </button>
      </div>
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

function OptionCard({ icon: Icon, title, description, checked, onChange, children }) {
  return (
    <div className="rounded-xl border border-[#e1e2e5] bg-white p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f1f2f4] text-[#333]"><Icon size={15} /></div>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-[#6a6d73]">{description}</span>
        </span>
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[#d7193f]"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
      {children}
    </div>
  );
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none transition focus:border-[#aaa] focus:ring-2 focus:ring-black/10";
const textareaClass = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[#aaa] focus:ring-2 focus:ring-black/10";
