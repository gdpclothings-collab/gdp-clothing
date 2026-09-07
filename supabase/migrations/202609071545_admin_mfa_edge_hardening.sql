begin;

-- Privileged admin MFA operations now run in the authenticated
-- admin-mfa-security Edge Function using server-only credentials.
-- Remove the former Data API RPC surface completely.

revoke all on function public.clear_my_unverified_admin_mfa_factors() from public, anon, authenticated;
revoke all on function public.get_or_create_admin_mfa_state() from public, anon, authenticated;
revoke all on function public.record_admin_mfa_verified() from public, anon, authenticated;

drop function if exists public.clear_my_unverified_admin_mfa_factors();
drop function if exists public.get_or_create_admin_mfa_state();
drop function if exists public.record_admin_mfa_verified();

-- The browser no longer needs direct Data API access to MFA enrollment state.
drop policy if exists admin_mfa_state_select_self_or_admin
  on public.admin_mfa_enrollment_state;

revoke all on table public.admin_mfa_enrollment_state from anon, authenticated;
grant all on table public.admin_mfa_enrollment_state to service_role;

commit;
