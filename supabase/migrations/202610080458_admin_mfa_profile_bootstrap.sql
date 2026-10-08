begin;

-- Ensure every GDP Clothing admin has a server-owned MFA onboarding state
-- before browser profile hydration is subject to the restrictive admin
-- step-up policy. This removes the circular dependency for newly promoted
-- administrators without weakening AAL2 enforcement after the grace period.

create or replace function private.ensure_admin_mfa_state_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'admin' then
    insert into public.admin_mfa_enrollment_state (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.ensure_admin_mfa_state_for_profile() from public, anon, authenticated;

drop trigger if exists profiles_initialize_admin_mfa_state on public.profiles;
create trigger profiles_initialize_admin_mfa_state
after insert or update of role on public.profiles
for each row
when (new.role = 'admin')
execute function private.ensure_admin_mfa_state_for_profile();

-- Backfill any current admin that predates the trigger.
insert into public.admin_mfa_enrollment_state (user_id)
select p.id
from public.profiles p
where p.role = 'admin'
on conflict (user_id) do nothing;

comment on function private.ensure_admin_mfa_state_for_profile() is
  'Creates the server-owned first-time MFA grace state whenever a GDP Clothing profile becomes an admin. Existing states are never extended or reset.';

commit;
