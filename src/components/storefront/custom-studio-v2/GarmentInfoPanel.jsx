import React, { useMemo, useState } from 'react';
import {
  CircleHelp,
  FileCheck2,
  Info,
  PackageCheck,
  Ruler,
  Shirt,
  ShoppingBag,
  Sparkles,
  WashingMachine,
  X,
} from 'lucide-react';
import { resolveColorSwatch } from '@/lib/colorSwatches';

export const DTF_GARMENT_INFO_DEFAULTS = Object.freeze({
  printMethod: 'DTF',
  aboutDtf: 'Direct-to-Film (DTF) printing transfers full-colour artwork from film onto the garment using heat and adhesive. It produces sharp, vibrant prints and works across cotton, polyester, fleece and many blended fabrics.',
  garmentDisclaimer: 'Garment and print colours may vary slightly from what appears on your screen. Fabric, garment colour, display settings and production can affect the finished appearance. Print placement and dimensions may vary slightly during production.',
  shippingInfo: 'Custom garments are made to order. Production begins after the design is approved. Shipping time starts after production is complete, and the available delivery estimate is shown at checkout.',
  fileGuidelines: [
    '300 DPI is preferred for production artwork; 150 DPI is the minimum quality threshold.',
    'Use artwork at its intended print size and use the sRGB IEC61966-2.1 colour profile.',
    'Transparent PNG is preferred when the design should not have a background.',
    'Keep important text, faces and logos inside the DTF print guide.',
    'Use clean solid edges and keep important line or text strokes at least 1 pt (about 4 px at 300 DPI).',
    'Avoid semi-transparent pixels, opacity fades, soft glows, smoke effects and extremely tiny isolated details.',
  ],
  bestResultTips: [
    'Start with the highest-resolution original artwork available.',
    'Use halftones instead of opacity fades when you want a faded visual effect.',
    'Remove unnecessary solid backgrounds to keep large prints softer and more breathable.',
    'Review the final garment colour, size, print side and artwork placement before approval.',
  ],
  dtfDisclaimer: 'DTF prints sit on the surface of the fabric and can feel slightly firm at first. Large solid designs can feel heavier and less breathable. Minor variation in colour and placement can occur during production.',
  howToOrder: [
    'Choose your garment, colour, size and quantity.',
    'Choose a design path: Seasonal, Photo Bootleg, Memorial or Upload My Own Artwork.',
    'Customize and position your artwork on each print side.',
    'Keep important content inside the DTF print guide and review the final layout.',
    'Approve your design, add it to your bag and complete checkout.',
    'GDP Clothing prepares the approved artwork for DTF production.',
  ],
  careInstructions: [
    'Turn the garment inside out before washing.',
    'Wash cold or lukewarm on a gentle cycle with mild detergent.',
    'Do not bleach or use harsh chemicals.',
    'Hang dry when possible, or tumble dry on low heat.',
    'Do not iron directly over the DTF print.',
    'Avoid high heat and dry cleaning for the best print life.',
  ],
  sizeGuideNote: 'Measurements are garment-specific. When measurements are not listed, compare the available size with a garment you already own or contact GDP Clothing for fit help.',
});

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function parseList(value, fallback) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean);
  const text = cleanText(value);
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((item) => cleanText(item)).filter(Boolean);
  } catch {
    // Admin metafields may be stored as one line per item instead of JSON.
  }
  return text.split(/\r?\n|\s*\|\s*/).map((item) => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
}

function parseSizeGuideRows(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  const text = cleanText(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (Array.isArray(parsed?.rows)) return parsed.rows.filter(Boolean);
  } catch {
    // Fall through to the compact admin-friendly line format below.
  }

  return text.split(/\r?\n/).map((line) => {
    const [size, width, length, sleeve] = line.split('|').map((part) => cleanText(part));
    if (!size) return null;
    return { size, width, length, sleeve };
  }).filter(Boolean);
}

function resolveGarmentInfo(product) {
  const meta = product?.metafields || {};
  return {
    printMethod: cleanText(meta.print_method, DTF_GARMENT_INFO_DEFAULTS.printMethod).toUpperCase(),
    aboutDtf: cleanText(meta.dtf_about, DTF_GARMENT_INFO_DEFAULTS.aboutDtf),
    garmentDisclaimer: cleanText(meta.garment_disclaimer, DTF_GARMENT_INFO_DEFAULTS.garmentDisclaimer),
    shippingInfo: cleanText(meta.shipping_info, DTF_GARMENT_INFO_DEFAULTS.shippingInfo),
    fileGuidelines: parseList(meta.dtf_file_guidelines, DTF_GARMENT_INFO_DEFAULTS.fileGuidelines),
    bestResultTips: parseList(meta.dtf_best_result_tips, DTF_GARMENT_INFO_DEFAULTS.bestResultTips),
    dtfDisclaimer: cleanText(meta.dtf_print_disclaimer, DTF_GARMENT_INFO_DEFAULTS.dtfDisclaimer),
    howToOrder: parseList(meta.how_to_order, DTF_GARMENT_INFO_DEFAULTS.howToOrder),
    careInstructions: parseList(meta.care_instructions, DTF_GARMENT_INFO_DEFAULTS.careInstructions),
    sizeGuideNote: cleanText(meta.size_guide_note, DTF_GARMENT_INFO_DEFAULTS.sizeGuideNote),
    sizeGuideRows: parseSizeGuideRows(meta.size_guide_rows),
  };
}

export function garmentColorSwatch(product, color) {
  return resolveColorSwatch(product?.customization?.preview?.colorSwatches || {}, color);
}

function BulletList({ items }) {
  return (
    <ul className="space-y-2 text-sm font-medium leading-6 text-slate-600">
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailChip({ label, value }) {
  if (!cleanText(value)) return null;
  return <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600"><span className="text-slate-400">{label}</span> · {value}</span>;
}

function PanelButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
      <Icon size={15} /> {label}
    </button>
  );
}

function SizeGuide({ sizes, rows, note }) {
  const normalizedRows = rows.map((row) => ({
    size: cleanText(row?.size || row?.label),
    width: cleanText(row?.width || row?.chest || row?.chestWidth),
    length: cleanText(row?.length || row?.bodyLength),
    sleeve: cleanText(row?.sleeve || row?.sleeveLength),
  })).filter((row) => row.size);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => <span key={size} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">{size}</span>)}
      </div>
      {normalizedRows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-3 font-black">Size</th><th className="px-3 py-3 font-black">Width / chest</th><th className="px-3 py-3 font-black">Body length</th><th className="px-3 py-3 font-black">Sleeve</th></tr></thead>
            <tbody>{normalizedRows.map((row) => <tr key={row.size} className="border-t border-slate-100"><td className="px-3 py-3 font-black text-slate-800">{row.size}</td><td className="px-3 py-3 text-slate-600">{row.width || '—'}</td><td className="px-3 py-3 text-slate-600">{row.length || '—'}</td><td className="px-3 py-3 text-slate-600">{row.sleeve || '—'}</td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
      <p className="text-xs font-medium leading-5 text-slate-500">{note}</p>
      <p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-400">Admin format: one row per line · SIZE | WIDTH | LENGTH | SLEEVE</p>
    </div>
  );
}

function InfoDialog({ title, eyebrow, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[90] grid items-end bg-slate-950/50 p-2 backdrop-blur-[2px] sm:place-items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[88vh] w-full overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:max-w-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{eyebrow}</p><h3 className="mt-1 text-xl font-black text-slate-950">{title}</h3></div>
          <button type="button" onClick={onClose} aria-label="Close garment information" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function GarmentInfoPanel({ product, sizes = [] }) {
  const [activePanel, setActivePanel] = useState('');
  const info = useMemo(() => resolveGarmentInfo(product), [product]);
  const meta = product?.metafields || {};
  const material = cleanText(product?.material || meta.fabric_blend);
  const detailChips = [
    ['Brand', meta.garment_brand],
    ['Model', meta.garment_model],
    ['Fabric', material],
    ['Weight', meta.fabric_weight],
    ['Fit', meta.fit],
  ];

  return (
    <div data-gdp-garment-info="true" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Printing type</p>
          <div className="mt-1 flex items-center gap-2"><span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{info.printMethod}</span><span className="text-xs font-semibold text-slate-500">Direct-to-Film</span></div>
        </div>
        <button type="button" onClick={() => setActivePanel('dtf')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><CircleHelp size={16} /> What is DTF?</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {detailChips.map(([label, value]) => <DetailChip key={label} label={label} value={value} />)}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <PanelButton icon={Shirt} label="Product details" onClick={() => setActivePanel('details')} />
        <PanelButton icon={Ruler} label="Size guide" onClick={() => setActivePanel('size')} />
        <PanelButton icon={FileCheck2} label="File guidelines" onClick={() => setActivePanel('files')} />
        <PanelButton icon={PackageCheck} label="Shipping & care" onClick={() => setActivePanel('shipping')} />
        <PanelButton icon={ShoppingBag} label="How to order" onClick={() => setActivePanel('order')} />
      </div>

      {activePanel === 'dtf' && <InfoDialog title="What is DTF printing?" eyebrow="GDP Clothing · Print method" onClose={() => setActivePanel('')}><p className="text-sm font-medium leading-7 text-slate-600">{info.aboutDtf}</p><div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.1em] text-slate-500"><Sparkles size={15} /> Why GDP uses it</div><p className="mt-2 text-sm font-medium leading-6 text-slate-600">DTF is well suited to detailed, vibrant custom graphics and lets GDP Clothing print across a wide range of garment fabrics.</p></div></InfoDialog>}

      {activePanel === 'details' && <InfoDialog title={product?.name || 'Garment details'} eyebrow="Product details" onClose={() => setActivePanel('')}><p className="text-sm font-medium leading-7 text-slate-600">{product?.description || 'Custom garment prepared for GDP Clothing DTF printing.'}</p><div className="mt-4 flex flex-wrap gap-2">{detailChips.map(([label, value]) => <DetailChip key={label} label={label} value={value} />)}</div><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.1em] text-amber-800"><Info size={15} /> Garment & print disclaimer</div><p className="mt-2 text-sm font-medium leading-6 text-amber-900/80">{info.garmentDisclaimer}</p></div></InfoDialog>}

      {activePanel === 'size' && <InfoDialog title="Size guide" eyebrow={product?.name || 'Garment'} onClose={() => setActivePanel('')}><SizeGuide sizes={sizes} rows={info.sizeGuideRows} note={info.sizeGuideNote} /></InfoDialog>}

      {activePanel === 'files' && <InfoDialog title="DTF file guidelines" eyebrow="Must follow before printing" onClose={() => setActivePanel('')}><div className="rounded-2xl border border-slate-200 p-4"><p className="mb-3 text-xs font-black uppercase tracking-[.1em] text-slate-500">File requirements</p><BulletList items={info.fileGuidelines} /></div><div className="mt-4 rounded-2xl bg-emerald-50 p-4"><p className="mb-3 text-xs font-black uppercase tracking-[.1em] text-emerald-800">Tips for best result</p><BulletList items={info.bestResultTips} /></div><div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase tracking-[.1em] text-amber-800">DTF printing disclaimer</p><p className="mt-2 text-sm font-medium leading-6 text-amber-900/80">{info.dtfDisclaimer}</p></div></InfoDialog>}

      {activePanel === 'shipping' && <InfoDialog title="Shipping & print care" eyebrow="After you order" onClose={() => setActivePanel('')}><div className="rounded-2xl border border-slate-200 p-4"><p className="mb-2 text-xs font-black uppercase tracking-[.1em] text-slate-500">Shipping</p><p className="text-sm font-medium leading-6 text-slate-600">{info.shippingInfo}</p></div><div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[.1em] text-slate-500"><WashingMachine size={15} /> DTF print care</div><BulletList items={info.careInstructions} /></div></InfoDialog>}

      {activePanel === 'order' && <InfoDialog title="How to order" eyebrow="Custom Studio" onClose={() => setActivePanel('')}><ol className="space-y-3">{info.howToOrder.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3 rounded-2xl bg-slate-50 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-black text-white">{index + 1}</span><span className="pt-1 text-sm font-medium leading-6 text-slate-600">{item}</span></li>)}</ol></InfoDialog>}
    </div>
  );
}
