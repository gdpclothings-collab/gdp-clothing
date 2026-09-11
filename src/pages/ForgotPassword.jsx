import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Deliberately return the same success state to avoid account enumeration.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="We'll send a secure link so you can choose a new password"
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          <ArrowLeft className="mr-1 inline h-3 w-3" />Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Check your inbox</p>
            <p className="text-sm leading-6 text-muted-foreground">
              If an account exists for <span className="break-all font-medium text-foreground">{email}</span>, you'll receive a password reset link shortly.
            </p>
          </div>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setSent(false)}>
            Try another email
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-border bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground sm:p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            For privacy, we'll show the same confirmation message whether or not the email is registered.
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-10 text-base sm:text-sm"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="h-12 w-full font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
