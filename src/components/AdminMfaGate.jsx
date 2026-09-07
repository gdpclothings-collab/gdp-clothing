import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

export default function AdminMfaGate() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [verifiedFactor, setVerifiedFactor] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [aal2, setAal2] = useState(false);
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setChecking(true);
    setError("");
    try {
      const [aalResult, factorsResult] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

      if (aalResult.error) throw aalResult.error;
      if (factorsResult.error) throw factorsResult.error;

      if (aalResult.data?.currentLevel === "aal2") {
        setAal2(true);
        return;
      }

      const totpFactors = factorsResult.data?.totp || [];
      const factor = totpFactors.find((item) => item.status === "verified") || null;
      setVerifiedFactor(factor);

      if (!factor) {
        const enrollResult = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "GDP Clothing Admin",
        });
        if (enrollResult.error) throw enrollResult.error;
        setEnrollment(enrollResult.data);
      }
    } catch (loadError) {
      setError(loadError?.message || "Could not initialize admin multi-factor authentication.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.role]);

  const activeFactorId = verifiedFactor?.id || enrollment?.id || "";
  const qrCode = enrollment?.totp?.qr_code || "";
  const secret = enrollment?.totp?.secret || "";

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

      const aalResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalResult.error) throw aalResult.error;
      if (aalResult.data?.currentLevel !== "aal2") {
        throw new Error("MFA verification did not elevate this session.");
      }

      setAal2(true);
      setEnrollment(null);
      setCode("");
    } catch (verifyError) {
      setError(verifyError?.message || "The authenticator code could not be verified.");
    } finally {
      setWorking(false);
    }
  };

  const title = useMemo(
    () => (verifiedFactor ? "Verify admin access" : "Secure your admin account"),
    [verifiedFactor]
  );

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

  return (
    <div className="min-h-screen bg-[#f2f3f5] grid place-items-center px-4 py-10 text-[#181818]">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#d9d9d9] bg-white shadow-xl">
        <div className="border-b border-[#e5e5e5] bg-[#111] px-5 py-5 text-white">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            <ShieldCheck size={15} /> GDP Clothing Admin Security
          </div>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Administrative pages require a second authentication factor in addition to your normal sign-in.
          </p>
        </div>

        <div className="p-5">
          {!verifiedFactor && enrollment ? (
            <div>
              <div className="rounded-xl border border-[#e3e3e3] bg-[#fafafa] p-4">
                <div className="text-sm font-semibold">1. Add GDP Clothing to your authenticator app</div>
                <p className="mt-1 text-xs leading-5 text-[#666]">
                  Scan this QR code with an authenticator app such as Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP-compatible app.
                </p>
                {qrCode && (
                  <div className="mt-4 flex justify-center">
                    <img src={qrCode} alt="GDP Clothing admin MFA QR code" className="h-48 w-48 rounded-lg border border-[#ddd] bg-white p-2" />
                  </div>
                )}
                {secret && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer font-semibold text-[#555]">Can’t scan the QR code?</summary>
                    <div className="mt-2 break-all rounded-lg bg-white p-2 font-mono text-[11px]">{secret}</div>
                  </details>
                )}
              </div>
              <div className="mt-4 text-sm font-semibold">2. Enter the 6-digit code</div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-[#dce8df] bg-[#f4fbf6] p-4">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
              <div>
                <div className="text-sm font-semibold text-emerald-900">Authenticator already enrolled</div>
                <div className="mt-1 text-xs leading-5 text-emerald-800/75">Enter the current 6-digit code to unlock this admin session.</div>
              </div>
            </div>
          )}

          <form onSubmit={verify} className="mt-4">
            <label htmlFor="admin-mfa-code" className="text-xs font-semibold uppercase tracking-wide text-[#666]">
              Authenticator code
            </label>
            <div className="mt-2 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" />
                <input
                  id="admin-mfa-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
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

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
              {error}
            </div>
          )}

          <p className="mt-5 text-[11px] leading-5 text-[#777]">
            MFA protects orders, customer data, refunds, security controls and store administration if a password is compromised.
          </p>
        </div>
      </div>
    </div>
  );
}
