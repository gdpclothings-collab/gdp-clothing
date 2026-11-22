-- STAGING ONLY: do not apply to production without a separate approval.
-- Global hard ceiling: 50 preview-resolution remove.bg API attempts / UTC month.
-- Rate limits are conserved on failed/aborted calls; no automatic credits/refunds.
-- A private schema holds only counts and a salted one-way caller hash, not photos.
begin;

create schema if not exists private;

create table if not exists private.quick_design_removebg_monthly_quota (
  month_utc date primary key,
  attempts integer not null default 0 check (attempts between 0 and 50),
  updated_at timestamptz not null default now()
);

create table if not exists private.quick_design_removebg_hourly_rate (
  identity_hash text not null,
  window_utc timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 6),
  updated_at timestamptz not null default now(),
  primary key (identity_hash, window_utc),
  constraint quick_design_removebg_identity_length check (length(identity_hash) = 64)
);

revoke all on private.quick_design_removebg_monthly_quota from public, anon, authenticated;
revoke all on private.quick_design_removebg_hourly_rate from public, anon, authenticated;

-- Function is public ONLY to make the service_role RPC callable through PostgREST.
-- Anonymous and customer roles do NOT have EXECUTE permission; revoke default PUBLIC.
create or replace function public.reserve_quick_design_removebg_preview(
  p_identity_hash text,
  p_monthly_limit integer default 50
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_hour timestamptz := date_trunc('hour', now());
  v_monthly_limit integer := least(50, greatest(0, coalesce(p_monthly_limit, 0)));
  v_hourly integer;
  v_monthly integer;
begin
  if p_identity_hash is null or p_identity_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid request identity';
  end if;

  if v_monthly_limit = 0 then
    return jsonb_build_object('allowed', false, 'reason', 'DISABLED');
  end if;

  -- Concurrent calls for a single caller cannot exceed six per UTC hour.
  insert into private.quick_design_removebg_hourly_rate(identity_hash, window_utc, attempts)
  values (p_identity_hash, v_hour, 1)
  on conflict(identity_hash, window_utc) do update
    set attempts = private.quick_design_removebg_hourly_rate.attempts + 1,
        updated_at = now()
    where private.quick_design_removebg_hourly_rate.attempts < 6
  returning attempts into v_hourly;

  if v_hourly is null then
    return jsonb_build_object('allowed', false, 'reason', 'RATE_LIMIT');
  end if;

  -- Global/monthly budget reservation is atomic; no races can exceed 50.
  insert into private.quick_design_removebg_monthly_quota(month_utc, attempts)
  values (v_month, 1)
  on conflict(month_utc) do update
    set attempts = private.quick_design_removebg_monthly_quota.attempts + 1,
        updated_at = now()
    where private.quick_design_removebg_monthly_quota.attempts < v_monthly_limit
  returning attempts into v_monthly;

  if v_monthly is null then
    return jsonb_build_object('allowed', false, 'reason', 'MONTHLY_LIMIT', 'remaining', 0);
  end if;

  return jsonb_build_object('allowed', true, 'remaining', v_monthly_limit - v_monthly);
end;
$$;

revoke all on function public.reserve_quick_design_removebg_preview(text, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_quick_design_removebg_preview(text, integer)
  to service_role;

comment on function public.reserve_quick_design_removebg_preview(text, integer)
  is 'GDP Phase B: service-role-only atomic free remove.bg preview call reservation; maximum 50 per UTC month, six per identity-hour; no customer photo storage.';

commit;
