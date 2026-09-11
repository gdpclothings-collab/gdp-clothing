import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2, CheckCircle2, RefreshCw, UserRound } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";
import { PASSWORD_POLICY_HINT, validatePassword } from "@/lib/passwordPolicy";
import { privacyApi } from "@/lib/privacyApi";

const passwordChecks = [
  { label: "12+ characters", test: (value) => value.length >= 12 },
  { label: "Uppercase", test: (value) => /[A-Z]/.test(value) },
  { label: "Lowercase", test: (value) => /[a-z]/.test(value) },
  { label: "Number", test: (value) => /\d/.test(value) },
  { label: "Symbol", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const returnTo = safeReturnTo();
  const passwordState = useMemo(
    () => passwordChecks.map((item) => ({ ...item, passed: item.test(password) })),
    [password],
  );

  const resendConfirmation = async () => {
    if (!email || resending) return;
    setResending(true);
    setResendMessage("");
    try {
      const emailRedirectTo = new URL(returnTo, window.location.origin).toString();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      });
      if (resendError) throw resendError;
      setResendMessage("Verification email sent again. Check your inbox and spam folder.");
    } catch (err) {
      setResendMessage(err?.message || "We could not resend the email yet. Please try again shortly.");
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const normalizedName = fullName.trim().replace(/\s+/g, " ");
    if (normalizedName.length < 2) {
      setError("Enter your full name.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!termsAccepted) {
      setError("Accept the Terms & Conditions and Privacy Policy to create an account.");
      return;
    }

    setLoading(true);
    try {
      const emailRedirectTo = new URL(returnTo, window.location.origin).toString();
      const acceptedAt = new Date().toISOString();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: normalizedName,
            terms_accepted_at: acceptedAt,
            privacy_acknowledged_at: acceptedAt,
            policy_version: "2026-09-07",
            marketing_consent: marketingConsent,
          },
        },
      });
      if (signUpError) throw signUpError;

      if (data?.user?.id) {
        try {
          await privacyApi.recordRegistrationAcceptance({
            userId: data.user.id,
            email: email.trim().toLowerCase(),
            marketingConsent,
          });
        } catch (auditError) {
          console.error("Registration policy acceptance audit failed:", auditError);
        }
      }

      if (data?.session) {
        window.location.href = returnTo === "/" ? "/account" : returnTo;
        return;
      }
      setConfirmationSent(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <AuthLayout
        icon={Mail}
        title="Check your email"
        subtitle="Verify your email to activate your GDP Clothing account"
        footer={
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Back to log in
          </Link>
        }
      >
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              We sent a confirmation link to
            </p>
            <p className="break-all text-sm font-semibold text-foreground">{email}</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Open the message from GDP Clothing, confirm your email, then you will continue to your account or return to the page you were using.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={resendConfirmation}
            disabled={resending}
          >
            {resending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend verification email
              </>
            )}
          </Button>

          {resendMessage && (
            <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs leading-5 text-muted-foreground" role="status">
              {resendMessage}
            </p>
          )}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Save designs, track orders and keep your custom projects together"
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={"/login" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="text-primary font-semibold hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-secondary/30 p-2 text-center text-[11px] text-muted-foreground sm:text-xs">
        <div className="rounded-xl bg-background px-2 py-2.5">Save designs</div>
        <div className="rounded-xl bg-background px-2 py-2.5">Track orders</div>
        <div className="rounded-xl bg-background px-2 py-2.5">Manage proofs</div>
      </div>

      <Button
        variant="outline"
        className="mb-2 h-12 w-full cursor-not-allowed text-sm font-medium opacity-60"
        disabled
        type="button"
      >
        <GoogleIcon className="mr-2 h-5 w-5" />
        Google sign-in unavailable
      </Button>
      <p className="mb-5 text-center text-xs leading-5 text-muted-foreground">
        Use email and password for now. Google sign-in will return after OAuth setup is completed.
      </p>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or continue with email</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm leading-5 text-destructive" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="full-name">Full name</Label>
          <div className="relative">
            <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="full-name"
              type="text"
              autoComplete="name"
              autoFocus
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 pl-10 text-base sm:text-sm"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10 text-base sm:text-sm"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pl-10 text-base sm:text-sm"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 pl-10 text-base sm:text-sm"
                required
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-secondary/30 p-3 sm:p-4">
          <div className="mb-3 text-xs leading-5 text-muted-foreground">{PASSWORD_POLICY_HINT}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {passwordState.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] ${
                  item.passed ? "bg-primary/10 text-foreground" : "bg-background text-muted-foreground"
                }`}
              >
                <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${item.passed ? "text-primary" : "opacity-35"}`} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-secondary/35 p-3 sm:p-4">
          <label className="flex cursor-pointer items-start gap-3 text-xs leading-5">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
              required
            />
            <span>
              I agree to the <Link to="/pages/terms" target="_blank" className="font-semibold text-primary hover:underline">Terms & Conditions</Link> and acknowledge the <Link to="/pages/privacy" target="_blank" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              Email me GDP Clothing news, drops and special offers. This is optional and I can unsubscribe anytime. <Link to="/pages/marketing-consent" target="_blank" className="underline hover:text-foreground">Details</Link>
            </span>
          </label>
        </div>

        <Button type="submit" className="h-12 w-full font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
