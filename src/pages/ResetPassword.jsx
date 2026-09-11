import React, { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { PASSWORD_POLICY_HINT, validatePassword } from "@/lib/passwordPolicy";

const passwordChecks = [
  { label: "12+ characters", test: (value) => value.length >= 12 },
  { label: "Uppercase", test: (value) => /[A-Z]/.test(value) },
  { label: "Lowercase", test: (value) => /[a-z]/.test(value) },
  { label: "Number", test: (value) => /\d/.test(value) },
  { label: "Symbol", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const passwordState = useMemo(
    () => passwordChecks.map((item) => ({ ...item, passed: item.test(newPassword) })),
    [newPassword],
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasRecoverySession(Boolean(data?.session));
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(Boolean(session));
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <AuthLayout icon={Lock} title="Reset password" subtitle="Checking your secure reset link">
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Checking link…
        </div>
      </AuthLayout>
    );
  }

  if (!hasRecoverySession) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Invalid reset link"
        subtitle="This password reset link is missing or expired"
        footer={
          <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
            Request a new link
          </Link>
        }
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Please request a new password reset email and use the latest link. Older reset links may no longer be valid.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="Create a new password"
      subtitle="Choose a strong password that you don't use on another account"
    >
      {error && (
        <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm leading-5 text-destructive" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                autoFocus
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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

        <Button type="submit" className="h-12 w-full font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
