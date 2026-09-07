import { supabase } from "@/lib/supabaseClient";

function throwIfError(result) {
  if (result?.error) throw result.error;
  return result?.data;
}

export const privacyApi = {
  async recordMarketingConsent(email, consent, source = "account") {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: {
        action: "recordMarketingConsent",
        email,
        consent: Boolean(consent),
        source,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.message || "Could not update marketing preference.");
    return data;
  },

  async recordRegistrationAcceptance({ userId, email, marketingConsent = false }) {
    const { data, error } = await supabase.functions.invoke("checkout", {
      body: {
        action: "recordRegistrationAcceptance",
        userId,
        email,
        marketingConsent: Boolean(marketingConsent),
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.message || "Could not record policy acceptance.");
    return data;
  },

  async getAccountPrivacy() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const user = authData?.user;
    if (!user) throw new Error("Sign in to manage privacy settings.");

    const [consents, requests, acceptances] = await Promise.all([
      supabase
        .from("marketing_consents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("privacy_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("policy_acceptances")
        .select("*")
        .eq("user_id", user.id)
        .order("accepted_at", { ascending: false })
        .limit(50),
    ]);

    const consentRows = throwIfError(consents) || [];
    return {
      user,
      marketingStatus: consentRows[0]?.status || "unsubscribed",
      marketingConsent: consentRows[0] || null,
      requests: throwIfError(requests) || [],
      acceptances: throwIfError(acceptances) || [],
    };
  },

  async createPrivacyRequest(requestType, details = "") {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const user = authData?.user;
    if (!user) throw new Error("Sign in to submit a privacy request.");

    const { data, error } = await supabase
      .from("privacy_requests")
      .insert({
        user_id: user.id,
        email: user.email || null,
        request_type: requestType,
        status: "open",
        details: details || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },
};
