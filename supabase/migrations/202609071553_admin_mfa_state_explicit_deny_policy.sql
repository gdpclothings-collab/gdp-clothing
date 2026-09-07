begin;

-- Explicitly document that browser roles must never access admin MFA state.
-- The authenticated admin-mfa-security Edge Function uses service_role.
drop policy if exists admin_mfa_state_no_client_access
  on public.admin_mfa_enrollment_state;

create policy admin_mfa_state_no_client_access
  on public.admin_mfa_enrollment_state
  for all
  to anon, authenticated
  using (false)
  with check (false);

commit;
