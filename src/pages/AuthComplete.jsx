import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { privacyApi } from "@/lib/privacyApi";
import { safeReturnTo } from "@/lib/authReturnTo";

const POLICY_VERSION = "2026-09-07";

export default function AuthComplete() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const returnTo = useMemo(() => safeReturnTo(), []);
  const destination = returnTo === "/" ? "/account" : returnTo;

  useEffect(() => {
    let active = true;

    const finishExistingUser = async () => {
      setLoading(true);
      setError("");

      try {
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!data?.user) {
          throw new Error("Google sign-in did not complete. Please return to login and try again.");
        }

        if (!active) return;
        setEmail(data.user.email || "");

        const privacy = await privacyApi.getAccountPrivacy();
        const acceptances = privacy?.acceptances || [];
        const hasTerms = acceptances.some(
          (item) => item.policy_key === "terms_conditions" && item.policy_version === POLICY_VERSION,
        );
        const hasPrivacy = acceptances.some(
          (item) => item.policy_key === "privacy_policy" && item.policy_version === POLICY_VERSION,
        );

        if (hasTerms && hasPrivacy) {
          window.location.replace(destination);
          return;
        }

        if (!active) return;
        setNeedsAcceptance(true);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "We could not finish Google sign-in. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };

    finishExistingUser();

    return () => {
      active = false;
    };
  }, [destination]);

  const completeRegistration = async () => {
    if (!termsAccepted || saving) {
      if (!termsAccepted) {
        setError("Accept the Terms & Conditions and Privacy Policy to finish creating your account.");
      }
      return;
    }

    setSaving(true);
    setError("");

    try {
      const acceptedAt = new Date().toISOString();
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: {
          terms_accepted_at: acceptedAt,
          privacy_acknowledged_at: acceptedAt,
          policy_version: POLICY_VERSION,
          marketing_consent: marketingConsent,
        },
      });
      if (updateError) throw updateError;

      const user = data?.user;
      if (!user?.id || !user?.email) {
        throw new Error("Your Google account session could not be verified. Please sign in again.");
      }

      await privacyApi.recordRegistrationAcceptance({
        userId: user.id,
        email: user.email,
        marketingConsent,
      });

      window.location.replace(destination);
    } catch (err) {
      setError(err?.message || "We could not finish creating your account. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout
        icon={ShieldCheck}
        title="Finishing sign-in"
        subtitle="Securely connecting your Google account to GDP Clothing"
      >
        <div className="flex min-h-40 flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Checking your account and privacy settings...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={needsAcceptance ? CheckCircle2 : ShieldCheck}
      title={needsAcceptance ? "Finish creating your account" : "Google sign-in needs attention"}
      subtitle={
        needsAcceptance
          ? "One quick step before your GDP Clothing account is ready"
          : "We could not complete Google sign-in"
      }
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm leading-5 text-destructive" role="alert">
          {error}
        </div>
      )}

      {needsAcceptance ? (
        <div className="space-y-5">
          {email && (
            <div className="rounded-xl border border-border bg-secondary/30 px-3 py-3 text-sm">
              <span className="text-muted-foreground">Google account: </span>
              <span className="break-all font-medium text-foreground">{email}</span>
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-border bg-secondary/35 p-3 sm:p-4">
            <label className="flex cursor-pointer items-start gap-3 text-xs leading-5">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                I agree to the{" "}
                <Link to="/pages/terms" target="_blank" className="font-semibold text-primary hover:underline">
                  Terms & Conditions
                </Link>{" "}
                and acknowledge the{" "}
                <Link to="/pages/privacy" target="_blank" className="font-semibold text-primary hover:underline">
                  Privacy Policy
                </Link>.
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(event) => setMarketingConsent(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                Email me GDP Clothing news, drops and special offers. This is optional and I can unsubscribe anytime.{" "}
                <Link to="/pages/marketing-consent" target="_blank" className="underline hover:text-foreground">
                  Details
                </Link>
              </span>
            </label>
          </div>

          <Button
            type="button"
            className="h-12 w-full font-semibold"
            onClick={completeRegistration}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finishing account...
              </>
            ) : (
              "Continue to GDP Clothing"
            )}
          </Button>
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          Return to the login page and try Google again, or continue with your email and password.
        </p>
      )}
    </AuthLayout>
  );
}
