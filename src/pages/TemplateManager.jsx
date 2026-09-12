import { requestConfirmation } from "@/lib/NotificationContext";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Image as ImageIcon,
  LockKeyhole,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import { adminSettingsApi } from "@/lib/adminSettingsApi";
import { useUnsavedChangesGuard } from "@/lib/UnsavedChangesContext";
import {
  GDP_STYLE_TEMPLATES,
  normalizeStyleTemplates,
} from "@/lib/customStudioStyleTemplates";

const CATEGORIES = [
  { id: "memorial_tribute", label: "Memorial Tribute" },
  { id: "photo_bootleg", label: "Photo Bootleg" },
];

function checkerboardStyle() {
  return {
    backgroundColor: "#fff",
    backgroundImage:
      "linear-gradient(45deg,#ececec 25%,transparent 25%),linear-gradient(-45deg,#ececec 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ececec 75%),linear-gradient(-45deg,transparent 75%,#ececec 75%)",
    backgroundSize: "18px 18px",
    backgroundPosition: "0 0,0 9px,9px -9px,-9px 0px",
  };
}

function sameJson(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

function mergeTemplateOverride(settings, styleId, patch) {
  const currentTemplates = settings?.styleTemplates || {};
  const current = currentTemplates[styleId] || {};
  const next = {
    ...current,
    ...patch,
    photoZone: patch.photoZone
      ? { ...(current.photoZone || {}), ...patch.photoZone }
      : current.photoZone,
    defaultTransform: patch.defaultTransform
      ? {
          ...(current.defaultTransform || {}),
          ...patch.defaultTransform,
          offset: patch.defaultTransform.offset
            ? {
                ...(current.defaultTransform?.offset || {}),
                ...patch.defaultTransform.offset,
              }
            : current.defaultTransform?.offset,
        }
      : current.defaultTransform,
  };

  return {
    ...(settings || {}),
    styleTemplates: {
      ...currentTemplates,
      [styleId]: next,
    },
  };
}

export default function TemplateManager() {
  const [category, setCategory] = useState("memorial_tribute");
  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const next = (await adminSettingsApi.loadCustomStudioSettings()) || {};
        if (!alive) return;
        setSettings(next);
        setSavedSettings(next);
      } catch (err) {
        if (!alive) return;
        console.error("Template manager load failed:", err);
        setError(err?.message || "Could not load Custom Studio templates.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const dirty = useMemo(
    () => settings !== null && savedSettings !== null && !sameJson(settings, savedSettings),
    [settings, savedSettings]
  );

  const templates = useMemo(() => {
    if (!settings) return [];
    return normalizeStyleTemplates(settings.styleTemplates || {}).filter(
      (item) => item.category === category
    );
  }, [settings, category]);

  const activeCount = templates.filter((item) => item.enabled !== false).length;

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const save = async () => {
    if (!settings || saving) return false;
    setSaving(true);
    setError("");
    try {
      await adminSettingsApi.saveCustomStudioSettings(settings);
      setSavedSettings(settings);
      flash("Template settings saved.");
      return true;
    } catch (err) {
      console.error("Template manager save failed:", err);
      setError(err?.message || "Could not save template settings.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  useUnsavedChangesGuard({
    isDirty: dirty,
    onSave: save,
    label: "Custom Studio templates",
  });

  const updateTemplate = (styleId, patch) => {
    setSettings((current) => mergeTemplateOverride(current, styleId, patch));
  };

  const restoreDefault = async (styleId) => {
    const base = GDP_STYLE_TEMPLATES.find((item) => item.id === styleId);
    if (!base) return;
    const ok = await requestConfirmation(
      `Restore ${base.name} to the GDP default artwork, wording, order and portrait placement?`
    );
    if (!ok) return;

    setSettings((current) => {
      const nextTemplates = { ...(current?.styleTemplates || {}) };
      delete nextTemplates[styleId];
      return { ...(current || {}), styleTemplates: nextTemplates };
    });
  };

  const uploadArtwork = async (style, file) => {
    if (!file || !style) return;
    setUploadingId(style.id);
    setError("");
    try {
      const url = await adminSettingsApi.uploadStyleTemplateAsset(file, style.id);
      updateTemplate(style.id, {
        assetUrl: url,
        fullAsset: url,
        thumbnail: url,
      });
      flash(`${style.name} artwork uploaded. Save changes to publish it.`);
    } catch (err) {
      console.error("Template artwork upload failed:", err);
      setError(err?.message || "Could not upload template artwork.");
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] grid place-items-center px-4">
        <div className="rounded-2xl border border-[#dedfe3] bg-white px-6 py-5 text-sm text-[#666] shadow-sm">
          Loading Custom Studio templates…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#171717] pb-28">
      {notice && (
        <div className="fixed right-4 top-4 z-[90] inline-flex items-center gap-2 rounded-xl bg-[#171717] px-4 py-3 text-sm text-white shadow-2xl">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-[#dedfe3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1480px] flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <Link
            to="/admin/custom-studio"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d7d8dc] bg-white px-3 text-sm font-semibold hover:bg-[#f6f6f7]"
          >
            <ChevronLeft size={16} /> Custom Studio
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7193f]">
              GDP Commerce Admin
            </div>
            <h1 className="truncate text-xl font-bold">Template Manager</h1>
          </div>
          <a
            href="/custom-studio"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d7d8dc] bg-white px-3 text-sm font-semibold hover:bg-[#f6f6f7]"
          >
            Customer preview <ExternalLink size={14} />
          </a>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={15} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-6 md:px-6">
        <section className="mb-5 rounded-2xl border border-[#dedfe3] bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ImageIcon size={18} />
                <h2 className="text-base font-bold">Protected Custom Studio templates</h2>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#666]">
                Replace artwork and change customer-facing names, descriptions, order and portrait placement without editing source code. GDP template layers remain locked while customer photo, text and sticker layers stay editable.
              </p>
            </div>
            <div className="rounded-xl border border-[#e0e1e4] bg-[#fafafa] px-4 py-3 text-sm">
              <span className="font-bold">{activeCount}</span> of {templates.length} active
            </div>
          </div>

          <div className="mt-5 inline-flex rounded-xl border border-[#d9dade] bg-[#f6f6f7] p-1">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`h-9 rounded-lg px-4 text-sm font-semibold transition ${
                  category === item.id ? "bg-white shadow-sm" : "text-[#666] hover:text-[#222]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {category === "memorial_tribute" && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
              <strong>No Template — Upload Only</strong> stays as the safe blank-canvas choice for customers. The five cards below manage only the protected Memorial Tribute artwork choices.
            </div>
          )}
        </section>

        {error && (
          <div className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          {templates.map((style) => {
            const base = GDP_STYLE_TEMPLATES.find((item) => item.id === style.id) || style;
            const overridden = Boolean(settings?.styleTemplates?.[style.id]);
            const zone = style.photoZone || {};
            const transform = style.defaultTransform || {};

            return (
              <section key={style.id} className="overflow-hidden rounded-2xl border border-[#dedfe3] bg-white shadow-sm">
                <div className="grid gap-4 border-b border-[#e5e6e8] p-4 md:grid-cols-[190px_1fr] md:p-5">
                  <div>
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-[#d8d9dd]" style={checkerboardStyle()}>
                      <img
                        src={style.thumbnail || style.assetUrl}
                        alt={`${style.name} template preview`}
                        className="h-full w-full object-contain p-2"
                        loading="lazy"
                      />
                      <div
                        className="pointer-events-none absolute border-2 border-dashed border-[#d7193f]/75 bg-[#d7193f]/5"
                        style={{
                          left: `${zone.x || 0}%`,
                          top: `${zone.y || 0}%`,
                          width: `${zone.width || 0}%`,
                          height: `${zone.height || 0}%`,
                          borderRadius:
                            zone.shape === "circle" || zone.shape === "oval"
                              ? "9999px"
                              : zone.shape === "rounded"
                                ? "18px"
                                : "2px",
                        }}
                        title="Customer portrait placement zone"
                      />
                    </div>
                    <div className="mt-2 text-center text-[10px] font-medium text-[#777]">
                      Dashed area = portrait zone
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold">{style.name}</h3>
                          <LockKeyhole size={14} className="text-[#777]" />
                        </div>
                        <div className="mt-1 break-all text-[10px] text-[#8a8a8a]">ID: {style.id}</div>
                      </div>
                      <label className="inline-flex items-center gap-2 rounded-lg border border-[#dedfe3] bg-[#fafafa] px-3 py-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={style.enabled !== false}
                          onChange={(event) =>
                            updateTemplate(style.id, {
                              active: event.target.checked,
                              enabled: event.target.checked,
                            })
                          }
                        />
                        {style.enabled !== false ? "Active" : "Hidden"}
                      </label>
                    </div>

                    <p className="mt-3 text-xs leading-5 text-[#666]">{style.description}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <label className="col-span-2 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#171717] px-3 text-xs font-semibold text-white sm:col-span-1">
                        <Upload size={14} /> {uploadingId === style.id ? "Uploading…" : overridden ? "Replace artwork" : "Upload replacement"}
                        <input
                          type="file"
                          accept="image/png,image/webp,image/svg+xml,.svg"
                          className="hidden"
                          disabled={uploadingId !== null}
                          onChange={(event) => {
                            uploadArtwork(style, event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => restoreDefault(style.id)}
                        disabled={!overridden}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#d7d8dc] bg-white px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <RotateCcw size={14} /> Restore GDP default
                      </button>
                    </div>
                    <div className="mt-2 text-[10px] leading-4 text-[#777]">
                      Replacement artwork: transparent PNG, WEBP or SVG. Maximum 18 MB.
                    </div>
                  </div>
                </div>

                <div className="space-y-5 p-4 md:p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Template name">
                      <input
                        value={style.name || ""}
                        onChange={(event) => updateTemplate(style.id, { name: event.target.value })}
                        className="control"
                      />
                    </Field>
                    <Field label="Display order">
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={style.sortOrder ?? 0}
                        onChange={(event) =>
                          updateTemplate(style.id, { sortOrder: Number(event.target.value || 0) })
                        }
                        className="control"
                      />
                    </Field>
                    <Field label="Customer description" className="sm:col-span-2">
                      <textarea
                        rows={3}
                        value={style.description || ""}
                        onChange={(event) => updateTemplate(style.id, { description: event.target.value })}
                        className="control min-h-[82px] py-2.5"
                      />
                    </Field>
                  </div>

                  <div className="rounded-xl border border-[#e0e1e4] bg-[#fafafa] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold">Portrait placement</div>
                        <div className="mt-1 text-[10px] leading-4 text-[#777]">
                          Coordinates are percentages of the protected artwork canvas.
                        </div>
                      </div>
                      <div className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#666] shadow-sm">
                        Live outline preview above
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {[
                        ["x", "Left"],
                        ["y", "Top"],
                        ["width", "Width"],
                        ["height", "Height"],
                      ].map(([key, label]) => (
                        <Field key={key} label={`${label} %`}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={zone[key] ?? 0}
                            onChange={(event) =>
                              updateTemplate(style.id, {
                                photoZone: { ...zone, [key]: Number(event.target.value || 0) },
                              })
                            }
                            className="control"
                          />
                        </Field>
                      ))}
                      <Field label="Shape">
                        <select
                          value={zone.shape || "rounded"}
                          onChange={(event) =>
                            updateTemplate(style.id, {
                              photoZone: { ...zone, shape: event.target.value },
                            })
                          }
                          className="control"
                        >
                          <option value="rounded">Rounded</option>
                          <option value="rect">Rectangle</option>
                          <option value="oval">Oval</option>
                          <option value="circle">Circle</option>
                        </select>
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Photo fit">
                        <select
                          value={transform.fitMode || "fit"}
                          onChange={(event) =>
                            updateTemplate(style.id, {
                              defaultTransform: { ...transform, fitMode: event.target.value },
                            })
                          }
                          className="control"
                        >
                          <option value="fit">Fit · no crop</option>
                          <option value="crop">Crop to fill</option>
                        </select>
                      </Field>
                      <Field label="Default zoom %">
                        <input
                          type="number"
                          min="55"
                          max="180"
                          value={transform.scale ?? 100}
                          onChange={(event) =>
                            updateTemplate(style.id, {
                              defaultTransform: {
                                ...transform,
                                scale: Number(event.target.value || 100),
                              },
                            })
                          }
                          className="control"
                        />
                      </Field>
                    </div>
                  </div>

                  <details className="rounded-xl border border-[#e0e1e4] bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-[#555]">
                      Advanced artwork source
                    </summary>
                    <div className="border-t border-[#ececef] p-4">
                      <Field label="Artwork asset URL">
                        <input
                          value={style.assetUrl || ""}
                          onChange={(event) =>
                            updateTemplate(style.id, {
                              assetUrl: event.target.value,
                              fullAsset: event.target.value,
                              thumbnail: event.target.value,
                            })
                          }
                          className="control text-xs"
                        />
                      </Field>
                      <div className="mt-2 text-[10px] leading-4 text-[#777]">
                        Use Replace artwork whenever possible. Direct URLs are provided for controlled migrations and recovery.
                      </div>
                    </div>
                  </details>

                  {overridden && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900">
                      This template has an admin override. Restore GDP default removes the override and returns to <strong>{base.name}</strong>.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d8d9dd] bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="font-bold">Unsaved template changes</span>
              <span className="ml-2 text-[#666]">Review the customer preview after saving.</span>
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#171717] px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Save size={15} /> {saving ? "Saving…" : "Save all changes"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .control {
          margin-top: 0.35rem;
          min-height: 2.5rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #d5d6da;
          background: white;
          padding-left: 0.75rem;
          padding-right: 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .control:focus {
          border-color: #9b9da3;
          box-shadow: 0 0 0 3px rgba(23,23,23,0.08);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block text-[11px] font-semibold text-[#555] ${className}`}>
      {label}
      {children}
    </label>
  );
}
