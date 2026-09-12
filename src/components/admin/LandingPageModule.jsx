import { requestConfirmation, requestNotification } from "@/lib/NotificationContext";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  History,
  Image as ImageIcon,
  RefreshCw,
  Rocket,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { adminLandingPageApi } from "@/lib/adminLandingPageApi";
import { DEFAULT_LANDING_PAGE } from "@/lib/landingPageDefaults";
import { useUnsavedChangesGuard } from "@/lib/UnsavedChangesContext";

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textAreaClass = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";

const SECTION_LABELS = {
  trustBar: "Trust bar",
  categories: "Shop category cards",
  customStudio: "Custom Studio feature",
  bestSellers: "Best sellers",
  dtfSpotlight: "DTF printing spotlight",
  occasions: "Shop by occasion",
  howItWorks: "How custom orders work",
  reviews: "Customer reviews",
  promos: "Promotional panels",
  localFulfillment: "Local pickup & shipping",
  faq: "Homepage FAQ",
  finalCta: "Final call to action",
};

function formatDate(value) {
  if (!value) return "Not published yet";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function Field({ label, hint = "", children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      {hint && <span className="ml-2 text-[10px] text-[#999]">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-black"
      />
      {label}
    </label>
  );
}

function MediaField({
  label,
  value,
  onChange,
  folder,
  recommendation,
  contain = false,
}) {
  const [uploading, setUploading] = useState(false);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      onChange(await adminLandingPageApi.uploadMedia(file, folder));
    } catch (error) {
      requestNotification(error?.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="text-xs font-medium text-[#555]">{label}</div>
      {recommendation && <div className="mt-0.5 text-[10px] text-[#999]">{recommendation}</div>}
      <div className="mt-2 grid gap-3 sm:grid-cols-[140px_1fr]">
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-[#dedede] bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
          {value ? (
            <img
              src={value}
              alt=""
              className={"h-full w-full " + (contain ? "object-contain p-2" : "object-cover")}
            />
          ) : (
            <div className="grid h-full place-items-center bg-white/75 text-[#aaa]">
              <ImageIcon size={20} />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <input
            value={value || ""}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
            placeholder="/images/... or https://..."
          />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[#222] px-3 text-xs font-medium text-white">
              <Upload size={14} /> {uploading ? "Uploading..." : "Upload / replace"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                onChange={upload}
                disabled={uploading}
                className="sr-only"
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="h-9 rounded-lg border border-[#d5d5d5] bg-white px-3 text-xs font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-[10px] text-[#999]">PNG, JPG, WebP, GIF or AVIF · maximum 12 MB</div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="mb-4">
        <div className="font-semibold">{title}</div>
        {description && <div className="mt-0.5 text-xs text-[#777]">{description}</div>}
      </div>
      {children}
    </section>
  );
}

export default function LandingPageModule() {
  const [form, setForm] = useState(DEFAULT_LANDING_PAGE);
  const [savedDraft, setSavedDraft] = useState(DEFAULT_LANDING_PAGE);
  const [published, setPublished] = useState(DEFAULT_LANDING_PAGE);
  const [meta, setMeta] = useState({
    version: 1,
    publishedAt: null,
    draftUpdatedAt: null,
  });
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState("");

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [state, historyItems] = await Promise.all([
        adminLandingPageApi.load(),
        adminLandingPageApi.history(),
      ]);
      setForm(state.draft);
      setSavedDraft(state.draft);
      setPublished(state.published);
      setMeta({
        version: state.version,
        publishedAt: state.publishedAt,
        draftUpdatedAt: state.draftUpdatedAt,
      });
      setVersions(historyItems);
    } catch (error) {
      requestNotification(error?.message || "Could not load landing page settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedDraft),
    [form, savedDraft]
  );

  const hasUnpublishedChanges = useMemo(
    () => JSON.stringify(savedDraft) !== JSON.stringify(published) || hasUnsavedChanges,
    [savedDraft, published, hasUnsavedChanges]
  );

  const saveDraft = async () => {
    setSaving(true);
    try {
      const result = await adminLandingPageApi.saveDraft(form);
      setForm(result.draft);
      setSavedDraft(result.draft);
      setMeta((current) => ({ ...current, draftUpdatedAt: result.updatedAt }));
      showNotice("Draft saved. Live storefront was not changed.");
      return true;
    } catch (error) {
      requestNotification(error?.message || "Could not save landing page draft.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const { requestAction: requestLandingAction } = useUnsavedChangesGuard({
    isDirty: hasUnsavedChanges,
    onSave: saveDraft,
    label: "Landing page draft",
  });

  const publish = async () => {
    if (!await requestConfirmation("Publish this landing page now? This will replace the customer-facing homepage content.")) return;
    setPublishing(true);
    try {
      const state = await adminLandingPageApi.publish(form);
      setForm(state.draft);
      setSavedDraft(state.draft);
      setPublished(state.published);
      setMeta({
        version: state.version,
        publishedAt: state.publishedAt,
        draftUpdatedAt: state.draftUpdatedAt,
      });
      setVersions(await adminLandingPageApi.history());
      showNotice("Landing page published successfully.");
    } catch (error) {
      requestNotification(error?.message || "Could not publish the landing page.");
    } finally {
      setPublishing(false);
    }
  };

  const previewDraft = () => {
    if (hasUnsavedChanges) {
      showNotice("Save the draft first so preview shows your latest changes.");
      return;
    }
    window.open("/?cmsPreview=draft", "_blank", "noopener,noreferrer");
  };

  const restoreVersion = async (version) => {
    if (!await requestConfirmation("Restore version " + version + " into the draft? The live storefront will stay unchanged until you publish.")) return;
    try {
      const result = await adminLandingPageApi.restoreVersionToDraft(version);
      setForm(result.draft);
      setSavedDraft(result.draft);
      setMeta((current) => ({ ...current, draftUpdatedAt: result.updatedAt }));
      showNotice("Version " + version + " restored to draft.");
    } catch (error) {
      requestNotification(error?.message || "Could not restore that version.");
    }
  };

  const restoreDefaults = async () => {
    if (!await requestConfirmation("Load the built-in GDP defaults into the editor? This will not affect the live site until you save and publish.")) return;
    setForm(DEFAULT_LANDING_PAGE);
    showNotice("Defaults loaded into the editor. Review before saving.");
  };

  const setBranding = (patch) => setForm((current) => ({
    ...current,
    branding: { ...current.branding, ...patch },
  }));
  const setAnnouncement = (patch) => setForm((current) => ({
    ...current,
    announcement: { ...current.announcement, ...patch },
  }));
  const setHero = (patch) => setForm((current) => ({
    ...current,
    hero: { ...current.hero, ...patch },
  }));
  const setFeature = (key, patch) => setForm((current) => ({
    ...current,
    [key]: { ...current[key], ...patch },
  }));
  const setTrust = (index, patch) => setForm((current) => ({
    ...current,
    trustBar: current.trustBar.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));
  const setBest = (patch) => setForm((current) => ({
    ...current,
    bestSellers: { ...current.bestSellers, ...patch },
  }));
  const setCategory = (index, patch) => setForm((current) => ({
    ...current,
    categories: current.categories.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));
  const setPromo = (index, patch) => setForm((current) => ({
    ...current,
    promos: current.promos.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));
  const setFooter = (patch) => setForm((current) => ({
    ...current,
    footer: { ...current.footer, ...patch },
  }));
  const setSeo = (patch) => setForm((current) => ({
    ...current,
    seo: { ...current.seo, ...patch },
  }));
  const setSectionVisible = (key, visible) => setForm((current) => ({
    ...current,
    layout: {
      ...current.layout,
      visibility: { ...current.layout.visibility, [key]: visible },
    },
  }));

  const moveSection = (key, direction) => setForm((current) => {
    const order = [...current.layout.sectionOrder];
    const index = order.indexOf(key);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return current;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    return {
      ...current,
      layout: { ...current.layout, sectionOrder: order },
    };
  });

  if (loading) {
    return <div className="mx-auto max-w-[1450px] px-4 pb-12 text-sm text-[#777] md:px-6 lg:px-8">Loading landing page CMS...</div>;
  }

  return (
    <div className="mx-auto max-w-[1450px] space-y-5 px-4 pb-12 md:px-6 lg:px-8">
      {notice && (
        <div className="fixed right-4 top-20 z-[80] max-w-sm rounded-lg bg-[#202020] px-4 py-3 text-sm text-white shadow-xl">
          {notice}
        </div>
      )}

      <div className="rounded-xl border border-[#dedede] bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-semibold">GDP storefront landing page CMS</div>
              <span className="rounded-full bg-[#efefef] px-2 py-1 text-[10px] font-semibold">Published v{meta.version}</span>
              {hasUnpublishedChanges && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800">
                  Unpublished changes
                </span>
              )}
              {hasUnsavedChanges && (
                <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-800">
                  Unsaved editor changes
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-[#777]">
              Published {formatDate(meta.publishedAt)} · Draft updated {formatDate(meta.draftUpdatedAt)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={previewDraft} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d5d5d5] bg-white px-3 text-xs font-medium">
              <Eye size={13} /> Preview draft
            </button>
            <a href="/" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d5d5d5] bg-white px-3 text-xs font-medium">
              Live site <ExternalLink size={13} />
            </a>
            <button onClick={() => requestLandingAction(load, { title: "Reload with unsaved changes?" })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d5d5d5] bg-white px-3 text-xs font-medium">
              <RefreshCw size={13} /> Reload
            </button>
            <button onClick={restoreDefaults} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d5d5d5] bg-white px-3 text-xs font-medium">
              <RotateCcw size={13} /> Defaults
            </button>
            <button onClick={saveDraft} disabled={saving || !hasUnsavedChanges} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#343434] px-3 text-xs font-medium text-white disabled:opacity-50">
              <Save size={13} /> {saving ? "Saving..." : "Save draft"}
            </button>
            <button onClick={publish} disabled={publishing} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#111] px-3 text-xs font-medium text-white disabled:opacity-50">
              <Rocket size={13} /> {publishing ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      </div>

      <SectionCard
        title="Brand & site media"
        description="These assets are now managed from the backend. Bundled GDP images remain as fallbacks if a managed image is missing or fails to load."
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <MediaField
            label="Primary brand logo"
            value={form.branding.logoUrl}
            onChange={(logoUrl) => setBranding({ logoUrl })}
            folder="branding"
            recommendation="Transparent PNG/WebP recommended · approximately 4:3"
            contain
          />
          <MediaField
            label="Mobile logo"
            value={form.branding.mobileLogoUrl}
            onChange={(mobileLogoUrl) => setBranding({ mobileLogoUrl })}
            folder="branding"
            recommendation="Compact transparent logo for small screens"
            contain
          />
          <MediaField
            label="Footer logo"
            value={form.branding.footerLogoUrl}
            onChange={(footerLogoUrl) => setBranding({ footerLogoUrl })}
            folder="branding"
            recommendation="Transparent logo with strong contrast on black"
            contain
          />
          <MediaField
            label="Browser favicon"
            value={form.branding.faviconUrl}
            onChange={(faviconUrl) => setBranding({ faviconUrl })}
            folder="branding"
            recommendation="Square PNG/WebP recommended · 512×512"
            contain
          />
          <MediaField
            label="Social sharing image"
            value={form.branding.socialShareImageUrl}
            onChange={(socialShareImageUrl) => setBranding({ socialShareImageUrl })}
            folder="seo"
            recommendation="1200×630 recommended for social previews"
          />
          <Field label="Logo alt text">
            <input
              value={form.branding.logoAlt || ""}
              onChange={(event) => setBranding({ logoAlt: event.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Announcement bar"
        description="Optional store-wide message shown above the navigation."
      >
        <div className="mb-3">
          <Toggle
            checked={form.announcement.enabled}
            onChange={(enabled) => setAnnouncement({ enabled })}
            label="Show announcement bar"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Message">
            <input value={form.announcement.text || ""} onChange={(event) => setAnnouncement({ text: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Link label">
            <input value={form.announcement.linkLabel || ""} onChange={(event) => setAnnouncement({ linkLabel: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Link URL">
            <input value={form.announcement.url || ""} onChange={(event) => setAnnouncement({ url: event.target.value })} className={inputClass} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Hero banner"
        description="Main visual and first-message content shown above the fold."
      >
        <div className="mb-4">
          <Toggle checked={form.hero.enabled !== false} onChange={(enabled) => setHero({ enabled })} label="Show hero section" />
        </div>
        <div className="space-y-4">
          <MediaField
            label="Hero image"
            value={form.hero.imageUrl}
            onChange={(imageUrl) => setHero({ imageUrl })}
            folder="home"
            recommendation="Wide cinematic image recommended · 16:10 or wider"
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Brand line"><input value={form.hero.brandLine || ""} onChange={(event) => setHero({ brandLine: event.target.value })} className={inputClass} /></Field>
            <Field label="Headline"><input value={form.hero.headline || ""} onChange={(event) => setHero({ headline: event.target.value })} className={inputClass} /></Field>
            <Field label="Subheadline"><input value={form.hero.subheadline || ""} onChange={(event) => setHero({ subheadline: event.target.value })} className={inputClass} /></Field>
            <Field label="Side copy"><input value={form.hero.sideCopy || ""} onChange={(event) => setHero({ sideCopy: event.target.value })} className={inputClass} /></Field>
            <Field label="Button label"><input value={form.hero.ctaLabel || ""} onChange={(event) => setHero({ ctaLabel: event.target.value })} className={inputClass} /></Field>
            <Field label="Button URL"><input value={form.hero.ctaUrl || ""} onChange={(event) => setHero({ ctaUrl: event.target.value })} className={inputClass} /></Field>
            <Field label="Secondary button"><input value={form.hero.secondaryCtaLabel || ""} onChange={(event) => setHero({ secondaryCtaLabel: event.target.value })} className={inputClass} /></Field>
            <Field label="Secondary URL"><input value={form.hero.secondaryCtaUrl || ""} onChange={(event) => setHero({ secondaryCtaUrl: event.target.value })} className={inputClass} /></Field>
            <Field label="DTF link label"><input value={form.hero.tertiaryCtaLabel || ""} onChange={(event) => setHero({ tertiaryCtaLabel: event.target.value })} className={inputClass} /></Field>
            <Field label="DTF link URL"><input value={form.hero.tertiaryCtaUrl || ""} onChange={(event) => setHero({ tertiaryCtaUrl: event.target.value })} className={inputClass} /></Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Homepage feature content"
        description="Edit the main conversion sections added to the GDP landing page. Visibility and position are controlled separately below."
      >
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
            <div className="text-sm font-semibold">Custom Studio feature</div>
            <MediaField
              label="Feature image"
              value={form.customStudio.imageUrl || ""}
              onChange={(imageUrl) => setFeature("customStudio", { imageUrl })}
              folder="home/custom-studio"
              recommendation="Use a finished custom garment or photo-to-garment example"
            />
            <Field label="Eyebrow"><input value={form.customStudio.eyebrow || ""} onChange={(event) => setFeature("customStudio", { eyebrow: event.target.value })} className={inputClass} /></Field>
            <Field label="Title"><input value={form.customStudio.title || ""} onChange={(event) => setFeature("customStudio", { title: event.target.value })} className={inputClass} /></Field>
            <Field label="Description"><textarea value={form.customStudio.subtitle || ""} onChange={(event) => setFeature("customStudio", { subtitle: event.target.value })} className={textAreaClass} rows={3} /></Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Primary button"><input value={form.customStudio.ctaLabel || ""} onChange={(event) => setFeature("customStudio", { ctaLabel: event.target.value })} className={inputClass} /></Field>
              <Field label="Primary URL"><input value={form.customStudio.ctaUrl || ""} onChange={(event) => setFeature("customStudio", { ctaUrl: event.target.value })} className={inputClass} /></Field>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
            <div className="text-sm font-semibold">DTF printing spotlight</div>
            <MediaField
              label="DTF image"
              value={form.dtfSpotlight.imageUrl || ""}
              onChange={(imageUrl) => setFeature("dtfSpotlight", { imageUrl })}
              folder="home/dtf"
              recommendation="Gang sheet or transfer-film image"
              contain
            />
            <Field label="Eyebrow"><input value={form.dtfSpotlight.eyebrow || ""} onChange={(event) => setFeature("dtfSpotlight", { eyebrow: event.target.value })} className={inputClass} /></Field>
            <Field label="Title"><input value={form.dtfSpotlight.title || ""} onChange={(event) => setFeature("dtfSpotlight", { title: event.target.value })} className={inputClass} /></Field>
            <Field label="Description"><textarea value={form.dtfSpotlight.subtitle || ""} onChange={(event) => setFeature("dtfSpotlight", { subtitle: event.target.value })} className={textAreaClass} rows={3} /></Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Primary button"><input value={form.dtfSpotlight.primaryLabel || ""} onChange={(event) => setFeature("dtfSpotlight", { primaryLabel: event.target.value })} className={inputClass} /></Field>
              <Field label="Primary URL"><input value={form.dtfSpotlight.primaryUrl || ""} onChange={(event) => setFeature("dtfSpotlight", { primaryUrl: event.target.value })} className={inputClass} /></Field>
              <Field label="Builder button"><input value={form.dtfSpotlight.secondaryLabel || ""} onChange={(event) => setFeature("dtfSpotlight", { secondaryLabel: event.target.value })} className={inputClass} /></Field>
              <Field label="Builder URL"><input value={form.dtfSpotlight.secondaryUrl || ""} onChange={(event) => setFeature("dtfSpotlight", { secondaryUrl: event.target.value })} className={inputClass} /></Field>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
            <div className="text-sm font-semibold">Supporting sections</div>
            <Field label="Occasions title"><input value={form.occasions.title || ""} onChange={(event) => setFeature("occasions", { title: event.target.value })} className={inputClass} /></Field>
            <Field label="Occasions description"><textarea value={form.occasions.subtitle || ""} onChange={(event) => setFeature("occasions", { subtitle: event.target.value })} className={textAreaClass} rows={2} /></Field>
            <Field label="How it works title"><input value={form.howItWorks.title || ""} onChange={(event) => setFeature("howItWorks", { title: event.target.value })} className={inputClass} /></Field>
            <Field label="Reviews title"><input value={form.reviews.title || ""} onChange={(event) => setFeature("reviews", { title: event.target.value })} className={inputClass} /></Field>
            <Field label="Review limit"><input type="number" min="1" max="12" value={form.reviews.limit || 6} onChange={(event) => setFeature("reviews", { limit: Math.max(1, Math.min(12, Number(event.target.value || 6))) })} className={inputClass} /></Field>
            <Field label="FAQ title"><input value={form.faq.title || ""} onChange={(event) => setFeature("faq", { title: event.target.value })} className={inputClass} /></Field>
          </div>

          <div className="space-y-3 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
            <div className="text-sm font-semibold">Local fulfillment & final CTA</div>
            <Field label="Local section title"><input value={form.localFulfillment.title || ""} onChange={(event) => setFeature("localFulfillment", { title: event.target.value })} className={inputClass} /></Field>
            <Field label="Local section description"><textarea value={form.localFulfillment.subtitle || ""} onChange={(event) => setFeature("localFulfillment", { subtitle: event.target.value })} className={textAreaClass} rows={3} /></Field>
            <Field label="Final CTA title"><input value={form.finalCta.title || ""} onChange={(event) => setFeature("finalCta", { title: event.target.value })} className={inputClass} /></Field>
            <Field label="Final CTA description"><textarea value={form.finalCta.subtitle || ""} onChange={(event) => setFeature("finalCta", { subtitle: event.target.value })} className={textAreaClass} rows={2} /></Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Primary button"><input value={form.finalCta.primaryLabel || ""} onChange={(event) => setFeature("finalCta", { primaryLabel: event.target.value })} className={inputClass} /></Field>
              <Field label="Primary URL"><input value={form.finalCta.primaryUrl || ""} onChange={(event) => setFeature("finalCta", { primaryUrl: event.target.value })} className={inputClass} /></Field>
              <Field label="Secondary button"><input value={form.finalCta.secondaryLabel || ""} onChange={(event) => setFeature("finalCta", { secondaryLabel: event.target.value })} className={inputClass} /></Field>
              <Field label="Secondary URL"><input value={form.finalCta.secondaryUrl || ""} onChange={(event) => setFeature("finalCta", { secondaryUrl: event.target.value })} className={inputClass} /></Field>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Landing-page section order"
        description="Turn homepage sections on or off and control their order without changing frontend code."
      >
        <div className="space-y-2">
          {form.layout.sectionOrder.map((key, index) => (
            <div key={key} className="flex flex-col gap-3 rounded-lg border border-[#e3e3e3] bg-[#fafafa] p-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="text-sm font-semibold">{SECTION_LABELS[key] || key}</div>
                <div className="text-[10px] text-[#999]">Position {index + 1} of {form.layout.sectionOrder.length}</div>
              </div>
              <Toggle
                checked={form.layout.visibility[key] !== false}
                onChange={(visible) => setSectionVisible(key, visible)}
                label="Visible"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveSection(key, -1)}
                  className="grid h-8 w-8 place-items-center rounded-md border border-[#d8d8d8] bg-white disabled:opacity-30"
                  aria-label={"Move " + (SECTION_LABELS[key] || key) + " up"}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  disabled={index === form.layout.sectionOrder.length - 1}
                  onClick={() => moveSection(key, 1)}
                  className="grid h-8 w-8 place-items-center rounded-md border border-[#d8d8d8] bg-white disabled:opacity-30"
                  aria-label={"Move " + (SECTION_LABELS[key] || key) + " down"}
                >
                  <ArrowDown size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Trust bar"
        description="Reassurance messages shown under the hero when the Trust bar section is enabled."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {form.trustBar.map((item, index) => (
            <div key={index} className="space-y-2 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
              <Field label="Title"><input value={item.title || ""} onChange={(event) => setTrust(index, { title: event.target.value })} className={inputClass} /></Field>
              <Field label="Text"><input value={item.text || ""} onChange={(event) => setTrust(index, { text: event.target.value })} className={inputClass} /></Field>
              <Field label="Icon key" hint="truck, shield, shirt, heart"><input value={item.icon || ""} onChange={(event) => setTrust(index, { icon: event.target.value })} className={inputClass} /></Field>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Shop category cards"
        description="Image cards that link customers into catalog and custom-design experiences."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {form.categories.map((item, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
              <MediaField
                label={"Card " + (index + 1) + " image"}
                value={item.imageUrl}
                onChange={(imageUrl) => setCategory(index, { imageUrl })}
                folder="home/categories"
                recommendation="Square or 4:3 product/lifestyle image"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Title"><input value={item.title || ""} onChange={(event) => setCategory(index, { title: event.target.value })} className={inputClass} /></Field>
                <Field label="Subtitle"><input value={item.subtitle || ""} onChange={(event) => setCategory(index, { subtitle: event.target.value })} className={inputClass} /></Field>
              </div>
              <Field label="URL"><input value={item.url || ""} onChange={(event) => setCategory(index, { url: event.target.value })} className={inputClass} /></Field>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Best sellers section"
        description="Product cards remain automatically wired to active catalog products marked Best Seller; this controls the section copy and display limit."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Title"><input value={form.bestSellers.title || ""} onChange={(event) => setBest({ title: event.target.value })} className={inputClass} /></Field>
          <Field label="Subtitle"><input value={form.bestSellers.subtitle || ""} onChange={(event) => setBest({ subtitle: event.target.value })} className={inputClass} /></Field>
          <Field label="CTA label"><input value={form.bestSellers.ctaLabel || ""} onChange={(event) => setBest({ ctaLabel: event.target.value })} className={inputClass} /></Field>
          <Field label="CTA URL"><input value={form.bestSellers.ctaUrl || ""} onChange={(event) => setBest({ ctaUrl: event.target.value })} className={inputClass} /></Field>
          <Field label="Product limit"><input type="number" min="1" max="8" value={form.bestSellers.limit || 5} onChange={(event) => setBest({ limit: Math.max(1, Math.min(8, Number(event.target.value || 5))) })} className={inputClass} /></Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Promotional panels"
        description="Visual calls-to-action that can be reordered as a group through the section-order control."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {form.promos.map((item, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-[#e4e4e4] bg-[#fafafa] p-3">
              <MediaField
                label={"Promo " + (index + 1) + " image"}
                value={item.imageUrl}
                onChange={(imageUrl) => setPromo(index, { imageUrl })}
                folder="home/promos"
                recommendation="Lifestyle or product image with room for overlay text"
              />
              <Field label="Title"><input value={item.title || ""} onChange={(event) => setPromo(index, { title: event.target.value })} className={inputClass} /></Field>
              <Field label="Subtitle"><textarea value={item.subtitle || ""} onChange={(event) => setPromo(index, { subtitle: event.target.value })} className={textAreaClass} rows={2} /></Field>
              <Field label="Button label"><input value={item.buttonLabel || ""} onChange={(event) => setPromo(index, { buttonLabel: event.target.value })} className={inputClass} /></Field>
              <Field label="URL"><input value={item.url || ""} onChange={(event) => setPromo(index, { url: event.target.value })} className={inputClass} /></Field>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Footer content"
        description="Brand wording shown in the customer-facing footer. Social destinations are managed store-wide in Settings."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tagline"><input value={form.footer.tagline || ""} onChange={(event) => setFooter({ tagline: event.target.value })} className={inputClass} /></Field>
          <Field label="Copyright text"><input value={form.footer.copyrightText || ""} onChange={(event) => setFooter({ copyrightText: event.target.value })} className={inputClass} /></Field>
          <Field label="Footer description">
            <textarea value={form.footer.description || ""} onChange={(event) => setFooter({ description: event.target.value })} className={textAreaClass} rows={3} />
          </Field>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            Instagram, Facebook, TikTok, and YouTube are controlled from <Link to="/admin/settings" className="font-semibold underline">Settings → Brand & social</Link>. Empty channels stay hidden everywhere on the storefront.
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="SEO & social sharing"
        description="Homepage browser title, search description, social preview wording and Open Graph image."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Page title"><input value={form.seo.title || ""} onChange={(event) => setSeo({ title: event.target.value })} className={inputClass} /></Field>
          <Field label="Open Graph title"><input value={form.seo.ogTitle || ""} onChange={(event) => setSeo({ ogTitle: event.target.value })} className={inputClass} /></Field>
          <Field label="Meta description"><textarea value={form.seo.description || ""} onChange={(event) => setSeo({ description: event.target.value })} className={textAreaClass} rows={3} /></Field>
          <Field label="Open Graph description"><textarea value={form.seo.ogDescription || ""} onChange={(event) => setSeo({ ogDescription: event.target.value })} className={textAreaClass} rows={3} /></Field>
          <div className="md:col-span-2">
            <MediaField
              label="Open Graph image override"
              value={form.seo.ogImageUrl || ""}
              onChange={(ogImageUrl) => setSeo({ ogImageUrl })}
              folder="seo"
              recommendation="Optional. If blank, the Social sharing image above is used."
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Navigation"
        description="Header navigation is already backend-managed separately so menu changes remain reusable across the whole storefront."
      >
        <div className="flex flex-col gap-3 rounded-lg border border-[#e4e4e4] bg-[#fafafa] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Main menu is wired to Navigation content</div>
            <div className="mt-1 text-xs text-[#777]">Add, rename, reorder or disable storefront menu links from the existing content manager.</div>
          </div>
          <Link to="/admin/content" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d5d5d5] bg-white px-3 text-xs font-medium">
            Manage navigation <ExternalLink size={13} />
          </Link>
        </div>
      </SectionCard>

      <SectionCard
        title="Version history"
        description="Every publish creates an immutable landing-page revision. Restoring a revision only changes the draft until you explicitly publish it."
      >
        {versions.length ? (
          <div className="divide-y divide-[#ececec] rounded-lg border border-[#e1e1e1]">
            {versions.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#f1f1f1]">
                  <History size={15} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Version {item.version}</div>
                  <div className="text-[10px] text-[#888]">{formatDate(item.published_at)}</div>
                </div>
                {Number(item.version) === Number(meta.version) ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">Current live</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => restoreVersion(item.version)}
                    className="inline-flex h-8 items-center gap-2 rounded-md border border-[#d5d5d5] bg-white px-3 text-[11px] font-medium"
                  >
                    <RotateCcw size={12} /> Restore to draft
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#ddd] p-6 text-center text-sm text-[#888]">
            Version history will appear after the first publish.
          </div>
        )}
      </SectionCard>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
        Product cards, checkout, inventory, authentication and Stripe flows are not modified by this CMS. Landing-page content uses managed data with bundled fallbacks, and the live storefront only changes when an admin presses Publish.
      </div>
    </div>
  );
}
