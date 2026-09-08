import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileImage,
  FileArchive,
  RefreshCw,
  Ruler,
  Save,
  ShoppingBag,
} from "lucide-react";
import { adminDtfGangSheetApi } from "@/lib/adminDtfGangSheetApi";
import { normalizeDtfSettings } from "@/lib/dtfGangSheet";
import { exportProductionPackage } from "@/lib/dtfFilmExport";
import { useUnsavedChangesGuard } from "@/lib/UnsavedChangesContext";

const moneyRate = (value) => Number(value || 0).toFixed(3);

export default function DTFGangSheetAdminModule() {
  const [form, setForm] = useState(null);
  const [savedForm, setSavedForm] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingId, setExportingId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminDtfGangSheetApi.load();
      const normalized = normalizeDtfSettings(result.settings);
      setForm(normalized);
      setSavedForm(normalized);
      setQueue(result.queue || []);
    } catch (err) {
      console.error("DTF admin load failed:", err);
      setError(err?.message || "Could not load DTF settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form) return false;
    setSaving(true);
    setError("");
    try {
      const normalized = normalizeDtfSettings({
        ...form,
        breakpointArea: Number(form.breakpointArea || 0),
        maxWidth: Number(form.maxWidth || 34),
        defaultWidth: Number(form.defaultWidth || 34),
        minLength: Number(form.minLength || 6),
        standardMaxLength: Number(form.standardMaxLength || 36),
        standardRate: Number(form.standardRate || 0),
        volumeRate: Number(form.volumeRate || 0),
        spacing: Number(form.spacing || 0),
        minimumDpi: Number(form.minimumDpi || 200),
        recommendedDpi: Number(form.recommendedDpi || 300),
        productionSegmentLength: Number(form.productionSegmentLength || 120),
        artworkReviewPrice: Number(form.artworkReviewPrice || 0),
        maxUploadMb: Number(form.maxUploadMb || 100),
        watermarkOpacity: Number(form.watermarkOpacity || 0.2),
        watermarkSize: Number(form.watermarkSize || 28),
      });
      await adminDtfGangSheetApi.saveSettings(normalized);
      setForm(normalized);
      setSavedForm(normalized);
      setNotice("DTF film settings saved.");
      window.setTimeout(() => setNotice(""), 2500);
      return true;
    } catch (err) {
      console.error("DTF settings save failed:", err);
      setError(err?.message || "Could not save DTF settings.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const isDirty = useMemo(
    () => Boolean(form && savedForm) && JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );

  const { requestAction } = useUnsavedChangesGuard({
    isDirty,
    onSave: save,
    label: "DTF gang sheet settings",
  });

  if (loading || !form) {
    return (
      <div className="mx-auto max-w-[1450px] px-4 pb-12 md:px-6 lg:px-8">
        <div className="rounded-xl border border-[#dedede] bg-white p-8 text-sm text-[#777]">Loading DTF setup…</div>
      </div>
    );
  }

  const breakpointLengthAtMaxWidth = form.maxWidth > 0 ? Number(form.breakpointArea || 0) / Number(form.maxWidth || 1) : 0;

  return (
    <div className="mx-auto max-w-[1450px] px-4 pb-12 md:px-6 lg:px-8">
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={17} /> {notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <section className="overflow-hidden rounded-xl border border-[#dedede] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e7e7] px-5 py-4">
            <div>
              <div className="text-sm font-semibold">DTF film configuration</div>
              <div className="mt-1 text-xs text-[#777]">Controls the customer gang-sheet builder and server-side checkout pricing.</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => requestAction(load)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d1d1d1] px-3 text-sm font-medium hover:bg-[#f7f7f7]"
              >
                <RefreshCw size={15} /> Reload
              </button>
              <button
                type="button"
                disabled={saving || !isDirty}
                onClick={save}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#222] px-3 text-sm font-medium text-white disabled:opacity-40"
              >
                <Save size={15} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-2">
            <ToggleField
              label="DTF ordering enabled"
              helper="Show or pause the DTF product page without deleting the product."
              checked={form.enabled}
              onChange={(value) => set("enabled", value)}
            />
            <ToggleField
              label="Allow custom width"
              helper={`Customers can choose any width up to ${form.maxWidth}".`}
              checked={form.allowCustomWidth}
              onChange={(value) => set("allowCustomWidth", value)}
            />
            <NumberField label="Maximum film width" suffix="in" value={form.maxWidth} step="0.25" min="1" onChange={(value) => set("maxWidth", value)} />
            <NumberField label="Default film width" suffix="in" value={form.defaultWidth} step="0.25" min="1" onChange={(value) => set("defaultWidth", value)} />
            <NumberField label="Minimum length" suffix="in" value={form.minLength} step="1" min="1" onChange={(value) => set("minLength", value)} />
            <NumberField label="Standard reference length" suffix="in" value={form.standardMaxLength} step="1" min="1" onChange={(value) => set("standardMaxLength", value)} />

            <div>
              <label className="text-xs font-medium text-[#555]">Pricing method</label>
              <select
                value={form.pricingMode}
                onChange={(event) => set("pricingMode", event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:border-[#777]"
              >
                <option value="graduated">Graduated — first block standard, extra area volume rate</option>
                <option value="flat_tier">Flat tier — entire sheet switches to volume rate above breakpoint</option>
              </select>
              <p className="mt-1 text-[11px] leading-4 text-[#888]">Graduated avoids a larger sheet becoming cheaper than a smaller sheet.</p>
            </div>

            <NumberField label="Pricing breakpoint area" suffix="in²" value={form.breakpointArea} step="1" min="1" onChange={(value) => set("breakpointArea", value)} />
            <NumberField label="Standard rate" prefix="$" suffix="/in²" value={form.standardRate} step="0.001" min="0" onChange={(value) => set("standardRate", value)} />
            <NumberField label="Volume rate" prefix="$" suffix="/in²" value={form.volumeRate} step="0.001" min="0" onChange={(value) => set("volumeRate", value)} />

            <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <div className="font-semibold">Current price breakpoint</div>
              <div className="mt-1 text-xs leading-5 text-blue-800">
                {Number(form.breakpointArea).toLocaleString()} in² equals about {Number(form.maxWidth).toFixed(2)}" × {breakpointLengthAtMaxWidth.toFixed(2)}".
                At the current rates, that block is about ${(Number(form.breakpointArea) * Number(form.standardRate)).toFixed(2)} before tax.
              </div>
            </div>

            <TextField
              label="Popular film lengths"
              helper="Comma-separated buttons shown to customers."
              value={(form.popularLengths || []).join(", ")}
              onChange={(value) =>
                set(
                  "popularLengths",
                  value
                    .split(",")
                    .map((entry) => Number(entry.trim()))
                    .filter((entry) => Number.isFinite(entry) && entry > 0)
                )
              }
            />
            <NumberField label="Artwork spacing" suffix="in" value={form.spacing} step="0.05" min="0" onChange={(value) => set("spacing", value)} />
            <NumberField label="Minimum DPI warning" suffix="DPI" value={form.minimumDpi} step="10" min="72" onChange={(value) => set("minimumDpi", value)} />
            <NumberField label="Recommended DPI" suffix="DPI" value={form.recommendedDpi} step="10" min="72" onChange={(value) => set("recommendedDpi", value)} />
            <NumberField label="Production segment length" suffix="in" value={form.productionSegmentLength} step="1" min="12" onChange={(value) => set("productionSegmentLength", value)} />
            <NumberField label="Maximum upload per file" suffix="MB" value={form.maxUploadMb} step="1" min="1" onChange={(value) => set("maxUploadMb", value)} />

            <ToggleField
              label="Allow custom length"
              helper="Customers can type any film length instead of only the preset buttons."
              checked={form.allowCustomLength}
              onChange={(value) => set("allowCustomLength", value)}
            />
            <ToggleField
              label="Advanced nesting"
              helper="Uses multi-pass MaxRects packing to minimize film length. Turn off to fall back to the original row arrangement."
              checked={form.advancedNestingEnabled}
              onChange={(value) => set("advancedNestingEnabled", value)}
            />
            <ToggleField
              label="Automatic 90° rotation"
              helper="Lets Advanced Nest rotate artwork when it saves film while preserving the selected print dimensions."
              checked={form.autoRotateEnabled}
              onChange={(value) => set("autoRotateEnabled", value)}
            />
            <ToggleField
              label="Professional artwork review option"
              helper="Shows an optional pre-production review checkbox in the builder."
              checked={form.artworkReviewEnabled}
              onChange={(value) => set("artworkReviewEnabled", value)}
            />
            <NumberField label="Artwork review price" prefix="$" suffix="CAD" value={form.artworkReviewPrice} step="0.01" min="0" onChange={(value) => set("artworkReviewPrice", value)} />

            <div className="md:col-span-2 mt-2 border-t border-[#e7e7e7] pt-5">
              <div className="text-sm font-semibold">Film preview and export access</div>
              <p className="mt-1 text-xs text-[#777]">Customer previews may be watermarked. Admin production files are always exported clean.</p>
            </div>
            <ToggleField label="Watermarked customer preview" helper="Show a configurable watermark on selected customer-facing previews." checked={form.watermarkedPreviewEnabled} onChange={(value) => set("watermarkedPreviewEnabled", value)} />
            <ToggleField label="Preview download before payment" helper="Allow customers to download the low-resolution preview from the builder." checked={form.previewDownloadBeforePayment} onChange={(value) => set("previewDownloadBeforePayment", value)} />
            <ToggleField label="Admin preview bypass" helper="Let signed-in GDP administrators download proof and clean previews before payment. Each use is logged." checked={form.adminPreviewBypassEnabled} onChange={(value) => set("adminPreviewBypassEnabled", value)} />
            <ToggleField label="Full-resolution download after payment" helper="Reserve access for a future paid-order customer download flow." checked={form.fullResolutionDownloadAfterPayment} onChange={(value) => set("fullResolutionDownloadAfterPayment", value)} />
            <ToggleField label="Admin production export" helper="Allow clean PNG, PDF, manifest and ZIP production exports from the DTF queue." checked={form.adminProductionExportEnabled} onChange={(value) => set("adminProductionExportEnabled", value)} />
            <TextField label="Watermark text" value={form.watermarkText} onChange={(value) => set("watermarkText", value)} />
            <NumberField label="Watermark opacity" value={form.watermarkOpacity} step="0.05" min="0.05" suffix="0–0.8" onChange={(value) => set("watermarkOpacity", value)} />
            <NumberField label="Watermark text size" value={form.watermarkSize} step="1" min="10" suffix="px" onChange={(value) => set("watermarkSize", value)} />
            <NumberField label="Preview resolution" value={form.previewDownloadDpi} step="1" min="36" suffix="DPI" onChange={(value) => set("previewDownloadDpi", value)} />
            <NumberField label="JPEG proof quality" value={form.previewDownloadQuality} step="0.05" min="0.4" suffix="0.4–0.95" onChange={(value) => set("previewDownloadQuality", value)} />
            <SelectField label="Watermark position" value={form.watermarkPosition} onChange={(value) => set("watermarkPosition", value)} options={[['repeated','Repeated'],['centered','Centered'],['corner','Bottom corner']]} />
            <SelectField label="Apply watermark to" value={form.watermarkApplyTo} onChange={(value) => set("watermarkApplyTo", value)} options={[['all','All customer previews'],['builder','Builder workspace only'],['cart','Cart image only'],['download','Downloaded preview only']]} />
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-[#dedede] bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold"><Ruler size={17} /> Pricing snapshot</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Snapshot label="Max width" value={`${form.maxWidth}"`} />
              <Snapshot label="Standard rate" value={`$${moneyRate(form.standardRate)}/in²`} />
              <Snapshot label="Volume rate" value={`$${moneyRate(form.volumeRate)}/in²`} />
              <Snapshot label="Production split" value={`${form.productionSegmentLength}"`} />
            </div>
            <a
              href="/products/dtf-gang-sheet"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
            >
              Open customer DTF page <ExternalLink size={14} />
            </a>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#dedede] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#e7e7e7] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag size={16} /> Recent DTF orders</div>
              <span className="rounded-full bg-[#f1f1f1] px-2 py-1 text-[11px] font-medium">{queue.length}</span>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {!queue.length ? (
                <div className="p-6 text-center text-sm text-[#777]">DTF orders will appear here after checkout.</div>
              ) : (
                queue.slice(0, 30).map((entry) => (
                  <div key={`${entry.orderId}-${entry.orderItemId}`} className="border-b border-[#eee] p-4 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{entry.orderNumber}</div>
                        <div className="mt-0.5 text-xs text-[#777]">{entry.customerName || "Guest"} · {entry.customerEmail}</div>
                      </div>
                      <span className="rounded-full bg-[#f1f1f1] px-2 py-1 text-[10px] font-medium capitalize">{String(entry.paymentStatus || entry.status).replaceAll("_", " ")}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <Small label="Film" value={`${entry.spec.width || "—"}" × ${entry.spec.length || "—"}"`} />
                      <Small label="Artworks" value={String(entry.spec.layout?.length || 0)} />
                      <Small label="Line total" value={`$${(entry.unitPrice * entry.quantity).toFixed(2)}`} />
                    </div>
                    {entry.artworkUrl && (
                      <a
                        href={entry.artworkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-xs font-semibold hover:underline"
                      >
                        <FileImage size={14} /> Open first artwork
                      </a>
                    )}
                    {form.adminProductionExportEnabled && (
                      <button
                        type="button"
                        disabled={exportingId === entry.orderItemId}
                        onClick={async () => {
                          setExportingId(entry.orderItemId);
                          setError("");
                          try {
                            await exportProductionPackage({ items: entry.spec.layout || [], width: Number(entry.spec.width), length: Number(entry.spec.length), settings: form, orderNumber: entry.orderNumber, itemId: entry.orderItemId });
                          } catch (err) {
                            setError(err?.message || "Could not export this film.");
                          } finally {
                            setExportingId("");
                          }
                        }}
                        className="mt-3 ml-3 inline-flex items-center gap-2 text-xs font-semibold hover:underline disabled:opacity-40"
                      >
                        <FileArchive size={14} /> {exportingId === entry.orderItemId ? "Building files…" : "Export film ZIP"}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = "1", min = "0", prefix = "", suffix = "" }) {
  return (
    <div>
      <label className="text-xs font-medium text-[#555]">{label}</label>
      <div className="mt-1.5 flex h-10 items-center rounded-lg border border-[#d4d4d4] bg-white px-3 focus-within:border-[#777]">
        {prefix && <span className="mr-1 text-sm text-[#777]">{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {suffix && <span className="ml-2 text-xs text-[#888]">{suffix}</span>}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, helper = "" }) {
  return (
    <div>
      <label className="text-xs font-medium text-[#555]">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm outline-none focus:border-[#777]"
      />
      {helper && <p className="mt-1 text-[11px] text-[#888]">{helper}</p>}
    </div>
  );
}

function ToggleField({ label, helper, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[#e3e3e3] p-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-[11px] leading-4 text-[#888]">{helper}</span>
      </span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label>
      <span className="text-xs font-medium text-[#555]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:border-[#777]">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function Snapshot({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f7f7f7] p-3">
      <div className="text-[10px] uppercase tracking-[0.08em] text-[#888]">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Small({ label, value }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.08em] text-[#999]">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
