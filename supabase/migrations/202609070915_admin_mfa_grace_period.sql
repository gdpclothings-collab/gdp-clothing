begin;

-- GDP Clothing admin MFA onboarding
-- 1) Never auto-enroll a TOTP factor just because an admin opened /admin.
-- 2) Give first-time admins a one-time 7-day setup grace period.
-- 3) Keep grace-period state server-owned so a browser cannot extend it.
-- 4) Clear incomplete admin TOTP enrollments left by the previous auto-enroll flow.

create table if not exists public.admin_mfa_enrollment_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  grace_started_at timestamptz not null default now(),
  grace_expires_at timestamptz not null default (now() + interval '7 days'),
  enrolled_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_mfa_grace_window_valid check (grace_expires_at >= grace_started_at)
);

alter table public.admin_mfa_enrollment_state enable row level security;

drop policy if exists admin_mfa_state_select_self_or_admin
  on public.admin_mfa_enrollment_state;
create policy admin_mfa_state_select_self_or_admin
  on public.admin_mfa_enrollment_state
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
  );

revoke all on public.admin_mfa_enrollment_state from anon, authenticated;
grant select on public.admin_mfa_enrollment_state to authenticated;

drop trigger if exists admin_mfa_enrollment_state_set_updated_at
  on public.admin_mfa_enrollment_state;
create trigger admin_mfa_enrollment_state_set_updated_at
before update on public.admin_mfa_enrollment_state
for each row execute procedure public.set_updated_at();

create or replace function public.get_or_create_admin_mfa_state()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_state public.admin_mfa_enrollment_state%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.admin_mfa_enrollment_state (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select *
    into v_state
  from public.admin_mfa_enrollment_state
  where user_id = auth.uid();

  return jsonb_build_object(
    'user_id', v_state.user_id,
    'grace_started_at', v_state.grace_started_at,
    'grace_expires_at', v_state.grace_expires_at,
    'grace_active', now() < v_state.grace_expires_at,
    'enrolled_at', v_state.enrolled_at,
    'last_verified_at', v_state.last_verified_at
  );
end;
$$;

revoke all on function public.get_or_create_admin_mfa_state() from public, anon;
grant execute on function public.get_or_create_admin_mfa_state() to authenticated;

create or replace function public.record_admin_mfa_verified()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.admin_mfa_enrollment_state (
    user_id,
    grace_started_at,
    grace_expires_at,
    enrolled_at,
    last_verified_at
  )
  values (
    auth.uid(),
    now(),
    now(),
    now(),
    now()
  )
  on conflict (user_id) do update
  set enrolled_at = coalesce(public.admin_mfa_enrollment_state.enrolled_at, now()),
      last_verified_at = now(),
      updated_at = now();
end;
$$;

revoke all on function public.record_admin_mfa_verified() from public, anon;
grant execute on function public.record_admin_mfa_verified() to authenticated;

create or replace function public.clear_my_unverified_admin_mfa_factors()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_deleted integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  delete from auth.mfa_factors
  where user_id = auth.uid()
    and factor_type::text = 'totp'
    and status::text = 'unverified';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.clear_my_unverified_admin_mfa_factors() from public, anon;
grant execute on function public.clear_my_unverified_admin_mfa_factors() to authenticated;

-- Invalidate QR/secret material created by the old automatic-enrollment screen.
-- Verified factors are intentionally left untouched.
delete from auth.mfa_factors f
using public.profiles p
where f.user_id = p.id
  and p.role = 'admin'
  and f.factor_type::text = 'totp'
  and f.status::text = 'unverified';

update public.security_compliance_controls
set status = 'in_progress',
    evidence = 'Admin MFA now uses explicit TOTP enrollment, a server-owned 7-day first-time setup grace period, and cleanup of abandoned unverified factors.',
    remediation = 'Complete enrollment for each admin before the grace window expires. Confirm AAL2 is enforced for privileged sessions.',
    updated_at = now()
where control_key = 'admin_mfa';

commit;
