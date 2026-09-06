import React, { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { mergeAboutPageBody } from "@/lib/aboutPageDefaults";
import { adminLandingPageApi } from "@/lib/adminLandingPageApi";

const input = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm";
const area = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm";

function Field({ label, children }) {
  return <label className="block"><span className="text-xs font-medium text-[#555]">{label}</span><div className="mt-1">{children}</div></label>;
}

function Media({ label, value, onChange, folder }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try { onChange(await adminLandingPageApi.uploadMedia(file, folder)); }
    catch (error) { window.alert(error?.message || "Could not upload image."); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input className={input} value={value || ""} onChange={(e) => onChange(e.target.value)} />
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="h-10 px-3 rounded-lg border border-[#d5d5d5] bg-white text-xs inline-flex items-center gap-2">
          <UploadCloud size={14} /> {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      <input ref={ref} type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(e) => upload(e.target.files?.[0])} />
    </Field>
  );
}

export default function AboutPageEditorFields({ body, onChange }) {
  const v = mergeAboutPageBody(body);
  const set = (key, value) => onChange({ ...v, [key]: value });
  const setStat = (i, patch) => onChange({ ...v, stats: v.stats.map((s, n) => n === i ? { ...s, ...patch } : s) });
  const sections = [
    ["memoryTitle","memoryBody","Memories / custom apparel"],
    ["experienceTitle","experienceBody","7+ years / printing experience"],
    ["dreamTitle","dreamBody","Small business story"],
    ["standsTitle","standsBody","What GDP stands for"],
    ["cultureTitle","cultureBody","Culture / brand vision"],
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#dcdcdc] bg-[#fafafa] p-4">
        <div className="text-sm font-semibold">About page visual editor</div>
        <div className="mt-1 text-xs text-[#777]">Edits the live /pages/about content without changing checkout, products, inventory, or homepage settings.</div>
      </div>

      <section className="rounded-xl border border-[#dedede] p-4 space-y-3">
        <div className="font-semibold text-sm">Hero</div>
        <Field label="Eyebrow"><input className={input} value={v.heroEyebrow} onChange={(e) => set("heroEyebrow", e.target.value)} /></Field>
        <Field label="Headline"><input className={input} value={v.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} /></Field>
        <Field label="Subtitle"><input className={input} value={v.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} /></Field>
        <Media label="Hero image" value={v.heroImageUrl} onChange={(x) => set("heroImageUrl", x)} folder="pages/about/hero" />
      </section>

      <section className="rounded-xl border border-[#dedede] p-4 space-y-3">
        <div className="font-semibold text-sm">Founder story</div>
        <Field label="Section label"><input className={input} value={v.founderKicker} onChange={(e) => set("founderKicker", e.target.value)} /></Field>
        <Field label="Headline"><input className={input} value={v.founderTitle} onChange={(e) => set("founderTitle", e.target.value)} /></Field>
        <Field label="Story"><textarea className={area} rows={7} value={v.founderBody} onChange={(e) => set("founderBody", e.target.value)} /></Field>
        <div className="grid md:grid-cols-3 gap-3">
          {v.stats.map((s,i) => <div key={i} className="border border-[#e5e5e5] rounded-lg p-3 space-y-2">
            <input className={input} value={s.value} onChange={(e) => setStat(i,{value:e.target.value})} />
            <input className={input} value={s.label} onChange={(e) => setStat(i,{label:e.target.value})} />
          </div>)}
        </div>
      </section>

      <section className="rounded-xl border border-[#dedede] p-4 space-y-3">
        <div className="font-semibold text-sm">Story sections</div>
        {sections.map(([t,b,label]) => <div key={t} className="border border-[#e5e5e5] rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-[#555]">{label}</div>
          <input className={input} value={v[t]} onChange={(e) => set(t,e.target.value)} />
          <textarea className={area} rows={5} value={v[b]} onChange={(e) => set(b,e.target.value)} />
        </div>)}
        <Media label="Story image" value={v.storyImageUrl} onChange={(x) => set("storyImageUrl", x)} folder="pages/about/story" />
      </section>

      <section className="rounded-xl border border-[#dedede] p-4 space-y-3">
        <div className="font-semibold text-sm">Final call to action</div>
        <Field label="Headline"><input className={input} value={v.ctaTitle} onChange={(e) => set("ctaTitle",e.target.value)} /></Field>
        <Field label="Supporting text"><textarea className={area} rows={3} value={v.ctaBody} onChange={(e) => set("ctaBody",e.target.value)} /></Field>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Primary button"><input className={input} value={v.ctaLabel} onChange={(e) => set("ctaLabel",e.target.value)} /></Field>
          <Field label="Primary URL"><input className={input} value={v.ctaUrl} onChange={(e) => set("ctaUrl",e.target.value)} /></Field>
          <Field label="Secondary button"><input className={input} value={v.secondaryCtaLabel} onChange={(e) => set("secondaryCtaLabel",e.target.value)} /></Field>
          <Field label="Secondary URL"><input className={input} value={v.secondaryCtaUrl} onChange={(e) => set("secondaryCtaUrl",e.target.value)} /></Field>
        </div>
        <Field label="Closing line"><input className={input} value={v.closingLine} onChange={(e) => set("closingLine",e.target.value)} /></Field>
      </section>
    </div>
  );
}
