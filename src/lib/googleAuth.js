import { supabase } from "@/lib/supabaseClient";

export async function signInWithGoogle(returnTo = "/") {
  const redirectTo = new URL(returnTo || "/", window.location.origin).toString();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) throw error;
  return data;
}
