import React, { useEffect, useId, useMemo, useState } from "react";

const FONT_OPTIONS = [
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', Georgia, serif", group: "Elegant serif" },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif", group: "Classic serif" },
  { label: "Great Vibes", value: "'Great Vibes', 'Brush Script MT', cursive", group: "Memorial script" },
  { label: "Bebas Neue", value: "'Bebas Neue', Impact, sans-serif", group: "Condensed display" },
  { label: "Archivo", value: "'Archivo', Arial, sans-serif", group: "Modern sans" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif", group: "Traditional serif" },
];

const FIELD_LABELS = {
  name: "Name",
  dates: "Dates",
  message: "Message",
};

const BASE_FIELD_STYLES = {
  name: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 700,
    fontStyle: "normal",
    size: 100,
    shape: "straight",
    curve: 34,
    letterSpacing: 1,
    align: "center",
    case: "as-typed",
    colorMode: "auto",
    color: "#ffffff",
    outlineWidth: 1.25,
    outlineColor: "#111111",
    shadow: "soft",
    lineHeight: 1,
    autoFit: true,
    x: 50,
    y: 22,
  },
  dates: {
    fontFamily: "'Archivo', Arial, sans-serif",
    fontWeight: 600,
    fontStyle: "normal",
    size: 82,
    shape: "straight",
    curve: 24,
    letterSpacing: 2,
    align: "center",
    case: "as-typed",
    colorMode: "auto",
    color: "#ffffff",
    outlineWidth: 0.75,
    outlineColor: "#111111",
    shadow: "soft",
    lineHeight: 1,
    autoFit: true,
    x: 50,
    y: 54,
  },
  message: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 600,
    fontStyle: "italic",
    size: 74,
    shape: "straight",
    curve: 18,
    letterSpacing: 0.5,
    align: "center",
    case: "as-typed",
    colorMode: "auto",
    color: "#ffffff",
    outlineWidth: 0.5,
    outlineColor: "#111111",
    shadow: "soft",
    lineHeight: 1.1,
    autoFit: true,
    x: 50,
    y: 81,
  },
};

const PRESETS = [
  {
    id: "timeless",
    label: "Timeless Serif",
    description: "Elegant, balanced and easy to read.",
    patch: {
      name: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontStyle: "normal", shape: "straight", size: 100, letterSpacing: 1 },
      dates: { fontFamily: "'Archivo', Arial, sans-serif", fontWeight: 600, shape: "straight", size: 82, letterSpacing: 2 },
      message: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontStyle: "italic", shape: "straight", size: 74 },
    },
  },
  {
    id: "heavenly-script",
    label: "Heavenly Script",
    description: "Soft script name with restrained supporting type.",
    patch: {
      name: { fontFamily: "'Great Vibes', 'Brush Script MT', cursive", fontWeight: 400, fontStyle: "normal", shape: "straight", size: 118, letterSpacing: 0 },
      dates: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, shape: "straight", size: 78, letterSpacing: 2 },
      message: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, fontStyle: "italic", size: 72 },
    },
  },
  {
    id: "modern",
    label: "Modern Tribute",
    description: "Clean contemporary typography with quiet spacing.",
    patch: {
      name: { fontFamily: "'Archivo', Arial, sans-serif", fontWeight: 800, fontStyle: "normal", shape: "straight", size: 92, letterSpacing: 1.5 },
      dates: { fontFamily: "'Archivo', Arial, sans-serif", fontWeight: 500, shape: "straight", size: 72, letterSpacing: 3 },
      message: { fontFamily: "'Archivo', Arial, sans-serif", fontWeight: 500, fontStyle: "normal", size: 64, letterSpacing: 0 },
    },
  },
  {
    id: "classic-arch",
    label: "Classic Arch",
    description: "A gentle arched name that frames the portrait.",
    patch: {
      name: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontStyle: "normal", shape: "arch-up", curve: 38, size: 98, letterSpacing: 1 },
      dates: { fontFamily: "'Archivo', Arial, sans-serif", fontWeight: 600, shape: "straight", size: 76, letterSpacing: 2 },
      message: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontStyle: "italic", shape: "straight", size: 70 },
    },
  },
  {
    id: "legacy-bold",
    label: "Legacy Bold",
    description: "Strong display lettering with compact supporting type.",
    patch: {
      name: { fontFamily: "'Bebas Neue', Impact, sans-serif", fontWeight: 400, fontStyle: "normal", shape: "straight", size: 112, letterSpacing: 2, case: "uppercase" },
      dates: { fontFamily: "'Archivo', Arial, sans-serif", fontWeight: 700, shape: "straight", size: 72, letterSpacing: 2.5 },
      message: { fontFamily: "'Archivo', Arial, sans-serif", fontWeight: 500, fontStyle: "normal", size: 62 },
    },
  },
  {
    id: "soft-remembrance",
    label: "Soft Remembrance",
    description: "A delicate serif treatment with subtle emphasis.",
    patch: {
      name: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, fontStyle: "italic", shape: "straight", size: 96, letterSpacing: 0.5 },
      dates: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, shape: "straight", size: 78, letterSpacing: 1.5 },
      message: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, fontStyle: "italic", size: 70 },
    },
  },
];

export const DEFAULT_MEMORIAL_TYPOGRAPHY = {
  version: 1,
  preset: "timeless",
  keepRecommendedPlacement: true,
  fields: BASE_FIELD_STYLES,
};

function number(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeField(field, fallback) {
  const source = field && typeof field === "object" ? field : {};
  return {
    ...fallback,
    ...source,
    fontWeight: number(source.fontWeight, fallback.fontWeight, 300, 900),
    size: number(source.size, fallback.size, 45, 160),
    curve: number(source.curve, fallback.curve, 0, 100),
    letterSpacing: number(source.letterSpacing, fallback.letterSpacing, -2, 12),
    outlineWidth: number(source.outlineWidth, fallback.outlineWidth, 0, 6),
    lineHeight: number(source.lineHeight, fallback.lineHeight, 0.8, 1.8),
    x: number(source.x, fallback.x, 10, 90),
    y: number(source.y, fallback.y, 5, 95),
  };
}

export function normalizeMemorialTypography(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: 1,
    preset: String(source.preset || DEFAULT_MEMORIAL_TYPOGRAPHY.preset),
    keepRecommendedPlacement: source.keepRecommendedPlacement !== false,
    fields: {
      name: normalizeField(source.fields?.name, BASE_FIELD_STYLES.name),
      dates: normalizeField(source.fields?.dates, BASE_FIELD_STYLES.dates),
      message: normalizeField(source.fields?.message, BASE_FIELD_STYLES.message),
    },
  };
}

function transformText(value, mode) {
  const text = String(value || "");
  if (mode === "uppercase") return text.toUpperCase();
  if (mode === "title") return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return text;
}

function textLines(value, maxChars = 42) {
  const clean = String(value || "").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  if (lines.length <= 2) return lines;
  const first = lines[0];
  const second = lines.slice(1).join(" ");
  return [first, second.length > maxChars + 8 ? `${second.slice(0, maxChars + 7).trim()}…` : second];
}

function autoFitScale(text, fieldKey, enabled) {
  if (!enabled) return 1;
  const lengths = { name: 24, dates: 30, message: 44 };
  const target = lengths[fieldKey] || 30;
  const length = String(text || "").trim().length;
  if (!length || length <= target) return 1;
  return Math.max(0.62, target / length);
}

function shadowFilter(shadow) {
  if (shadow === "offset") return "drop-shadow(3px 4px 1px rgba(0,0,0,.62))";
  if (shadow === "soft") return "drop-shadow(0 2px 3px rgba(0,0,0,.62))";
  return "none";
}

function resolvedPlacement(fieldKey, field, keepRecommendedPlacement) {
  if (!keepRecommendedPlacement) return { x: field.x, y: field.y };
  return { x: BASE_FIELD_STYLES[fieldKey].x, y: BASE_FIELD_STYLES[fieldKey].y };
}

function CurvedText({ fieldKey, text, field, tone = "light" }) {
  const transformed = transformText(text, field.case);
  const lines = fieldKey === "message" && field.shape === "straight" ? textLines(transformed) : [transformed];
  const fit = autoFitScale(transformed, fieldKey, field.autoFit);
  const baseSize = fieldKey === "name" ? 76 : fieldKey === "dates" ? 45 : 39;
  const fontSize = baseSize * (Number(field.size || 100) / 100) * fit;
  const fill = field.colorMode === "custom" ? field.color : tone === "dark" ? "#24211f" : "#ffffff";
  const outline = field.outlineColor || (tone === "dark" ? "#ffffff" : "#111111");
  const anchor = field.align === "left" ? "start" : field.align === "right" ? "end" : "middle";
  const anchorX = field.align === "left" ? 75 : field.align === "right" ? 925 : 500;
  const curve = Math.max(0, Math.min(100, Number(field.curve || 0)));
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pathId = `memorial-${fieldKey}-${reactId}-${String(field.shape || "straight").replace(/[^a-z-]/g, "")}`;
  const archY = field.shape === "arch-down" ? 64 : 132;
  const controlY = field.shape === "arch-down"
    ? archY + 24 + curve * 0.72
    : archY - 24 - curve * 0.72;
  const path = `M 75 ${archY} Q 500 ${controlY} 925 ${archY}`;

  return (
    <svg viewBox="0 0 1000 210" className="h-full w-full overflow-visible" aria-hidden="true" style={{ filter: shadowFilter(field.shadow) }}>
      {field.shape !== "straight" && <defs><path id={pathId} d={path} /></defs>}
      {field.shape !== "straight" ? (
        <text
          fill={fill}
          stroke={outline}
          strokeWidth={Number(field.outlineWidth || 0) * 1.5}
          paintOrder="stroke fill"
          fontFamily={field.fontFamily}
          fontWeight={field.fontWeight}
          fontStyle={field.fontStyle}
          fontSize={fontSize}
          letterSpacing={Number(field.letterSpacing || 0) * 1.7}
        >
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">{transformed}</textPath>
        </text>
      ) : (
        <text
          x={anchorX}
          y={lines.length > 1 ? 85 : 118}
          textAnchor={anchor}
          fill={fill}
          stroke={outline}
          strokeWidth={Number(field.outlineWidth || 0) * 1.5}
          paintOrder="stroke fill"
          fontFamily={field.fontFamily}
          fontWeight={field.fontWeight}
          fontStyle={field.fontStyle}
          fontSize={fontSize}
          letterSpacing={Number(field.letterSpacing || 0) * 1.7}
        >
          {lines.map((line, index) => (
            <tspan key={`${line}-${index}`} x={anchorX} dy={index === 0 ? 0 : fontSize * Number(field.lineHeight || 1.1)}>{line}</tspan>
          ))}
        </text>
      )}
    </svg>
  );
}

export function MemorialTypographyPreview({ personalization, tone = "light" }) {
  const typography = normalizeMemorialTypography(personalization?.memorialTypography);
  const content = {
    name: personalization?.name || "",
    dates: personalization?.dates || "",
    message: personalization?.message || "",
  };

  return (
    <div className="absolute inset-0 overflow-visible pointer-events-none" data-memorial-typography-preview="true">
      {Object.keys(content).map((fieldKey) => {
        const text = content[fieldKey];
        if (!String(text || "").trim()) return null;
        const field = typography.fields[fieldKey];
        const placement = resolvedPlacement(fieldKey, field, typography.keepRecommendedPlacement);
        return (
          <div
            key={fieldKey}
            className="absolute h-[42%] w-[98%] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${placement.x}%`, top: `${placement.y}%` }}
            data-memorial-text-role={fieldKey}
          >
            <CurvedText fieldKey={fieldKey} text={text} field={field} tone={tone} />
          </div>
        );
      })}
    </div>
  );
}

function ControlLabel({ children }) {
  return <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.11em] text-[#6C655E]">{children}</span>;
}

function RangeControl({ label, value, min, max, step = 1, suffix = "", disabled = false, onChange }) {
  return (
    <label className={disabled ? "block opacity-45" : "block"}>
      <div className="flex items-center justify-between gap-3">
        <ControlLabel>{label}</ControlLabel>
        <span className="font-mono text-[9px] text-[#6C655E]">{Number(value).toFixed(step < 1 ? 1 : 0)}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="mt-1.5 w-full accent-[#8A3B45]" />
    </label>
  );
}

export function MemorialTypographyEditor({ value, onChange }) {
  const typography = useMemo(() => normalizeMemorialTypography(value), [value]);
  const [activeField, setActiveField] = useState("name");
  const active = typography.fields[activeField];

  useEffect(() => {
    if (!value || value?.version !== 1 || !value?.fields) onChange?.(typography);
  }, [value, typography, onChange]);

  const emit = (next) => onChange?.(normalizeMemorialTypography(next));
  const patchField = (patch) => emit({
    ...typography,
    preset: "custom",
    fields: {
      ...typography.fields,
      [activeField]: { ...active, ...patch },
    },
  });

  const applyPreset = (preset) => {
    const nextFields = Object.fromEntries(
      Object.keys(typography.fields).map((key) => [key, { ...typography.fields[key], ...(preset.patch[key] || {}) }])
    );
    emit({ ...typography, preset: preset.id, fields: nextFields });
  };

  const resetActive = () => emit({
    ...typography,
    preset: "custom",
    fields: {
      ...typography.fields,
      [activeField]: { ...BASE_FIELD_STYLES[activeField] },
    },
  });

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-[#D8D1C7] bg-white shadow-[0_12px_35px_rgba(35,29,24,.055)]" data-memorial-typography-editor="true">
      <div className="border-b border-[#E7E0D7] bg-[#FBF8F4] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-bold text-[#27231F]">Memorial text & style</div>
            <p className="mt-1 text-xs leading-relaxed text-[#6F6860]">Style the name, dates and remembrance message independently. Every change updates the live garment preview.</p>
          </div>
          <button type="button" onClick={() => applyPreset(PRESETS[0])} className="shrink-0 rounded-xl border border-[#D8D1C7] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#5D5148] hover:border-[#8A3B45] hover:text-[#8A3B45]">Recommended style</button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <ControlLabel>Style presets</ControlLabel>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
          {PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              onClick={() => applyPreset(preset)}
              aria-pressed={typography.preset === preset.id}
              className={"rounded-xl border p-3 text-left transition " + (typography.preset === preset.id ? "border-[#8A3B45] bg-[#FFF5F4] shadow-sm" : "border-[#E0D9D0] bg-[#FFFEFC] hover:border-[#B6A99D]")}
            >
              <div className="text-xs font-bold text-[#352F2A]">{preset.label}</div>
              <div className="mt-1 text-[10px] leading-relaxed text-[#766E66]">{preset.description}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 border-t border-[#ECE5DD] pt-4">
          <ControlLabel>Edit text element</ControlLabel>
          <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-[#F4EFE9] p-1">
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              <button type="button" key={key} onClick={() => setActiveField(key)} className={"rounded-lg px-3 py-2 text-[11px] font-bold transition " + (activeField === key ? "bg-white text-[#8A3B45] shadow-sm" : "text-[#6B625A] hover:text-[#352F2A]")}>{label}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            <ControlLabel>Font</ControlLabel>
            <select value={active.fontFamily} onChange={(event) => patchField({ fontFamily: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-[#D8D1C7] bg-white px-3 text-sm outline-none focus:border-[#8A3B45]" style={{ fontFamily: active.fontFamily }}>
              {FONT_OPTIONS.map((font) => <option key={font.label} value={font.value}>{font.label} — {font.group}</option>)}
            </select>
          </label>
          <label>
            <ControlLabel>Weight</ControlLabel>
            <select value={active.fontWeight} onChange={(event) => patchField({ fontWeight: Number(event.target.value) })} className="mt-1.5 h-11 w-full rounded-xl border border-[#D8D1C7] bg-white px-3 text-sm outline-none focus:border-[#8A3B45]">
              <option value={400}>Regular</option>
              <option value={500}>Medium</option>
              <option value={600}>Semi Bold</option>
              <option value={700}>Bold</option>
              <option value={800}>Extra Bold</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <RangeControl label="Size" value={active.size} min={45} max={160} suffix="%" onChange={(size) => patchField({ size })} />
          <RangeControl label="Letter spacing" value={active.letterSpacing} min={-2} max={12} step={0.5} suffix="px" onChange={(letterSpacing) => patchField({ letterSpacing })} />
        </div>

        <div className="mt-4">
          <ControlLabel>Text shape</ControlLabel>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ["straight", "Straight", "—"],
              ["arch-up", "Arch up", "⌒"],
              ["arch-down", "Arch down", "⌣"],
            ].map(([shape, label, mark]) => (
              <button type="button" key={shape} onClick={() => patchField({ shape })} className={"rounded-xl border px-2 py-2.5 text-center transition " + (active.shape === shape ? "border-[#8A3B45] bg-[#FFF5F4] text-[#8A3B45]" : "border-[#DDD5CB] bg-white text-[#5F5750]")}>
                <span className="block text-lg leading-none">{mark}</span><span className="mt-1 block text-[10px] font-bold uppercase">{label}</span>
              </button>
            ))}
          </div>
          {active.shape !== "straight" && <div className="mt-3"><RangeControl label="Curve amount" value={active.curve} min={0} max={100} suffix="%" onChange={(curve) => patchField({ curve })} /></div>}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label>
            <ControlLabel>Alignment</ControlLabel>
            <select value={active.align} onChange={(event) => patchField({ align: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-[#D8D1C7] bg-white px-3 text-sm outline-none focus:border-[#8A3B45]">
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </label>
          <label>
            <ControlLabel>Letter case</ControlLabel>
            <select value={active.case} onChange={(event) => patchField({ case: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-[#D8D1C7] bg-white px-3 text-sm outline-none focus:border-[#8A3B45]">
              <option value="as-typed">As typed</option><option value="uppercase">UPPERCASE</option><option value="title">Title Case</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
          <label className="rounded-xl border border-[#E0D9D0] bg-[#FBF8F4] p-3">
            <div className="flex items-center justify-between gap-2"><ControlLabel>Text color</ControlLabel><input type="checkbox" checked={active.colorMode !== "custom"} onChange={(event) => patchField({ colorMode: event.target.checked ? "auto" : "custom" })} /></div>
            <div className="mt-2 flex items-center gap-2"><input type="color" disabled={active.colorMode !== "custom"} value={active.color || "#ffffff"} onChange={(event) => patchField({ colorMode: "custom", color: event.target.value })} className="h-8 w-11 rounded border border-[#D8D1C7] bg-white p-1 disabled:opacity-40"/><span className="text-[10px] text-[#706860]">{active.colorMode === "custom" ? "Custom" : "Auto contrast"}</span></div>
          </label>
          <label className="rounded-xl border border-[#E0D9D0] bg-[#FBF8F4] p-3">
            <ControlLabel>Outline color</ControlLabel>
            <div className="mt-2 flex items-center gap-2"><input type="color" value={active.outlineColor || "#111111"} onChange={(event) => patchField({ outlineColor: event.target.value })} className="h-8 w-11 rounded border border-[#D8D1C7] bg-white p-1"/><span className="text-[10px] text-[#706860]">Print-safe edge</span></div>
          </label>
          <label className="rounded-xl border border-[#E0D9D0] bg-[#FBF8F4] p-3">
            <ControlLabel>Shadow</ControlLabel>
            <select value={active.shadow} onChange={(event) => patchField({ shadow: event.target.value })} className="mt-2 h-8 w-full rounded-lg border border-[#D8D1C7] bg-white px-2 text-[10px]"><option value="none">None</option><option value="soft">Soft</option><option value="offset">Offset</option></select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <RangeControl label="Outline" value={active.outlineWidth} min={0} max={6} step={0.5} suffix="px" onChange={(outlineWidth) => patchField({ outlineWidth })} />
          {activeField === "message" ? <RangeControl label="Line spacing" value={active.lineHeight} min={0.8} max={1.8} step={0.1} suffix="×" onChange={(lineHeight) => patchField({ lineHeight })} /> : <label className="flex items-center gap-2 rounded-xl border border-[#E0D9D0] bg-[#FBF8F4] px-3 py-2.5 text-xs text-[#5F5750]"><input type="checkbox" checked={active.fontStyle === "italic"} onChange={(event) => patchField({ fontStyle: event.target.checked ? "italic" : "normal" })}/> Italic style</label>}
        </div>

        <div className="mt-4 rounded-xl border border-[#E0D9D0] bg-[#FBF8F4] p-3.5">
          <label className="flex items-start gap-2.5 text-xs text-[#514A44]"><input type="checkbox" checked={typography.keepRecommendedPlacement} onChange={(event) => emit({ ...typography, keepRecommendedPlacement: event.target.checked })} className="mt-0.5"/><span><strong>Keep recommended placement</strong><span className="mt-0.5 block text-[10px] leading-relaxed text-[#766E66]">On by default so memorial text stays balanced and inside the template’s safe area. Turn it off to position each text element manually.</span></span></label>
          <details className="mt-3 border-t border-[#E3DBD2] pt-3">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-[#625950]">Advanced placement</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <RangeControl label="Horizontal position" value={active.x} min={10} max={90} suffix="%" disabled={typography.keepRecommendedPlacement} onChange={(x) => patchField({ x })} />
              <RangeControl label="Vertical position" value={active.y} min={5} max={95} suffix="%" disabled={typography.keepRecommendedPlacement} onChange={(y) => patchField({ y })} />
            </div>
          </details>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#ECE5DD] pt-4">
          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#5C544D]"><input type="checkbox" checked={active.autoFit !== false} onChange={(event) => patchField({ autoFit: event.target.checked })}/> Auto-fit long text to the safe area</label>
          <button type="button" onClick={resetActive} className="rounded-lg border border-[#D8D1C7] bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-[#6A6057] hover:border-[#8A3B45] hover:text-[#8A3B45]">Reset {FIELD_LABELS[activeField]}</button>
        </div>
      </div>
    </div>
  );
}
