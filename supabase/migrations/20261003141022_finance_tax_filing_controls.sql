begin;

create table if not exists public.finance_tax_registration_settings (
  tax_type text primary key check (tax_type in ('gst_hst','pst')),
  registered boolean not null default false,
  account_number text,
  filing_frequency text not null default 'unconfigured' check (filing_frequency in ('unconfigured','monthly','quarterly','annual','other')),
  effective_from date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint finance_tax_registration_account_length check (account_number is null or char_length(account_number) <= 64),
  constraint finance_tax_registration_notes_length check (notes is null or char_length(notes) <= 1000)
);

insert into public.finance_tax_registration_settings (tax_type)
values ('gst_hst'), ('pst')
on conflict (tax_type) do nothing;

alter table public.finance_tax_registration_settings enable row level security;

drop policy if exists finance_tax_registration_admin_select on public.finance_tax_registration_settings;
create policy finance_tax_registration_admin_select
on public.finance_tax_registration_settings
for select
to authenticated
using ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_tax_registration_admin_insert on public.finance_tax_registration_settings;
create policy finance_tax_registration_admin_insert
on public.finance_tax_registration_settings
for insert
to authenticated
with check ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_tax_registration_admin_update on public.finance_tax_registration_settings;
create policy finance_tax_registration_admin_update
on public.finance_tax_registration_settings
for update
to authenticated
using ((select public.is_admin_step_up_authorized()))
with check ((select public.is_admin_step_up_authorized()));

revoke all on public.finance_tax_registration_settings from public, anon;
grant select, insert, update on public.finance_tax_registration_settings to authenticated;
grant all on public.finance_tax_registration_settings to service_role;

create table if not exists public.finance_tax_filing_periods (
  id uuid primary key default gen_random_uuid(),
  tax_type text not null check (tax_type in ('gst_hst','pst')),
  period_start date not null,
  period_end date not null,
  due_date date,
  status text not null default 'open' check (status in ('open','closed','filed')),
  tax_collected numeric(12,2) not null default 0 check (tax_collected >= 0),
  tax_refunded numeric(12,2) not null default 0 check (tax_refunded >= 0),
  tax_credits numeric(12,2) not null default 0 check (tax_credits >= 0),
  net_tax_due numeric(12,2) not null default 0,
  unclassified_tax numeric(12,2) not null default 0 check (unclassified_tax >= 0),
  estimated_refund_allocations integer not null default 0 check (estimated_refund_allocations >= 0),
  estimate_review_confirmed boolean not null default false,
  summary_snapshot jsonb not null default '{}'::jsonb,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  filed_at timestamptz,
  filed_by uuid references auth.users(id) on delete set null,
  filing_reference text,
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id) on delete set null,
  reopen_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint finance_tax_period_dates check (period_end >= period_start),
  constraint finance_tax_period_reference_length check (filing_reference is null or char_length(filing_reference) <= 200),
  constraint finance_tax_period_notes_length check (notes is null or char_length(notes) <= 2000),
  constraint finance_tax_period_reopen_reason_length check (reopen_reason is null or char_length(reopen_reason) <= 1000),
  unique (tax_type, period_start, period_end)
);

create index if not exists finance_tax_filing_periods_type_dates_idx
  on public.finance_tax_filing_periods (tax_type, period_start desc, period_end desc);
create index if not exists finance_tax_filing_periods_status_due_idx
  on public.finance_tax_filing_periods (status, due_date);

alter table public.finance_tax_filing_periods enable row level security;

drop policy if exists finance_tax_periods_admin_select on public.finance_tax_filing_periods;
create policy finance_tax_periods_admin_select
on public.finance_tax_filing_periods
for select
to authenticated
using ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_tax_periods_admin_insert on public.finance_tax_filing_periods;
create policy finance_tax_periods_admin_insert
on public.finance_tax_filing_periods
for insert
to authenticated
with check ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_tax_periods_admin_update on public.finance_tax_filing_periods;
create policy finance_tax_periods_admin_update
on public.finance_tax_filing_periods
for update
to authenticated
using ((select public.is_admin_step_up_authorized()))
with check ((select public.is_admin_step_up_authorized()));

revoke all on public.finance_tax_filing_periods from public, anon;
grant select, insert, update on public.finance_tax_filing_periods to authenticated;
grant all on public.finance_tax_filing_periods to service_role;

create or replace function public.get_admin_tax_filing_controls(p_limit integer default 24)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_limit integer := greatest(1, least(100, coalesce(p_limit,24)));
  v_registrations jsonb;
  v_periods jsonb;
  v_registered_count integer := 0;
  v_ready_count integer := 0;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'taxType', r.tax_type,
      'registered', r.registered,
      'accountNumberMasked', case
        when nullif(trim(r.account_number),'') is null then null
        when char_length(trim(r.account_number)) <= 4 then trim(r.account_number)
        else repeat('*', greatest(char_length(trim(r.account_number)) - 4, 0)) || right(trim(r.account_number),4)
      end,
      'hasAccountNumber', nullif(trim(r.account_number),'') is not null,
      'filingFrequency', r.filing_frequency,
      'effectiveFrom', r.effective_from,
      'notes', r.notes,
      'ready', r.registered and nullif(trim(r.account_number),'') is not null and r.filing_frequency <> 'unconfigured',
      'updatedAt', r.updated_at
    ) order by r.tax_type), '[]'::jsonb),
    count(*) filter (where r.registered)::integer,
    count(*) filter (where r.registered and nullif(trim(r.account_number),'') is not null and r.filing_frequency <> 'unconfigured')::integer
  into v_registrations, v_registered_count, v_ready_count
  from public.finance_tax_registration_settings r;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.period_start desc, x.tax_type), '[]'::jsonb)
  into v_periods
  from (
    select p.id, p.tax_type, p.period_start, p.period_end, p.due_date, p.status,
      p.tax_collected, p.tax_refunded, p.tax_credits, p.net_tax_due,
      p.unclassified_tax, p.estimated_refund_allocations, p.estimate_review_confirmed,
      p.closed_at, p.filed_at, p.filing_reference, p.reopened_at, p.reopen_reason,
      p.notes, p.created_at, p.updated_at,
      (p.status in ('closed','filed') and p.unclassified_tax = 0 and (p.estimated_refund_allocations = 0 or p.estimate_review_confirmed)) as filing_ready
    from public.finance_tax_filing_periods p
    order by p.period_start desc, p.tax_type
    limit v_limit
  ) x;

  return jsonb_build_object(
    'generatedAt', now(),
    'registrations', v_registrations,
    'periods', v_periods,
    'summary', jsonb_build_object(
      'registeredTaxTypes', v_registered_count,
      'configuredTaxTypes', v_ready_count,
      'configurationComplete', v_registered_count > 0 and v_registered_count = v_ready_count
    )
  );
end;
$$;

revoke all on function public.get_admin_tax_filing_controls(integer) from public, anon;
grant execute on function public.get_admin_tax_filing_controls(integer) to authenticated;

create or replace function public.upsert_admin_tax_registration(
  p_tax_type text,
  p_registered boolean,
  p_account_number text default null,
  p_filing_frequency text default 'unconfigured',
  p_effective_from date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_tax_type text := lower(trim(coalesce(p_tax_type,'')));
  v_frequency text := lower(trim(coalesce(p_filing_frequency,'unconfigured')));
  v_account text := nullif(upper(trim(coalesce(p_account_number,''))), '');
  v_row public.finance_tax_registration_settings;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if v_tax_type not in ('gst_hst','pst') then
    raise exception 'invalid tax type' using errcode = '22023';
  end if;
  if v_frequency not in ('unconfigured','monthly','quarterly','annual','other') then
    raise exception 'invalid filing frequency' using errcode = '22023';
  end if;
  if coalesce(p_registered,false) and (v_account is null or v_frequency = 'unconfigured') then
    raise exception 'registered tax types require an account number and filing frequency' using errcode = '22023';
  end if;
  if char_length(coalesce(p_notes,'')) > 1000 then
    raise exception 'notes are too long' using errcode = '22001';
  end if;

  insert into public.finance_tax_registration_settings (
    tax_type, registered, account_number, filing_frequency, effective_from, notes,
    created_by, updated_by, created_at, updated_at
  ) values (
    v_tax_type, coalesce(p_registered,false), case when coalesce(p_registered,false) then v_account else null end,
    case when coalesce(p_registered,false) then v_frequency else 'unconfigured' end,
    case when coalesce(p_registered,false) then p_effective_from else null end,
    nullif(trim(coalesce(p_notes,'')), ''), auth.uid(), auth.uid(), now(), now()
  )
  on conflict (tax_type) do update set
    registered = excluded.registered,
    account_number = excluded.account_number,
    filing_frequency = excluded.filing_frequency,
    effective_from = excluded.effective_from,
    notes = excluded.notes,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'taxType', v_row.tax_type,
    'registered', v_row.registered,
    'hasAccountNumber', nullif(trim(v_row.account_number),'') is not null,
    'accountNumberMasked', case
      when nullif(trim(v_row.account_number),'') is null then null
      when char_length(trim(v_row.account_number)) <= 4 then trim(v_row.account_number)
      else repeat('*', greatest(char_length(trim(v_row.account_number)) - 4, 0)) || right(trim(v_row.account_number),4)
    end,
    'filingFrequency', v_row.filing_frequency,
    'effectiveFrom', v_row.effective_from,
    'notes', v_row.notes,
    'ready', v_row.registered and nullif(trim(v_row.account_number),'') is not null and v_row.filing_frequency <> 'unconfigured',
    'updatedAt', v_row.updated_at
  );
end;
$$;

revoke all on function public.upsert_admin_tax_registration(text,boolean,text,text,date,text) from public, anon;
grant execute on function public.upsert_admin_tax_registration(text,boolean,text,text,date,text) to authenticated;

create or replace function public.create_admin_tax_filing_period(
  p_tax_type text,
  p_period_start date,
  p_period_end date,
  p_due_date date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_tax_type text := lower(trim(coalesce(p_tax_type,'')));
  v_registration public.finance_tax_registration_settings;
  v_center jsonb;
  v_summary jsonb;
  v_from timestamptz;
  v_to timestamptz;
  v_collected numeric := 0;
  v_refunded numeric := 0;
  v_credits numeric := 0;
  v_net numeric := 0;
  v_unclassified numeric := 0;
  v_estimated integer := 0;
  v_row public.finance_tax_filing_periods;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if v_tax_type not in ('gst_hst','pst') then
    raise exception 'invalid tax type' using errcode = '22023';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'invalid filing period dates' using errcode = '22023';
  end if;
  if char_length(coalesce(p_notes,'')) > 2000 then
    raise exception 'notes are too long' using errcode = '22001';
  end if;

  select * into v_registration
  from public.finance_tax_registration_settings
  where tax_type = v_tax_type;

  if v_registration.tax_type is null or not v_registration.registered
     or nullif(trim(v_registration.account_number),'') is null
     or v_registration.filing_frequency = 'unconfigured' then
    raise exception 'tax registration settings must be completed before creating a filing period' using errcode = '22023';
  end if;

  v_from := p_period_start::timestamp at time zone 'America/Regina';
  v_to := (p_period_end + 1)::timestamp at time zone 'America/Regina';
  v_center := public.get_admin_tax_center(v_from, v_to, 25);
  v_summary := coalesce(v_center->'summary','{}'::jsonb);

  if v_tax_type = 'gst_hst' then
    v_collected := coalesce((v_summary->>'gstHstCollected')::numeric,0);
    v_refunded := coalesce((v_summary->>'gstHstRefunded')::numeric,0);
    v_credits := coalesce((v_summary->>'gstHstPotentialItc')::numeric,0);
    v_net := coalesce((v_summary->>'gstHstEstimateBeforeAdjustments')::numeric,0);
  else
    v_collected := coalesce((v_summary->>'pstCollected')::numeric,0);
    v_refunded := coalesce((v_summary->>'pstRefunded')::numeric,0);
    v_credits := 0;
    v_net := coalesce((v_summary->>'pstNetCollected')::numeric,0);
  end if;

  v_unclassified := coalesce((v_summary->>'unclassifiedSalesTax')::numeric,0)
    + coalesce((v_summary->>'unclassifiedExpenseTax')::numeric,0)
    + coalesce((v_summary->>'unclassifiedRefundTax')::numeric,0);
  v_estimated := coalesce((v_summary->>'estimatedRefundAllocations')::integer,0);

  insert into public.finance_tax_filing_periods (
    tax_type, period_start, period_end, due_date, status,
    tax_collected, tax_refunded, tax_credits, net_tax_due,
    unclassified_tax, estimated_refund_allocations, estimate_review_confirmed,
    summary_snapshot, notes, created_by, created_at, updated_at
  ) values (
    v_tax_type, p_period_start, p_period_end, p_due_date, 'open',
    round(v_collected,2), round(v_refunded,2), round(v_credits,2), round(v_net,2),
    round(v_unclassified,2), v_estimated, false,
    jsonb_build_object('preparedAt', now(), 'taxCenterSummary', v_summary),
    nullif(trim(coalesce(p_notes,'')), ''), auth.uid(), now(), now()
  ) returning * into v_row;

  return to_jsonb(v_row) || jsonb_build_object('filing_ready', false);
exception
  when unique_violation then
    raise exception 'a filing period already exists for this tax type and date range' using errcode = '23505';
end;
$$;

revoke all on function public.create_admin_tax_filing_period(text,date,date,date,text) from public, anon;
grant execute on function public.create_admin_tax_filing_period(text,date,date,date,text) to authenticated;

create or replace function public.close_admin_tax_filing_period(
  p_period_id uuid,
  p_confirm_estimates boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.finance_tax_filing_periods;
  v_center jsonb;
  v_summary jsonb;
  v_from timestamptz;
  v_to timestamptz;
  v_collected numeric := 0;
  v_refunded numeric := 0;
  v_credits numeric := 0;
  v_net numeric := 0;
  v_unclassified numeric := 0;
  v_estimated integer := 0;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  select * into v_row from public.finance_tax_filing_periods where id = p_period_id for update;
  if v_row.id is null then raise exception 'filing period not found' using errcode = 'P0002'; end if;
  if v_row.status <> 'open' then raise exception 'only open filing periods can be closed' using errcode = '22023'; end if;

  v_from := v_row.period_start::timestamp at time zone 'America/Regina';
  v_to := (v_row.period_end + 1)::timestamp at time zone 'America/Regina';
  v_center := public.get_admin_tax_center(v_from, v_to, 25);
  v_summary := coalesce(v_center->'summary','{}'::jsonb);

  if v_row.tax_type = 'gst_hst' then
    v_collected := coalesce((v_summary->>'gstHstCollected')::numeric,0);
    v_refunded := coalesce((v_summary->>'gstHstRefunded')::numeric,0);
    v_credits := coalesce((v_summary->>'gstHstPotentialItc')::numeric,0);
    v_net := coalesce((v_summary->>'gstHstEstimateBeforeAdjustments')::numeric,0);
  else
    v_collected := coalesce((v_summary->>'pstCollected')::numeric,0);
    v_refunded := coalesce((v_summary->>'pstRefunded')::numeric,0);
    v_credits := 0;
    v_net := coalesce((v_summary->>'pstNetCollected')::numeric,0);
  end if;

  v_unclassified := coalesce((v_summary->>'unclassifiedSalesTax')::numeric,0)
    + coalesce((v_summary->>'unclassifiedExpenseTax')::numeric,0)
    + coalesce((v_summary->>'unclassifiedRefundTax')::numeric,0);
  v_estimated := coalesce((v_summary->>'estimatedRefundAllocations')::integer,0);

  if v_unclassified > 0 then
    raise exception 'tax classification is incomplete; resolve unclassified tax before closing this filing period' using errcode = '22023';
  end if;
  if v_estimated > 0 and not coalesce(p_confirm_estimates,false) then
    raise exception 'partial refund tax estimates require explicit review confirmation before closing this filing period' using errcode = '22023';
  end if;

  update public.finance_tax_filing_periods
  set tax_collected = round(v_collected,2),
      tax_refunded = round(v_refunded,2),
      tax_credits = round(v_credits,2),
      net_tax_due = round(v_net,2),
      unclassified_tax = round(v_unclassified,2),
      estimated_refund_allocations = v_estimated,
      estimate_review_confirmed = (v_estimated = 0 or coalesce(p_confirm_estimates,false)),
      summary_snapshot = jsonb_build_object('closedAt', now(), 'taxCenterSummary', v_summary),
      status = 'closed',
      closed_at = now(),
      closed_by = auth.uid(),
      updated_at = now()
  where id = p_period_id
  returning * into v_row;

  return to_jsonb(v_row) || jsonb_build_object('filing_ready', true);
end;
$$;

revoke all on function public.close_admin_tax_filing_period(uuid,boolean) from public, anon;
grant execute on function public.close_admin_tax_filing_period(uuid,boolean) to authenticated;

create or replace function public.reopen_admin_tax_filing_period(
  p_period_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.finance_tax_filing_periods;
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if v_reason is null then raise exception 'reopen reason is required' using errcode = '22023'; end if;
  if char_length(v_reason) > 1000 then raise exception 'reopen reason is too long' using errcode = '22001'; end if;

  select * into v_row from public.finance_tax_filing_periods where id = p_period_id for update;
  if v_row.id is null then raise exception 'filing period not found' using errcode = 'P0002'; end if;
  if v_row.status <> 'closed' then raise exception 'only closed, not-yet-filed periods can be reopened' using errcode = '22023'; end if;

  update public.finance_tax_filing_periods
  set status = 'open',
      reopened_at = now(),
      reopened_by = auth.uid(),
      reopen_reason = v_reason,
      closed_at = null,
      closed_by = null,
      estimate_review_confirmed = false,
      updated_at = now()
  where id = p_period_id
  returning * into v_row;

  return to_jsonb(v_row) || jsonb_build_object('filing_ready', false);
end;
$$;

revoke all on function public.reopen_admin_tax_filing_period(uuid,text) from public, anon;
grant execute on function public.reopen_admin_tax_filing_period(uuid,text) to authenticated;

create or replace function public.mark_admin_tax_filing_period_filed(
  p_period_id uuid,
  p_filing_reference text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.finance_tax_filing_periods;
  v_reference text := nullif(trim(coalesce(p_filing_reference,'')), '');
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if v_reference is null then raise exception 'filing reference is required' using errcode = '22023'; end if;
  if char_length(v_reference) > 200 then raise exception 'filing reference is too long' using errcode = '22001'; end if;

  select * into v_row from public.finance_tax_filing_periods where id = p_period_id for update;
  if v_row.id is null then raise exception 'filing period not found' using errcode = 'P0002'; end if;
  if v_row.status <> 'closed' then raise exception 'only closed filing periods can be marked filed' using errcode = '22023'; end if;

  update public.finance_tax_filing_periods
  set status = 'filed',
      filing_reference = v_reference,
      filed_at = now(),
      filed_by = auth.uid(),
      updated_at = now()
  where id = p_period_id
  returning * into v_row;

  return to_jsonb(v_row) || jsonb_build_object('filing_ready', true);
end;
$$;

revoke all on function public.mark_admin_tax_filing_period_filed(uuid,text) from public, anon;
grant execute on function public.mark_admin_tax_filing_period_filed(uuid,text) to authenticated;

commit;
