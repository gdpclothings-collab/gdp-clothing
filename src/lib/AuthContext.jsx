import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext(/** @type {any} */ (null));

async function hydrateUser(authUser) {
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, phone")
    .eq("id", authUser.id)
    .maybeSingle();

  return {
    ...authUser,
    email: authUser.email,
    display_name:
      profile?.display_name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "Customer",
    role: profile?.role || "customer",
    phone: profile?.phone || authUser.phone || null,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      setUser(null);
      setIsLoadingAuth(false);
      return null;
    }

    const hydrated = await hydrateUser(data.user);
    setUser(hydrated);
    setIsLoadingAuth(false);
    return hydrated;
  };

  const checkAppState = checkUserAuth;

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error);

      const hydrated = data?.session?.user
        ? await hydrateUser(data.session.user)
        : null;

      if (!mounted) return;
      setUser(hydrated);
      setIsLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const hydrated = session?.user ? await hydrateUser(session.user) : null;
      if (!mounted) return;
      setUser(hydrated);
      setIsLoadingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    if (shouldRedirect && typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const navigateToLogin = () => {
    if (typeof window !== "undefined") {
      const returnTo = window.location.pathname + window.location.search;
      window.location.href = "/login?returnTo=" + encodeURIComponent(returnTo);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: { id: "gdp-clothing", public_settings: {} },
        authChecked: !isLoadingAuth,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
