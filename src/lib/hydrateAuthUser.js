export async function hydrateAuthUser(supabase, authUser) {
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, phone")
    .eq("id", authUser.id)
    .maybeSingle();

  // Admin profiles are intentionally hidden until MFA. This existing RPC
  // returns only the caller's server-owned role so they can reach the MFA gate.
  // It grants no protected data access and never trusts editable user metadata.
  let role = profile?.role;
  if (!role) {
    const { data, error } = await supabase.rpc("current_user_role");
    if (!error && typeof data === "string") role = data;
  }

  return {
    ...authUser,
    email: authUser.email,
    display_name:
      profile?.display_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "Customer",
    role: role || "customer",
    phone: profile?.phone || authUser.phone || null,
  };
}

