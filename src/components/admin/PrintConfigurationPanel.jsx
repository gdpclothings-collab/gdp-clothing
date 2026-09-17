import React, { useMemo, useState } from "react";
import { AlertTriangle, Database, RotateCcw, ShieldCheck } from "lucide-react";
import { requestConfirmation } from "@/lib/NotificationContext";
import { resolveStudioV2PrintProfile } from "@/lib/customStudioV2Production";

const inputClass =
  "w-full h-9 rounded-lg border border-[#d5d5d5] bg-white px-2.5 text-xs outline-none focus:ring-2 focus:ring-black/10";

const validNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

function sideLabel(side) {
  return side === "back" ? "Back" : "Front";
}

function SourceBadge({ source }) {
  const styles = {
    "Size override": "border-violet-200 bg-violet-50 text-violet-700",
    "Product default": "border-blue-200 bg-blue-50 text-blue-700",
    "Code fallback": "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${styles[source] || styles["Code fallback"]}`}>
      {source}
    </span>
  );
}

function NumberField({ label, value, placeholder, min, max, step = 0.25, onChange, helper = "" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-[#6d7680]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
      {helper && <span className="mt-1 block text-[9px] leading-4 text-[#7b838b]">{helper}</span>}
    </label>
  );
}

export default function PrintConfigurationPanel({ form, setForm, sizes = [] }) {
  const [activeSide, setActiveSide] = useState("front");
  const uniqueSizes = useMemo(
    () => Array.from(new Set((sizes || []).map((size) => String(size || "").trim()).filter(Boolean))),
    [sizes]
  );

  const printGuide = form?.customization?.preview?.printGuide || {};
  const sideGuide = printGuide?.[activeSide] || {};
  const sizeScalingEnabled = sideGuide.sizeScalingEnabled !== false;

  const mutateGuide = (recipe) => {
    setForm((current) => {
      const currentPreview = current.customization?.preview || {};
      const currentGuide = currentPreview.printGuide || {};
      const nextGuide = recipe(currentGuide);
      return {
        ...current,
        customization: {
          ...(current.customization || {}),
          preview: {
            ...currentPreview,
            printGuide: nextGuide,
          },
        },
      };
    });
  };

  const setSideValue = (side, key, value) => {
    mutateGuide((currentGuide) => ({
      ...currentGuide,
      [side]: {
        ...(currentGuide?.[side] || {}),
        [key]: typeof value === "boolean" ? value : value === "" ? "" : Number(value),
      },
    }));
  };

  const setSizeValue = (side, size, key, value) => {
    mutateGuide((currentGuide) => ({
      ...currentGuide,
      [side]: {
        ...(currentGuide?.[side] || {}),
        sizeOverrides: {
          ...(currentGuide?.[side]?.sizeOverrides || {}),
          [size]: {
            ...(currentGuide?.[side]?.sizeOverrides?.[size] || {}),
            [key]: value === "" ? "" : Number(value),
          },
        },
      },
    }));
  };

  const clearSizeOverride = (side, size) => {
    mutateGuide((currentGuide) => {
      const nextSide = { ...(currentGuide?.[side] || {}) };
      const nextOverrides = { ...(nextSide.sizeOverrides || {}) };
      delete nextOverrides[size];
      if (Object.keys(nextOverrides).length) nextSide.sizeOverrides = nextOverrides;
      else delete nextSide.sizeOverrides;
      return { ...currentGuide, [side]: nextSide };
    });
  };

  const clearSideOverride = async (side) => {
    const confirmed = await requestConfirmation(
      `Clear the ${sideLabel(side)} database print configuration? Custom Studio will immediately use the verified code fallback until you save new product values.`
    );
    if (!confirmed) return;
    mutateGuide((currentGuide) => {
      const nextGuide = { ...currentGuide };
      delete nextGuide[side];
      return nextGuide;
    });
  };

  const effectiveRows = uniqueSizes.map((size) => {
    const profile = resolveStudioV2PrintProfile(form, size, activeSide);
    const override = sideGuide?.sizeOverrides?.[size] || {};
    const hasSizeOverride =
      sizeScalingEnabled &&
      (validNumber(override.widthIn) || validNumber(override.heightIn) || validNumber(override.collarIn));
    const hasProductDefault = validNumber(sideGuide.widthIn) && validNumber(sideGuide.heightIn);
    return {
      size,
      profile,
      override,
      source: hasSizeOverride ? "Size override" : hasProductDefault ? "Product default" : "Code fallback",
    };
  });

  const sideHasDatabaseDefault = validNumber(sideGuide.widthIn) && validNumber(sideGuide.heightIn);
  const sideHasAnyDatabaseValue = Boolean(
    Object.keys(sideGuide || {}).some((key) => key !== "sizeOverrides") ||
    Object.keys(sideGuide?.sizeOverrides || {}).length
  );

  return (
    <div className="rounded-xl border border-[#cfd9e3] bg-[#f8fafc] overflow-hidden">
      <div className="border-b border-[#dbe3ea] bg-white px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#17324D]">
              <Database size={16} /> Print Configuration
            </div>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#66727e]">
              Product metadata is authoritative. Custom Studio, the visible print guide and the 300-DPI production renderer read the same saved Front / Back values. Code presets are used only when this product does not have valid database measurements.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
            <ShieldCheck size={13} /> Database first · fallback protected
          </div>
        </div>

        <div className="mt-3 inline-flex rounded-lg border border-[#d8dfe5] bg-[#f5f7f9] p-1">
          {["front", "back"].map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setActiveSide(side)}
              className={`h-8 rounded-md px-4 text-[10px] font-bold uppercase tracking-wide transition ${activeSide === side ? "bg-white text-[#17324D] shadow-sm" : "text-[#6b7782] hover:text-[#17324D]"}`}
            >
              {sideLabel(side)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-2 rounded-lg border border-[#dbe3ea] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#23384b]">{sideLabel(activeSide)} product default</div>
            <div className="mt-0.5 text-[10px] leading-4 text-[#6a7580]">
              {sideHasDatabaseDefault
                ? "Saved product measurements currently override the code preset."
                : "No complete saved product default. Effective values will come from verified code fallback unless a size override exists."}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={sideHasDatabaseDefault ? "Product default" : "Code fallback"} />
            {sideHasAnyDatabaseValue && (
              <button
                type="button"
                onClick={() => clearSideOverride(activeSide)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d5dce2] bg-white px-2.5 text-[10px] font-semibold text-[#59636d] hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                <RotateCcw size={12} /> Reset side to fallback
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <NumberField
            label="Width (in)"
            value={sideGuide.widthIn}
            placeholder="Fallback"
            min={2}
            max={20}
            onChange={(value) => setSideValue(activeSide, "widthIn", value)}
          />
          <NumberField
            label="Height (in)"
            value={sideGuide.heightIn}
            placeholder="Fallback"
            min={2}
            max={24}
            onChange={(value) => setSideValue(activeSide, "heightIn", value)}
          />
          <NumberField
            label="Collar offset (in)"
            value={sideGuide.collarIn}
            placeholder="Fallback"
            min={0.5}
            max={12}
            onChange={(value) => setSideValue(activeSide, "collarIn", value)}
          />
          <NumberField
            label="Maximum width"
            value={sideGuide.maxWidthIn}
            placeholder="Optional"
            min={2}
            max={20}
            onChange={(value) => setSideValue(activeSide, "maxWidthIn", value)}
          />
          <NumberField
            label="Maximum height"
            value={sideGuide.maxHeightIn}
            placeholder="Optional"
            min={2}
            max={24}
            onChange={(value) => setSideValue(activeSide, "maxHeightIn", value)}
          />
        </div>

        <label className="flex items-start gap-2 rounded-lg border border-[#dbe3ea] bg-white p-3">
          <input
            type="checkbox"
            checked={sizeScalingEnabled}
            onChange={(event) => setSideValue(activeSide, "sizeScalingEnabled", event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-xs font-semibold text-[#23384b]">Allow per-size overrides</span>
            <span className="mt-0.5 block text-[10px] leading-4 text-[#6a7580]">
              When enabled, a saved size row can override Width, Height and Collar Offset for only that size. Blank rows inherit the product default or the verified code fallback.
            </span>
          </span>
        </label>

        <div className="overflow-hidden rounded-lg border border-[#dbe3ea] bg-white">
          <div className="flex flex-col gap-1 border-b border-[#e6ebef] bg-[#f7f9fb] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#536170]">Size overrides</div>
              <div className="text-[9px] text-[#7a858f]">Effective measurements are shown even when no database override exists.</div>
            </div>
            <div className="text-[9px] text-[#7a858f]">{uniqueSizes.length} configured product size{uniqueSizes.length === 1 ? "" : "s"}</div>
          </div>

          {!uniqueSizes.length ? (
            <div className="p-4 text-xs text-[#777]">
              Add product sizes or variants first. Print Configuration will automatically use the real product sizes instead of creating adult sizes for Youth or Toddler garments.
            </div>
          ) : (
            <div className="divide-y divide-[#edf0f2]">
              {effectiveRows.map(({ size, profile, override, source }) => (
                <div key={`${activeSide}-${size}`} className="grid gap-2 p-3 lg:grid-cols-[minmax(72px,.6fr)_1fr_1fr_1fr_minmax(110px,.9fr)_auto] lg:items-end">
                  <div className="pb-1">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-[#7b858f]">Size</div>
                    <div className="mt-1 text-sm font-bold text-[#23384b]">{size}</div>
                  </div>
                  <NumberField
                    label="Width"
                    value={override.widthIn}
                    placeholder={String(profile.widthIn)}
                    min={2}
                    max={20}
                    onChange={(value) => setSizeValue(activeSide, size, "widthIn", value)}
                    helper={`Effective ${profile.widthIn} in`}
                  />
                  <NumberField
                    label="Height"
                    value={override.heightIn}
                    placeholder={String(profile.heightIn)}
                    min={2}
                    max={24}
                    onChange={(value) => setSizeValue(activeSide, size, "heightIn", value)}
                    helper={`Effective ${profile.heightIn} in`}
                  />
                  <NumberField
                    label="Collar offset"
                    value={override.collarIn}
                    placeholder={profile.collarIn ? String(profile.collarIn) : "Default"}
                    min={0.5}
                    max={12}
                    onChange={(value) => setSizeValue(activeSide, size, "collarIn", value)}
                    helper={profile.collarIn ? `Effective ${profile.collarIn} in` : "No offset set"}
                  />
                  <div className="pb-1">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-[#7b858f]">Source</div>
                    <div className="mt-1"><SourceBadge source={source} /></div>
                  </div>
                  <button
                    type="button"
                    disabled={!sideGuide?.sizeOverrides?.[size]}
                    onClick={() => clearSizeOverride(activeSide, size)}
                    className="h-9 rounded-lg border border-[#d5dce2] px-2.5 text-[10px] font-semibold text-[#5f6972] disabled:cursor-not-allowed disabled:opacity-35 hover:bg-[#f7f8f9]"
                  >
                    Use default
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {!sideHasDatabaseDefault && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] leading-4 text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {sideLabel(activeSide)} is currently protected by the code fallback. This is safe, but saving explicit product measurements is recommended when a new blank has manufacturer-specific printable limits.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
