import React, { useEffect, useState } from "react";
import { Cookie, Settings2, X } from "lucide-react";

const STORAGE_KEY = "gdp_cookie_preferences_v1";

const ESSENTIAL_ONLY = {
  essential: true,
  analytics: false,
  marketing: false,
  savedAt: null,
};

function readStored() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function savePreferences(preferences) {
  const value = { ...preferences, essential: true, savedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Preference still applies for the current page when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent("gdp:cookie-preferences-changed", { detail: value }));
  return value;
}

export function getCookiePreferences() {
  return readStored() || ESSENTIAL_ONLY;
}

export default function CookiePreferences() {
  const [stored, setStored] = useState(() => readStored());
  const [open, setOpen] = useState(() => !readStored());
  const [customize, setCustomize] = useState(false);
  const [draft, setDraft] = useState(() => readStored() || ESSENTIAL_ONLY);

  useEffect(() => {
    const openPreferences = () => {
      const current = readStored() || ESSENTIAL_ONLY;
      setDraft(current);
      setCustomize(true);
      setOpen(true);
    };
    window.addEventListener("gdp:open-cookie-preferences", openPreferences);
    return () => window.removeEventListener("gdp:open-cookie-preferences", openPreferences);
  }, []);

  const apply = (next) => {
    const saved = savePreferences(next);
    setStored(saved);
    setDraft(saved);
    setOpen(false);
    setCustomize(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-2xl rounded-2xl border border-border bg-background p-4 shadow-2xl md:p-5" role="dialog" aria-modal="true" aria-label="Cookie preferences">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary">
          <Cookie size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Your privacy preferences</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Essential storage keeps the cart, sign-in and checkout working. Optional analytics and marketing categories stay off unless you choose them.
              </p>
            </div>
            {stored && (
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Close cookie preferences">
                <X size={17} />
              </button>
            )}
          </div>

          {customize && (
            <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/35 p-3">
              <PreferenceRow label="Essential" description="Authentication, cart, checkout, security and core preferences." checked disabled />
              <PreferenceRow label="Analytics" description="Optional aggregate usage measurement when configured." checked={Boolean(draft.analytics)} onChange={(checked) => setDraft((current) => ({ ...current, analytics: checked }))} />
              <PreferenceRow label="Marketing" description="Optional marketing/advertising technologies when configured." checked={Boolean(draft.marketing)} onChange={(checked) => setDraft((current) => ({ ...current, marketing: checked }))} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => apply(ESSENTIAL_ONLY)} className="h-10 rounded-lg border border-border px-4 text-xs font-bold uppercase tracking-wide hover:border-accent">
              Essential only
            </button>
            {customize ? (
              <button type="button" onClick={() => apply(draft)} className="h-10 rounded-lg bg-accent px-4 text-xs font-bold uppercase tracking-wide text-accent-foreground">
                Save preferences
              </button>
            ) : (
              <>
                <button type="button" onClick={() => setCustomize(true)} className="h-10 rounded-lg border border-border px-4 text-xs font-bold uppercase tracking-wide hover:border-accent inline-flex items-center gap-2">
                  <Settings2 size={14} /> Customize
                </button>
                <button type="button" onClick={() => apply({ essential: true, analytics: true, marketing: true })} className="h-10 rounded-lg bg-accent px-4 text-xs font-bold uppercase tracking-wide text-accent-foreground">
                  Allow optional
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferenceRow({ label, description, checked, onChange = undefined, disabled = false }) {
  return (
    <label className="flex items-start gap-3 rounded-lg bg-background px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
