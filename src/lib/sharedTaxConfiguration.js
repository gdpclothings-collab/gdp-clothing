import { supabase } from "@/lib/supabaseClient";

// Shared, read-only tax configuration used by invoice preparation and checkout
// verification. No change to the live checkout tax engine until parity testing.
export async function loadSharedTaxConfiguration() {
  const [{data: rules,error: ruleError},{data: registrations,error: registrationError}] = await Promise.all([
    supabase.from("tax_rules").select("country_code,region_code,config,priority,active").eq("country_code","CA").eq("active",true),
    supabase.rpc("get_admin_tax_filing_controls",{p_limit:1}),
  ]);
  if(ruleError) throw ruleError;
  if(registrationError) throw registrationError;
  return {rules:rules||[],registrations:registrations?.registrations||[],alignment:registrations?.summary||{}};
}
export function summarizeTaxAlignment(config) {
  return (config.registrations||[]).map(r=>({
    type:r.taxType, registered:!!r.registered,
    status:r.alignmentStatus||"unverified",
    collectionEnabled:!!r.checkoutCollectionEnabled,
    needsReview:!!r.alignmentIssue
  }));
}
