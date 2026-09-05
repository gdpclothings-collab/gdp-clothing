import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    "Supabase is not configured. Copy .env.example to .env.local and add the GDP Clothing project values."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://example.supabase.co",
  supabasePublishableKey || "missing-publishable-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
