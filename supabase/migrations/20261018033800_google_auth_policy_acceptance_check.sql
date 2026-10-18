-- Narrow pre-MFA registration consent check: reads only two acceptance flags
-- for auth.uid(), never returns any row or accesses admin business data.
-- Existing admin AAL2 restrictions on all underlying tables stay unchanged.
create or replace function public.has_my_current_registration_policy_acceptances()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.policy_acceptances pa
      where pa.user_id = (select auth.uid())
        and pa.policy_key = 'terms_conditions'
        and pa.policy_version = '2026-09-07'
    )
    and exists (
      select 1 from public.policy_acceptances pa
      where pa.user_id = (select auth.uid())
        and pa.policy_key = 'privacy_policy'
        and pa.policy_version = '2026-09-07'
    );
$$;

revoke all on function public.has_my_current_registration_policy_acceptances()
  from public, anon, authenticated;
grant execute on function public.has_my_current_registration_policy_acceptances()
  to authenticated;
comment on function public.has_my_current_registration_policy_acceptances()
  is 'Pre-MFA own-user terms/privacy acceptance existence check. Boolean only; no privileged data is returned.';