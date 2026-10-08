import fs from "node:fs";

const gatePath = "src/components/AdminMfaGate.jsx";
const migrationPath = "supabase/migrations/202610080458_admin_mfa_profile_bootstrap.sql";

const gate = fs.readFileSync(gatePath, "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");

function requireMatch(condition, message) {
  if (!condition) {
    console.error(`ADMIN MFA REGRESSION CHECK FAILED: ${message}`);
    process.exit(1);
  }
}

const getStateIndex = gate.indexOf("adminMfaSecurityApi.getState()");
const aalIndex = gate.indexOf("supabase.auth.mfa.getAuthenticatorAssuranceLevel()");
const listFactorsIndex = gate.indexOf("supabase.auth.mfa.listFactors()");

requireMatch(getStateIndex >= 0, "server-backed MFA grace state lookup is missing");
requireMatch(aalIndex >= 0, "AAL lookup is missing");
requireMatch(listFactorsIndex >= 0, "MFA factor lookup is missing");
requireMatch(
  getStateIndex < aalIndex && getStateIndex < listFactorsIndex,
  "server-backed grace state must be checked before browser MFA SDK checks"
);

requireMatch(
  gate.includes("!nextGrace?.enrolled_at"),
  "grace bypass must reject already-enrolled admins"
);
requireMatch(
  gate.includes("expiresAt > Date.now()"),
  "grace bypass must require an unexpired server deadline"
);
requireMatch(
  gate.includes('aalResult.data?.currentLevel === "aal2"'),
  "AAL2 success path is missing"
);
requireMatch(
  gate.includes('item.status === "verified"'),
  "verified-factor challenge path is missing"
);
requireMatch(
  gate.includes("setVerifiedFactor(factor)") && gate.includes('setMode("verify")'),
  "verified factors must still route to the verification challenge"
);

requireMatch(
  migration.includes("create or replace function private.ensure_admin_mfa_state_for_profile()"),
  "admin MFA bootstrap function is missing"
);
requireMatch(
  migration.includes("profiles_initialize_admin_mfa_state"),
  "profiles admin-MFA bootstrap trigger is missing"
);
requireMatch(
  migration.includes("after insert or update of role on public.profiles"),
  "bootstrap trigger must run when an admin profile is inserted or promoted"
);
requireMatch(
  migration.includes("when (new.role = 'admin')"),
  "bootstrap trigger must be restricted to admin profiles"
);
requireMatch(
  migration.includes("on conflict (user_id) do nothing"),
  "existing MFA state must not be reset or extended"
);
requireMatch(
  !migration.match(/on conflict\s*\(user_id\)\s*do update/i),
  "bootstrap migration must never overwrite existing MFA grace/enrollment state"
);
requireMatch(
  migration.includes("revoke all on function private.ensure_admin_mfa_state_for_profile() from public, anon, authenticated"),
  "bootstrap function execute privileges must remain locked down"
);

console.log("Admin MFA onboarding regression checks passed.");
