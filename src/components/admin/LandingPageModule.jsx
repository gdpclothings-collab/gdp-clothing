import React, { useEffect, useState } from "react";
import { ExternalLink, Image as ImageIcon, RefreshCw, Save, Upload } from "lucide-react";
import { adminLandingPageApi } from "@/lib/adminLandingPageApi";
import { DEFAULT_LANDING_PAGE } from "@/lib/landingPageDefaults";

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textAreaClass = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function MediaField({ label, value, onChange }) {
  const [uploading, setUploading] = useState(false);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      onChange(await adminLandingPageApi.uploadMedia(file));
    } catch (error) {
      window.alert(error?.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="text-xs font-medium text-[#555]">{label}</div>
      <div className="mt-1 grid gap-3 sm:grid-cols-[120px_1fr]">
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-[#dedede] bg-[#f4f4f4]">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[#aaa]"><ImageIcon size={20} /></div>}
        </div>
        <div className="space-y-2">
          <input value={value || ""} onChange={(event) => onChange(event.target.value)} className={inputClass} placeholder="/images/... or https://..." />
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[#222] px-3 text-xs font-medium text-white">
            <Upload size={14} /> {uploading ? "Uploading..." : "Upload / replace"}
            <input type="file" accept="image/*" onChange={upload} disabled={uploading} className="sr-only" />
          </label>
        </div>
      </div>
    </div>
  );
}

export default function LandingPageModule() {
  const [form, setForm] = useState(DEFAULT_LANDING_PAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setForm(await adminLandingPageApi.load());
    } catch (error) {
      window.alert(error?.message || "Could not load landing page settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      setForm(await adminLandingPageApi.save(form));
      setNotice("Landing page saved.");
      window.setTimeout(() => setNotice(""), 2400);
    } catch (error) {
      window.alert(error?.message || "Could not save landing page.");
    } finally {
      setSaving(false);
    }
  };

  const setHero = (patch) => setForm((current) => ({ ...current, hero: { ...current.hero, ...patch } }));
  const setTrust = (index, patch) => setForm((current) => ({ ...current, trustBar: current.trustBar.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const setBest = (patch) => setForm((current) => ({ ...current, bestSellers: { ...current.bestSellers, ...patch } }));
  const setCategory = (index, patch) => setForm((current) => ({ ...current, categories: current.categories.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const setPromo = (index, patch) => setForm((current) => ({ ...current, promos: current.promos.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));

  if (loading) return <div className="mx-auto max-w-[1450px] px-4 pb-12 text-sm text-[#777] md:px-6 lg:px-8">Loading landing page...</div>;

  return (
    <div className="mx-auto max-w-[1450px] space-y-5 px-4 pb-12 md:px-6 lg:px-8">
      {notice && <div className="fixed right-4 top-20 z-[80] rounded-lg bg-[#202020] px-4 py-3 text-sm text-white shadow-xl">{notice}</div>}

      <div className="flex flex-col gap-3 rounded-xl border border-[#dedede] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold">GDP storefront landing page</div>
          <div className="mt-1 text-xs text-[#777]">Edit hero, category cards, best-seller copy and promotional tiles without changing source code.</div>
        </div>
        <div className="flex gap-2">
          <a href="/" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d5d5d5] bg-white px-3 text-xs font-medium">
            Preview <ExternalLink size={13} />
          </a>
          <button onClick={load} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d5d5d5] bg-white px-3 text-xs font-medium">
            <RefreshCw size={13} /> Reload
          </button>
          <button onClick={save} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#222] px-3 text-xs font-medium text-white disabled:opacity-50">
            <Save size={13} /> {saving ? "Saving..." : "Save landing page"}
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white p-4">
        <div className="mb-4">
          <div className="font-semibold">Hero banner</div>
          <div className="text-xs text-[#777]">Main image and first-message content shown above the fold.</div>
        </div>
        <div className="space-y-4">
          <MediaField label="Hero image" value={form.hero.imageUrl} onChange={(imageUrl) => setHero({ imageUrl })} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Brand line"><input value={form.hero.brandLine || ""} onChange={(e) => setHero({ brandLine: e.target.value })} className={inputClass} /></Field>
            <Field label="Headline"><input value={form.hero.headline || ""} onChange={(e) => setHero({ headline: e.target.value })} className={inputClass} /></Field>
            <Field label="Subheadline"><input value={form.hero.subheadline || ""} onChange={(e) => setHero({ subheadline: e.target.value })} className={inputClass} /></Field>
            <Field label="Side copy"><input value={form.hero.sideCopy || ""} onChange={(e) => setHero({ sideCopy: e.target.value })} className={inputClass} /></Field>
            <Field label="Button label"><input value={form.hero.ctaLabel || ""} onChange={(e) => setHero({ ctaLabel: e.target.value })} className={inputClass} /></Field>
            <Field label="Button URL"><input value={form.hero.ctaUrl || ""} onChange={(e) => setHero({ ctaUrl: e.target.value })} className={inputClass} /></Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#dedede] bg-white p-4">
        <div className="mb-4">
          <div className="font-semibold">Trust bar</div>
          <div className="text-xs text-[#777]">Four reassurance messages shown directly under the hero.</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {form.trustBar.map((item, index) => (
            <div key={index} className="space-y-2 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
              <Field label="Title"><input value={item.title || ""} onChange={(e) => setTrust(index, { title: e.target.value })} className={inputClass} /></Field>
              <Field label="Text"><input value={item.text || ""} onChange={(e) => setTrust(index, { text: e.target.value })} className={inputClass} /></Field>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#dedede] bg-white p-4">
        <div className="mb-4">
          <div className="font-semibold">Shop category cards</div>
          <div className="text-xs text-[#777]">Four image cards immediately below the trust bar.</div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {form.categories.map((item, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
              <MediaField label={`Card ${index + 1} image`} value={item.imageUrl} onChange={(imageUrl) => setCategory(index, { imageUrl })} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Title"><input value={item.title || ""} onChange={(e) => setCategory(index, { title: e.target.value })} className={inputClass} /></Field>
                <Field label="Subtitle"><input value={item.subtitle || ""} onChange={(e) => setCategory(index, { subtitle: e.target.value })} className={inputClass} /></Field>
              </div>
              <Field label="URL"><input value={item.url || ""} onChange={(e) => setCategory(index, { url: e.target.value })} className={inputClass} /></Field>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#dedede] bg-white p-4">
        <div className="mb-4">
          <div className="font-semibold">Best sellers section</div>
          <div className="text-xs text-[#777]">Products are automatically pulled from active catalog items marked Best Seller.</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Title"><input value={form.bestSellers.title || ""} onChange={(e) => setBest({ title: e.target.value })} className={inputClass} /></Field>
          <Field label="Subtitle"><input value={form.bestSellers.subtitle || ""} onChange={(e) => setBest({ subtitle: e.target.value })} className={inputClass} /></Field>
          <Field label="CTA label"><input value={form.bestSellers.ctaLabel || ""} onChange={(e) => setBest({ ctaLabel: e.target.value })} className={inputClass} /></Field>
          <Field label="CTA URL"><input value={form.bestSellers.ctaUrl || ""} onChange={(e) => setBest({ ctaUrl: e.target.value })} className={inputClass} /></Field>
          <Field label="Product limit"><input type="number" min="1" max="8" value={form.bestSellers.limit || 5} onChange={(e) => setBest({ limit: Math.max(1, Math.min(8, Number(e.target.value || 5))) })} className={inputClass} /></Field>
        </div>
      </section>

      <section className="rounded-xl border border-[#dedede] bg-white p-4">
        <div className="mb-4">
          <div className="font-semibold">Bottom promotional panels</div>
          <div className="text-xs text-[#777]">Three visual CTAs that close the homepage before the footer.</div>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {form.promos.map((item, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
              <MediaField label={`Promo ${index + 1} image`} value={item.imageUrl} onChange={(imageUrl) => setPromo(index, { imageUrl })} />
              <Field label="Title"><input value={item.title || ""} onChange={(e) => setPromo(index, { title: e.target.value })} className={inputClass} /></Field>
              <Field label="Subtitle"><textarea value={item.subtitle || ""} onChange={(e) => setPromo(index, { subtitle: e.target.value })} className={textAreaClass} rows={2} /></Field>
              <Field label="Button label"><input value={item.buttonLabel || ""} onChange={(e) => setPromo(index, { buttonLabel: e.target.value })} className={inputClass} /></Field>
              <Field label="URL"><input value={item.url || ""} onChange={(e) => setPromo(index, { url: e.target.value })} className={inputClass} /></Field>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
