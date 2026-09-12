import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  Trash2,
} from "lucide-react";
import { maintenanceSettingsApi } from "@/lib/maintenanceSettingsApi";

export default function MaintenanceAccessPasswordControl() {
  const [status, setStatus] = useState({ configured: false, configuredAt: null });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await maintenanceSettingsApi.getAccessStatus();
      setStatus(next);
    } catch (err) {
      setError(err?.message || "Could not load maintenance password status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const savePassword = async () => {
    setError("");
    setNotice("");

    if (password.length < 10) {
      setError("Use at least 10 characters for the maintenance password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }

    setSaving(true);
    try {
      const next = await maintenanceSettingsApi.setAccessPassword(password);
      setStatus(next);
      setPassword("");
      setConfirmPassword("");
      setNotice(status.configured ? "Maintenance password updated." : "Maintenance password enabled.");
    } catch (err) {
      setError(err?.message || "Could not save the maintenance password.");
    } finally {
      setSaving(false);
    }
  };

  const clearPassword = async () => {
    const confirmed = window.confirm(
      "Remove the maintenance access password?\n\nVisitors will no longer have a password option to enter the store while maintenance mode is on."
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const next = await maintenanceSettingsApi.clearAccessPassword();
      setStatus(next);
      setPassword("");
      setConfirmPassword("");
      setNotice("Maintenance password removed.");
    } catch (err) {
      setError(err?.message || "Could not remove the maintenance password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#dedfe3] bg-[#f8f9fa] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#111] text-white">
            <KeyRound size={17} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">Maintenance access password</div>
              {!loading && (
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    status.configured
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-[#e7e8eb] text-[#666]"
                  }`}
                >
                  {status.configured ? "Protected" : "Not set"}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#666]">
              Optional private access for approved visitors while Maintenance Mode is on. The password is hashed server-side and is never stored in public site settings.
            </p>
          </div>
        </div>

        {status.configured && (
          <button
            type="button"
            onClick={clearPassword}
            disabled={saving}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={13} /> Remove password
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-[#777]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#ddd] border-t-[#333]" />
          Checking password status…
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-[#555]">
              {status.configured ? "New password" : "Access password"}
            </span>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                maxLength={128}
                placeholder="Minimum 10 characters"
                className="h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 pr-10 text-sm outline-none transition focus:border-[#aaa] focus:ring-2 focus:ring-black/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#777] hover:bg-[#f0f0f0] hover:text-[#222]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-[#555]">Confirm password</span>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              maxLength={128}
              placeholder="Re-enter password"
              className="mt-1 h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none transition focus:border-[#aaa] focus:ring-2 focus:ring-black/10"
            />
          </label>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {notice && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {notice}
        </div>
      )}

      {!loading && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-4 text-[#777]">
            Changing the password invalidates previously opened maintenance-access sessions after their next status refresh.
          </p>
          <button
            type="button"
            onClick={savePassword}
            disabled={saving || !password || !confirmPassword}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#222] px-3.5 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={13} /> {saving ? "Saving…" : status.configured ? "Update password" : "Set password"}
          </button>
        </div>
      )}
    </div>
  );
}
