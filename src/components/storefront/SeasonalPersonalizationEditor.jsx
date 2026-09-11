import React from 'react';
import { AlertTriangle, Check, ChevronDown, Edit3, RotateCcw, Sparkles } from 'lucide-react';
import { SEASONAL_TEXT_FONTS, normalizeSeasonalTextStyle } from '@/lib/seasonalArtwork';

const clamp = (value, min, max, fallback = min) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

export function defaultSeasonalText(color = '#111111') {
  return {
    name: '',
    message: '',
    color,
    nameStyle: normalizeSeasonalTextStyle({ color, scale: 100, weight: 700, align: 'center' }, color),
    messageStyle: normalizeSeasonalTextStyle({ color, scale: 88, weight: 600, align: 'center' }, color),
  };
}

export function normalizeSeasonalTextState(value = {}, fallbackColor = '#111111') {
  const legacyColor = /^#[0-9a-f]{6}$/i.test(String(value?.color || '')) ? String(value.color).toLowerCase() : fallbackColor;
  return {
    name: String(value?.name || '').slice(0, 32),
    message: String(value?.message || '').slice(0, 60),
    color: legacyColor,
    nameStyle: normalizeSeasonalTextStyle(value?.nameStyle || {}, legacyColor),
    messageStyle: normalizeSeasonalTextStyle(value?.messageStyle || { scale: 88, weight: 600 }, legacyColor),
  };
}

export function textDisplayValue(value, style) {
  const raw = String(value || '');
  return style?.uppercase ? raw.toUpperCase() : raw;
}

function fittedFontSize(value, base, style, floor = 11) {
  const clean = textDisplayValue(value, style);
  const scale = clamp(style?.scale, 65, 150, 100) / 100;
  const fit = clean.length ? Math.min(base, 760 / clean.length) : base;
  return Math.max(floor, fit * scale);
}

export function SeasonalSvgText({ value, style, y = 40, baseSize = 24, idPrefix = 'seasonal-text' }) {
  if (!String(value || '').trim()) return null;
  const normalized = normalizeSeasonalTextStyle(style, '#111111');
  const display = textDisplayValue(value, normalized);
  const fontSize = fittedFontSize(display, baseSize, normalized);
  const x = normalized.align === 'left' ? 42 : normalized.align === 'right' ? 558 : 300;
  const anchor = normalized.align === 'left' ? 'start' : normalized.align === 'right' ? 'end' : 'middle';
  const common = {
    fill: normalized.color,
    fontFamily: normalized.fontFamily,
    fontSize,
    fontWeight: normalized.weight,
    fontStyle: normalized.italic ? 'italic' : 'normal',
    letterSpacing: normalized.letterSpacing,
    stroke: normalized.outlineWidth ? normalized.outlineColor : 'none',
    strokeWidth: normalized.outlineWidth,
    paintOrder: 'stroke fill',
    style: normalized.shadow ? { filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,.34))' } : undefined,
  };

  if (Math.abs(normalized.curve) < 1) {
    return <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" strokeLinejoin="round" {...common}>{display}</text>;
  }

  const safeId = `${idPrefix}-${Math.abs(Math.round(normalized.curve * 10))}-${normalized.curve < 0 ? 'down' : 'up'}`;
  const bend = normalized.curve * 1.65;
  const path = `M 42 ${y} Q 300 ${y - bend} 558 ${y}`;
  return (
    <>
      <path id={safeId} d={path} fill="none" stroke="none" />
      <text textAnchor="middle" strokeLinejoin="round" {...common}><textPath href={`#${safeId}`} startOffset="50%">{display}</textPath></text>
    </>
  );
}

function StyleButton({ active, children, onClick, title = undefined }) {
  return <button type="button" onClick={onClick} aria-pressed={active} title={title} className={`min-h-10 rounded-xl border px-3 text-xs font-bold transition ${active ? 'border-[#17324D] bg-[#17324D] text-white' : 'border-[#DCE3EA] bg-white text-[#52616F] hover:border-[#9FB0BE]'}`}>{children}</button>;
}

export default function SeasonalPersonalizationEditor({ selected, text, activeTarget, setActiveTarget, updateText, updateStyle, clearPersonalization, recommendedTextColor, recommendedTextColorName, hasLowContrast }) {
  if (!selected?.customizable) return null;
  const targetKey = activeTarget === 'message' ? 'message' : 'name';
  const styleKey = `${targetKey}Style`;
  const style = normalizeSeasonalTextStyle(text?.[styleKey], text?.color || recommendedTextColor);
  const targetLabel = targetKey === 'name' ? 'Name' : 'Message';
  const targetValue = targetKey === 'name' ? text?.name : text?.message;
  const hasText = Boolean(String(text?.name || '').trim() || String(text?.message || '').trim());
  const styleChanged = style.fontFamily !== 'Arial' || style.scale !== (targetKey === 'name' ? 100 : 88) || style.weight !== (targetKey === 'name' ? 700 : 600) || style.italic || style.align !== 'center' || style.letterSpacing !== 0 || style.curve !== 0 || style.outlineWidth !== 0 || style.shadow || style.uppercase || style.color !== recommendedTextColor;

  const resetStyle = () => updateStyle(targetKey, normalizeSeasonalTextStyle({
    color: recommendedTextColor,
    scale: targetKey === 'name' ? 100 : 88,
    weight: targetKey === 'name' ? 700 : 600,
    align: 'center',
  }, recommendedTextColor));

  return (
    <fieldset className="mt-3 rounded-2xl border border-[#D7E0E7] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] p-3.5 shadow-[0_10px_28px_rgba(23,50,77,.05)] sm:p-4">
      <legend className="sr-only">Personalize seasonal design</legend>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#17324D] text-white"><Edit3 size={15} /></span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#17324D]">Personalize your design</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#667684]">Add a name or short message. Changes appear on the garment instantly.</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.09em] ${selected.requires_name ? 'bg-[#FFF1E6] text-[#9A531F]' : 'bg-[#EEF3F6] text-[#61717F]'}`}>{selected.requires_name ? 'Name required' : 'Optional'}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block" htmlFor="seasonal-personalization-name">
          <span className="flex items-center justify-between gap-3 text-xs font-bold text-[#34495C]"><span>Name {selected.requires_name ? <span className="text-[#A66331]">*</span> : null}</span><span className="font-medium tabular-nums text-[#80909D]">{String(text?.name || '').length} / 32</span></span>
          <input id="seasonal-personalization-name" value={text?.name || ''} maxLength={32} placeholder="e.g. Gerald" autoComplete="off" onFocus={() => setActiveTarget('name')} onChange={(event) => updateText({ name: event.target.value })} className="mt-1.5 block min-h-11 w-full rounded-xl border border-[#D7E0E7] bg-white px-3 text-sm text-[#17324D] outline-none transition placeholder:text-[#A1ADB7] focus:border-[#A66331] focus:ring-2 focus:ring-[#A66331]/15" />
          <span className="mt-1 block text-[10px] font-medium text-[#7A8995]">{selected.requires_name ? 'Placed in the template name area.' : 'Placed beneath the artwork.'}</span>
        </label>

        <label className="block" htmlFor="seasonal-personalization-message">
          <span className="flex items-center justify-between gap-3 text-xs font-bold text-[#34495C]"><span>Short message <span className="font-medium text-[#80909D]">(optional)</span></span><span className="font-medium tabular-nums text-[#80909D]">{String(text?.message || '').length} / 60</span></span>
          <textarea id="seasonal-personalization-message" value={text?.message || ''} maxLength={60} rows={2} placeholder="e.g. Summer vibes only" onFocus={() => setActiveTarget('message')} onChange={(event) => updateText({ message: event.target.value.replace(/\n{2,}/g, '\n').split('\n').slice(0, 2).join('\n') })} className="mt-1.5 block w-full resize-none rounded-xl border border-[#D7E0E7] bg-white px-3 py-2.5 text-sm leading-relaxed text-[#17324D] outline-none transition placeholder:text-[#A1ADB7] focus:border-[#A66331] focus:ring-2 focus:ring-[#A66331]/15" />
          <span className="mt-1 block text-[10px] font-medium text-[#7A8995]">Up to two short lines for a clean print.</span>
        </label>
      </div>

      <details className="mt-4 rounded-2xl border border-[#E0E6EB] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-xs font-bold text-[#17324D] [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2"><Sparkles size={14} className="text-[#A66331]" /> Edit {targetLabel.toLowerCase()} style</span>
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-[#7A8995]">{styleChanged ? 'Customized' : 'Template default'} <ChevronDown size={14} /></span>
        </summary>
        <div className="border-t border-[#E7ECF0] p-3.5">
          <div className="mb-3 grid grid-cols-2 rounded-xl bg-[#F1F4F7] p-1">
            <button type="button" onClick={() => setActiveTarget('name')} className={`rounded-lg px-3 py-2 text-xs font-bold ${targetKey === 'name' ? 'bg-white text-[#17324D] shadow-sm' : 'text-[#667684]'}`}>Name</button>
            <button type="button" onClick={() => setActiveTarget('message')} className={`rounded-lg px-3 py-2 text-xs font-bold ${targetKey === 'message' ? 'bg-white text-[#17324D] shadow-sm' : 'text-[#667684]'}`}>Message</button>
          </div>

          {!String(targetValue || '').trim() && <p className="mb-3 rounded-xl bg-[#F7F9FB] px-3 py-2 text-[10px] text-[#667684]">Type your {targetLabel.toLowerCase()} above, then style it here.</p>}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Font<select value={style.fontFamily} onChange={(event) => updateStyle(targetKey, { fontFamily: event.target.value })} className="mt-1 block min-h-11 w-full rounded-xl border border-[#DCE3EA] bg-white px-3 text-sm font-semibold normal-case text-[#17324D]">{SEASONAL_TEXT_FONTS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Size · {Math.round(style.scale)}%<input type="range" min="65" max="150" step="1" value={style.scale} onChange={(event) => updateStyle(targetKey, { scale: Number(event.target.value) })} className="mt-3 w-full accent-[#A66331]" /></label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[400, 600, 700, 900].map((weight) => <StyleButton key={weight} active={style.weight === weight} onClick={() => updateStyle(targetKey, { weight })}>{weight === 400 ? 'Regular' : weight === 600 ? 'Medium' : weight === 700 ? 'Bold' : 'Heavy'}</StyleButton>)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <StyleButton active={style.italic} onClick={() => updateStyle(targetKey, { italic: !style.italic })}>Italic</StyleButton>
            <StyleButton active={style.align === 'left'} onClick={() => updateStyle(targetKey, { align: 'left' })}>Left</StyleButton>
            <StyleButton active={style.align === 'center'} onClick={() => updateStyle(targetKey, { align: 'center' })}>Center</StyleButton>
            <StyleButton active={style.align === 'right'} onClick={() => updateStyle(targetKey, { align: 'right' })}>Right</StyleButton>
            <StyleButton active={style.uppercase} onClick={() => updateStyle(targetKey, { uppercase: !style.uppercase })}>ABC</StyleButton>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Letter spacing · {Number(style.letterSpacing).toFixed(1)}<input type="range" min="-1" max="6" step="0.5" value={style.letterSpacing} onChange={(event) => updateStyle(targetKey, { letterSpacing: Number(event.target.value) })} className="mt-3 w-full accent-[#A66331]" /></label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Curve · {Math.round(style.curve)}<input type="range" min="-40" max="40" step="1" value={style.curve} onChange={(event) => updateStyle(targetKey, { curve: Number(event.target.value) })} className="mt-3 w-full accent-[#A66331]" /></label>
          </div>
          {Math.abs(style.curve) >= 1 && <p className="mt-2 text-[9px] font-semibold text-[#80909D]">Curved text is automatically centered for a balanced print.</p>}

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Text colour</p>
              <div className="mt-2 flex items-center gap-2">
                {[{ value: '#111111', label: 'Black' }, { value: '#ffffff', label: 'White' }].map((option) => <button key={option.value} type="button" title={option.label} aria-pressed={style.color === option.value} onClick={() => updateStyle(targetKey, { color: option.value })} className={`h-9 w-9 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,.35)] ${style.color === option.value ? 'ring-2 ring-[#A66331] ring-offset-2' : ''}`} style={{ backgroundColor: option.value }} />)}
                <label className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,.35)]" title="Custom color"><input aria-label="Custom text color" type="color" value={style.color} onChange={(event) => updateStyle(targetKey, { color: event.target.value })} className="absolute -inset-2 h-14 w-14 cursor-pointer border-0 p-0" /></label>
              </div>
              <p className="mt-2 text-[9px] font-semibold uppercase tracking-[.06em] text-[#80909D]">Suggested: {recommendedTextColorName}</p>
            </div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Outline · {Math.round(style.outlineWidth)} px<input type="range" min="0" max="4" step="1" value={style.outlineWidth} onChange={(event) => updateStyle(targetKey, { outlineWidth: Number(event.target.value) })} className="mt-3 w-full accent-[#A66331]" /></label>
            <StyleButton active={style.shadow} onClick={() => updateStyle(targetKey, { shadow: !style.shadow })}>Shadow</StyleButton>
          </div>

          {style.outlineWidth > 0 && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#F7F9FB] px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Outline colour</span><div className="flex gap-2">{['#111111', '#ffffff'].map((value) => <button key={value} type="button" onClick={() => updateStyle(targetKey, { outlineColor: value })} className={`h-7 w-7 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,.35)] ${style.outlineColor === value ? 'ring-2 ring-[#A66331] ring-offset-1' : ''}`} style={{ backgroundColor: value }} aria-label={`Use ${value === '#ffffff' ? 'white' : 'black'} outline`} />)}</div></div>}

          {hasLowContrast(targetKey) && <div role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-[#F2D5BF] bg-[#FFF8F2] px-3 py-2 text-[10px] leading-relaxed text-[#895126]"><AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>This {targetLabel.toLowerCase()} color may have low contrast on the selected garment. Try {recommendedTextColorName.toLowerCase()} or add an outline.</span></div>}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E7ECF0] pt-3">
            <button type="button" onClick={resetStyle} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold text-[#667684] hover:bg-[#F3F6F8]"><RotateCcw size={12} /> Reset {targetLabel.toLowerCase()} style</button>
            <span className="text-[10px] font-semibold text-[#80909D]">Print-safe auto fit stays on</span>
          </div>
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E7ECF0] pt-3">
        <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${hasText ? 'text-[#35744A]' : 'text-[#80909D]'}`}>{hasText ? <><span className="grid h-4 w-4 place-items-center rounded-full bg-[#E9F6ED]"><Check size={10} /></span>Applied to garment preview</> : 'Nothing added yet'}</div>
        {hasText && <button type="button" onClick={clearPersonalization} className="text-[10px] font-bold text-[#8B5B36] underline-offset-2 hover:underline">Clear personalization</button>}
      </div>
    </fieldset>
  );
}
