import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import GoogleIcon from "@/components/GoogleIcon";
import { Loader2 } from "lucide-react";

export default function GoogleSignInButton({ returnTo = "/", onError }) {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    onError?.("");
    setLoading(true);

    try {
      const callbackUrl = new URL("/auth/complete", window.location.origin);
      if (returnTo && returnTo !== "/") {
        callbackUrl.searchParams.set("returnTo", returnTo);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) throw error;
    } catch (err) {
      onError?.(err?.message || "Google sign-in could not be started. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="mb-5 h-12 w-full text-sm font-medium"
      type="button"
      onClick={handleGoogleSignIn}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
      ) : (
        <GoogleIcon className="mr-2 h-5 w-5" />
      )}
      {loading ? "Connecting to Google..." : "Continue with Google"}
    </Button>
  );
}
