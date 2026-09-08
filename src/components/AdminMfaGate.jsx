import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { adminMfaSecurityApi } from "@/lib/adminMfaSecurityApi";
import { useAuth } from "@/lib/AuthContext";

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

function reminderKey(userId) {
  return `gdp-admin-mfa-remind-after:${userId || "unknown"}`;
}

function writeReminder(userId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    reminderKey(userId),
    String(Date.now() + REMINDER_INTERVAL_MS)
  );
}

function clearReminder(userId) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(reminderKey(userId));
}

function formatDeadline(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminMfaGate() {
  const { user, logout } = useAuth();
  const [checking, setChecking] = useState(true);
  const [verifiedFactor, setVerifiedFactor] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [grace, setGrace] = useState(null);
  const [graceBypass, setGraceBypass] = useState(false);
  const [mode, setMode] = useState("intro");
  const [aal2, setAal2] = useState(false);
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setChecking(true);
    setError("");
    setEnrollment(null);
    setVerifiedFactor(null);
    setGraceBypass(false);
    setAal2(false);

    try {
      const [aalResult, factorsResult] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

      if (aalResult.error) throw aalResult.error;
      if (factorsResult.error) throw factorsResult.error;

      if (aalResult.data?.currentLevel === "aal2") {
        setAal2(true);
        clearReminder(user?.id);
        adminMfaSecurityApi.recordVerified().catch(() => {});
        return;
      }

      const totpFactors = factorsResult.data?.totp || [];
      const factor =
        totpFactors.find((item) => item.status === "verified") || null;

      if (factor) {
        setVerifiedFactor(factor);
        setMode("verify");
        return;
      }

      let nextGrace = null;
      try {
        nextGrace = await adminMfaSecurityApi.getState();
      } catch {
        setGrace(null);
        setMode("intro");
        setError(
          "The MFA grace-period status could not be loaded. You can still set up your authenticator now."
        );
        return;
      }
      setGrace(nextGrace);
      setMode("intro");

      const expiresAt = nextGrace?.grace_expires_at
        ? new Date(nextGrace.grace_expires_at).getTime()
        : 0;
      const graceIsActive =
        Boolean(nextGrace?.grace_active) &&
        Number.isFinite(expiresAt) &&
        expiresAt > Date.now();

      // During the documented first-time grace period, keep the administrator
      // in their workflow and surface setup as a persistent banner. The full
      // security gate is reserved for verified-factor challenges or an expired
      // grace period, so opening Admin never unexpectedly discards page context.
      if (graceIsActive) {
        setGraceBypass(true);
      }
    } catch (loadError) {
      setError(
        loadError?.message ||
          "Could not initialize admin multi-factor authentication."
      );
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.id, user?.role]);

  const activeFactorId = verifiedFactor?.id || enrollment?.id || "";
  const qrCode = enrollment?.totp?.qr_code || "";
  const secret = enrollment?.totp?.secret || "";

  const graceStatus = useMemo(() => {
    const expiresAt = grace?.grace_expires_at
      ? new Date(grace.grace_expires_at).getTime()
      : 0;
    const remainingMs = Math.max(0, expiresAt - Date.now());
    return {
      active:
        Boolean(grace?.grace_active) &&
        Number.isFinite(expiresAt) &&
        remainingMs > 0,
      daysRemaining: remainingMs
        ? Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
        : 0,
      deadline: formatDeadline(grace?.grace_expires_at),
    };
  }, [grace]);

  const startEnrollment = async () => {
    setWorking(true);
    setError("");
    setCode("");

    try {
      await adminMfaSecurityApi.clearUnverifiedTotp();

      const enrollResult = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "GDP Clothing Admin",
      });
      if (enrollResult.error) throw enrollResult.error;

      setEnrollment(enrollResult.data);
      setVerifiedFactor(null);
      setMode("enroll");
      setGraceBypass(false);
      clearReminder(user?.id);
    } catch (enrollError) {
      setError(
        enrollError?.message || "Could not start authenticator enrollment."
      );
    } finally {
      setWorking(false);
    }
  };

  const skipForNow = () => {
    if (!graceStatus.active) {
      setError(
        "The 7-day MFA setup grace period has ended. Authenticator setup is now required for admin access."
      );
      return;
    }

    writeReminder(user?.id);
    setGraceBypass(true);
    setError("");
  };

  const cancelEnrollmentAndSkip = async () => {
    if (!graceStatus.active) return;

    setWorking(true);
    setError("");

    try {
      if (enrollment?.id) {
        const result = await supabase.auth.mfa.unenroll({
          factorId: enrollment.id,
        });
        if (result.error) throw result.error;
      }

      setEnrollment(null);
      setCode("");
      setMode("intro");
      skipForNow();
    } catch (cancelError) {
      setError(
        cancelError?.message ||
          "Could not cancel this enrollment safely. Please try again."
      );
    } finally {
      setWorking(false);
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    const cleanCode = code.trim().replace(/\s+/g, "");

    if (!activeFactorId || !/^\d{6}$/.test(cleanCode)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setWorking(true);
    setError("");

    try {
      const result = await supabase.auth.mfa.challengeAndVerify({
        factorId: activeFactorId,
        code: cleanCode,
      });
      if (result.error) throw result.error;

      const aalResult =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalResult.error) throw aalResult.error;
      if (aalResult.data?.currentLevel !== "aal2") {
        throw new Error("MFA verification did not elevate this session.");
      }

      await adminMfaSecurityApi.recordVerified();

      clearReminder(user?.id);
      setAal2(true);
      setEnrollment(null);
      setCode("");
    } catch (verifyError) {
      setError(
        verifyError?.message ||
          "The authenticator code could not be verified."
      );
    } finally {
      setWorking(false);
    }
  };

  if (user?.role !== "admin") return <Navigate to="/" replace />;
  if (aal2) return <Outlet />;

  if (checking) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] grid place-items-center p-4">
        <div className="flex items-center gap-3 rounded-xl border border-[#ddd] bg-white px-5 py-4 text-sm text-[#555]">
          <Loader2 size={18} className="animate-spin" /> Checking admin security…
        </div>
      </div>
    );
  }

  if (!verifiedFactor && graceBypass && graceStatus.active) {
    return (
      <div className="min-h-screen bg-[#f6f6f7]">
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950 shadow-sm">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-xs sm:items-center">
              <Clock3 size={15} className="mt-0.5 shrink-0 sm:mt-0" />
              <span>
                <strong>Admin MFA setup pending.</strong>{" "}
                {graceStatus.daysRemaining} day
                {graceStatus.daysRemaining === 1 ? "" : "s"} remaining
                {graceStatus.deadline ? ` — due ${graceStatus.deadline}` : ""}.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                clearReminder(user?.id);
                setGraceBypass(false);
                setMode("intro");
              }}
              className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100"
            >
              Set up now
            </button>
          </div>
        </div>
        <Outlet />
      </div>
    );
  }

  const title =
    mode === "verify"
      ? "Verify admin access"
      : mode === "enroll"
        ? "Set up your authenticator"
        : "Secure your admin account";

  return (
    <div className="min-h-screen bg-[#f2f3f5] grid place-items-center px-4 py-10 text-[#181818]">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#d9d9d9] bg-white shadow-xl">
        <div className="border-b border-[#e5e5e5] bg-[#111] px-5 py-5 text-white">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            <ShieldCheck size={15} /> GDP Clothing Admin Security
          </div>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Administrative pages use a second authentication factor to protect
            orders, customer data, refunds and store controls.
          </p>
        </div>

        <div className="p-5">
          {mode === "intro" && (
            <div>
              {graceStatus.active ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <Clock3
                      size={18}
                      className="mt-0.5 shrink-0 text-blue-700"
                    />
                    <div>
                      <div className="text-sm font-semibold text-blue-950">
                        First-time MFA setup
                      </div>
                      <p className="mt-1 text-xs leading-5 text-blue-900/75">
                        You have {graceStatus.daysRemaining} day
                        {graceStatus.daysRemaining === 1 ? "" : "s"} remaining
                        to connect an authenticator app
                        {graceStatus.deadline
                          ? ` (due ${graceStatus.deadline})`
                          : ""}.
                        You can continue to the admin dashboard and finish this
                        later during the grace period.
                      </p>
                    </div>
                  </div>
                </div>
              ) : grace ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={18}
                      className="mt-0.5 shrink-0 text-amber-700"
                    />
                    <div>
                      <div className="text-sm font-semibold text-amber-950">
                        MFA setup is now required
                      </div>
                      <p className="mt-1 text-xs leading-5 text-amber-900/75">
                        The 7-day setup period has ended. Connect an
                        authenticator to continue into GDP Clothing
                        administration.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-[#e3e3e3] bg-[#fafafa] p-4">
                <div className="text-sm font-semibold">
                  Use an authenticator app
                </div>
                <p className="mt-1 text-xs leading-5 text-[#666]">
                  Google Authenticator, Microsoft Authenticator, 1Password and
                  other TOTP-compatible apps work. A QR code is generated only
                  after you choose to start setup.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={startEnrollment}
                  disabled={working}
                  className="h-11 flex-1 rounded-lg bg-[#171717] px-4 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                >
                  {working ? "Starting…" : "Set up authenticator"}
                </button>
                {graceStatus.active && (
                  <button
                    type="button"
                    onClick={skipForNow}
                    disabled={working}
                    className="h-11 flex-1 rounded-lg border border-[#ccc] bg-white px-4 text-xs font-bold uppercase tracking-wide text-[#222] hover:bg-[#f6f6f6] disabled:opacity-40"
                  >
                    Set up later
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === "enroll" && enrollment && (
            <div>
              <div className="rounded-xl border border-[#e3e3e3] bg-[#fafafa] p-4">
                <div className="text-sm font-semibold">
                  1. Add GDP Clothing to your authenticator app
                </div>
                <p className="mt-1 text-xs leading-5 text-[#666]">
                  Scan this QR code. It was generated specifically for this
                  setup attempt and will not be shown again after successful
                  enrollment.
                </p>
                {qrCode && (
                  <div className="mt-4 flex justify-center">
                    <img
                      src={qrCode}
                      alt="GDP Clothing admin MFA QR code"
                      className="h-48 w-48 rounded-lg border border-[#ddd] bg-white p-2"
                    />
                  </div>
                )}
                {secret && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-[#555]">
                      Can’t scan the QR code?
                    </summary>
                    <div className="mt-2 break-all rounded-lg bg-white p-2 font-mono text-[11px]">
                      {secret}
                    </div>
                  </details>
                )}
              </div>
              <div className="mt-4 text-sm font-semibold">
                2. Enter the 6-digit code
              </div>
            </div>
          )}

          {mode === "verify" && verifiedFactor && (
            <div className="flex items-start gap-3 rounded-xl border border-[#dce8df] bg-[#f4fbf6] p-4">
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-emerald-700"
              />
              <div>
                <div className="text-sm font-semibold text-emerald-900">
                  Authenticator enrolled
                </div>
                <div className="mt-1 text-xs leading-5 text-emerald-800/75">
                  Enter the current 6-digit code to unlock this admin session.
                </div>
              </div>
            </div>
          )}

          {(mode === "enroll" || mode === "verify") && (
            <form onSubmit={verify} className="mt-4">
              <label
                htmlFor="admin-mfa-code"
                className="text-xs font-semibold uppercase tracking-wide text-[#666]"
              >
                Authenticator code
              </label>
              <div className="mt-2 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <KeyRound
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]"
                  />
                  <input
                    id="admin-mfa-code"
                    value={code}
                    onChange={(event) =>
                      setCode(
                        event.target.value.replace(/[^0-9]/g, "").slice(0, 6)
                      )
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    className="h-11 w-full rounded-lg border border-[#ccc] pl-10 pr-3 font-mono text-lg tracking-[0.24em] outline-none focus:border-[#555]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={working || code.length !== 6}
                  className="h-11 rounded-lg bg-[#171717] px-4 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                >
                  {working ? "Verifying…" : "Verify"}
                </button>
              </div>
            </form>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
              {error}
            </div>
          )}

          {mode === "enroll" && graceStatus.active && (
            <button
              type="button"
              onClick={cancelEnrollmentAndSkip}
              disabled={working}
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#555] hover:text-black disabled:opacity-40"
            >
              <Clock3 size={14} /> Cancel setup and do this later
            </button>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#ededed] pt-4">
            <p className="max-w-sm text-[11px] leading-5 text-[#777]">
              MFA is required for GDP Clothing admin accounts after the
              first-time grace period. Customer accounts are not affected by
              this admin security gate.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={load}
                disabled={working}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#666] hover:text-black disabled:opacity-40"
              >
                <RefreshCw size={13} /> Retry
              </button>
              <button
                type="button"
                onClick={() => logout()}
                disabled={working}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#666] hover:text-black disabled:opacity-40"
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
