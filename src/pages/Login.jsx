import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;
      window.location.href = returnTo === "/" ? "/account" : returnTo;
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Sign in to manage orders, saved designs and custom projects"
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
            className="font-semibold text-primary hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          Secure account
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-muted-foreground">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          Saved projects
        </div>
        <div className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-muted-foreground sm:col-span-1 sm:justify-start">
          <Mail className="h-4 w-4 shrink-0 text-primary" />
          Order updates
        </div>
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-10 text-base sm:text-sm"
              required
            />
          </div>
        </div>
        <Button type="submit" className="h-12 w-full font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
