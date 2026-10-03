create table if not exists public.finance_bank_entries (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null,
  direction text not null check (direction in ('credit','debit')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'CAD' check (currency = 'CAD'),
  description text not null check (char_length(description) between 1 and 500),
  reference text null check (reference is null or char_length(reference) <= 200),
  source_type text not null default 'other' check (source_type in ('stripe_payout','cash_deposit','e_transfer','terminal_deposit','cheque','expense','other')),
  source_reference text null check (source_reference is null or char_length(source_reference) <= 200),
  expected_amount numeric(12,2) null check (expected_amount is null or expected_amount >= 0),
  variance numeric(12,2) generated always as (
    case when expected_amount is null then null else round(amount - expected_amount, 2) end
  ) stored,
  match_status text generated always as (
    case
      when expected_amount is null then 'unclassified'
      when abs(amount - expected_amount) <= 0.01 then 'matched'
      else 'review'
    end
  ) stored,
  notes text null check (notes is null or char_length(notes) <= 1000),
  status text not null default 'active' check (status in ('active','voided')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz null,
  voided_by uuid null references auth.users(id) on delete set null,
  void_reason text null check (void_reason is null or char_length(void_reason) <= 500),
  constraint finance_bank_entries_stripe_credit check (source_type <> 'stripe_payout' or direction = 'credit'),
  constraint finance_bank_entries_stripe_reference check (source_type <> 'stripe_payout' or nullif(trim(coalesce(source_reference,'')), '') is not null),
  constraint finance_bank_entries_void_metadata check (
    (status = 'active' and voided_at is null and voided_by is null and void_reason is null)
    or
    (status = 'voided' and voided_at is not null and nullif(trim(coalesce(void_reason,'')), '') is not null)
  )
);

create unique index if not exists finance_bank_entries_active_stripe_payout_uidx
  on public.finance_bank_entries (source_reference)
  where source_type = 'stripe_payout' and status = 'active';
create index if not exists finance_bank_entries_occurred_on_idx on public.finance_bank_entries (occurred_on desc);
create index if not exists finance_bank_entries_status_occurred_on_idx on public.finance_bank_entries (status, occurred_on desc);
create index if not exists finance_bank_entries_source_idx on public.finance_bank_entries (source_type, source_reference);
create index if not exists finance_bank_entries_created_by_idx on public.finance_bank_entries (created_by);
create index if not exists finance_bank_entries_voided_by_idx on public.finance_bank_entries (voided_by);

create table if not exists public.finance_bank_entry_events (
  id uuid primary key default gen_random_uuid(),
  bank_entry_id uuid not null references public.finance_bank_entries(id) on delete restrict,
  event_type text not null check (event_type in ('created','voided')),
  reason text null check (reason is null or char_length(reason) <= 500),
  snapshot jsonb not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finance_bank_entry_events_reason_required check (
    event_type = 'created' or nullif(trim(coalesce(reason,'')), '') is not null
  )
);
create index if not exists finance_bank_entry_events_entry_idx on public.finance_bank_entry_events (bank_entry_id, created_at desc);
create index if not exists finance_bank_entry_events_created_by_idx on public.finance_bank_entry_events (created_by);

alter table public.finance_bank_entries enable row level security;
alter table public.finance_bank_entry_events enable row level security;

drop policy if exists finance_bank_entries_admin_read on public.finance_bank_entries;
create policy finance_bank_entries_admin_read
  on public.finance_bank_entries for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_bank_entry_events_admin_read on public.finance_bank_entry_events;
create policy finance_bank_entry_events_admin_read
  on public.finance_bank_entry_events for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

revoke all on table public.finance_bank_entries from public, anon, authenticated;
revoke all on table public.finance_bank_entry_events from public, anon, authenticated;
grant select on table public.finance_bank_entries to authenticated;
grant select on table public.finance_bank_entry_events to authenticated;
grant all on table public.finance_bank_entries to service_role;
grant all on table public.finance_bank_entry_events to service_role;

create or replace function private.finance_create_bank_entry_impl(
  p_occurred_on date,
  p_direction text,
  p_amount numeric,
  p_description text,
  p_reference text default null,
  p_source_type text default 'other',
  p_source_reference text default null,
  p_expected_amount numeric default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row public.finance_bank_entries;
  v_direction text := lower(trim(coalesce(p_direction,'')));
  v_description text := nullif(trim(coalesce(p_description,'')), '');
  v_reference text := nullif(trim(coalesce(p_reference,'')), '');
  v_source_type text := lower(trim(coalesce(p_source_type,'other')));
  v_source_reference text := nullif(trim(coalesce(p_source_reference,'')), '');
  v_notes text := nullif(trim(coalesce(p_notes,'')), '');
  v_amount numeric := round(coalesce(p_amount,0),2);
  v_expected numeric := case when p_expected_amount is null then null else round(p_expected_amount,2) end;
  v_payout_amount numeric;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_occurred_on is null or p_occurred_on > (now() at time zone 'America/Regina')::date then
    raise exception 'invalid bank transaction date' using errcode = '22023';
  end if;
  if v_direction not in ('credit','debit') then
    raise exception 'invalid bank transaction direction' using errcode = '22023';
  end if;
  if v_amount <= 0 then
    raise exception 'bank transaction amount must be greater than zero' using errcode = '22023';
  end if;
  if v_description is null then
    raise exception 'bank transaction description is required' using errcode = '22023';
  end if;
  if v_source_type not in ('stripe_payout','cash_deposit','e_transfer','terminal_deposit','cheque','expense','other') then
    raise exception 'invalid bank transaction source' using errcode = '22023';
  end if;
  if v_expected is not null and v_expected < 0 then
    raise exception 'expected amount cannot be negative' using errcode = '22023';
  end if;
  if char_length(v_description) > 500 or char_length(coalesce(v_reference,'')) > 200 or char_length(coalesce(v_source_reference,'')) > 200 or char_length(coalesce(v_notes,'')) > 1000 then
    raise exception 'one or more bank transaction text fields are too long' using errcode = '22001';
  end if;

  if v_source_type = 'stripe_payout' then
    if v_direction <> 'credit' or v_source_reference is null then
      raise exception 'Stripe payout entries require a credit and payout ID' using errcode = '22023';
    end if;
    select p.amount into v_payout_amount
    from public.finance_stripe_payouts p
    where p.stripe_payout_id = v_source_reference
      and p.payment_mode = 'live'
      and p.status = 'paid';
    if not found then
      raise exception 'paid live Stripe payout not found' using errcode = 'P0002';
    end if;
    v_expected := round(v_payout_amount,2);
  end if;

  insert into public.finance_bank_entries (
    occurred_on, direction, amount, description, reference, source_type,
    source_reference, expected_amount, notes, created_by
  ) values (
    p_occurred_on, v_direction, v_amount, v_description, v_reference, v_source_type,
    v_source_reference, v_expected, v_notes, auth.uid()
  ) returning * into v_row;

  insert into public.finance_bank_entry_events (bank_entry_id, event_type, reason, snapshot, created_by)
  values (v_row.id, 'created', null, to_jsonb(v_row), auth.uid());

  return to_jsonb(v_row);
exception
  when unique_violation then
    raise exception 'this Stripe payout is already matched to an active bank entry' using errcode = '23505';
end;
$function$;

create or replace function private.finance_void_bank_entry_impl(
  p_bank_entry_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_before public.finance_bank_entries;
  v_after public.finance_bank_entries;
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_bank_entry_id is null then
    raise exception 'bank entry is required' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'void reason is required' using errcode = '22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'void reason is too long' using errcode = '22001';
  end if;

  select * into v_before from public.finance_bank_entries where id = p_bank_entry_id for update;
  if v_before.id is null then
    raise exception 'bank entry not found' using errcode = 'P0002';
  end if;
  if v_before.status <> 'active' then
    raise exception 'bank entry is already voided' using errcode = '22023';
  end if;

  update public.finance_bank_entries
  set status='voided', voided_at=now(), voided_by=auth.uid(), void_reason=v_reason, updated_at=now()
  where id=p_bank_entry_id
  returning * into v_after;

  insert into public.finance_bank_entry_events (bank_entry_id, event_type, reason, snapshot, created_by)
  values (v_after.id, 'voided', v_reason, to_jsonb(v_after), auth.uid());

  return to_jsonb(v_after);
end;
$function$;

create or replace function private.finance_get_bank_reconciliation_impl(
  p_from date default null,
  p_to date default null,
  p_limit integer default 500
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_limit integer := greatest(25, least(1000, coalesce(p_limit,500)));
  v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  with filtered as (
    select b.*
    from public.finance_bank_entries b
    where (p_from is null or b.occurred_on >= p_from)
      and (p_to is null or b.occurred_on <= p_to)
  ), unmatched_payouts as (
    select p.*
    from public.finance_stripe_payouts p
    where p.payment_mode='live'
      and p.status='paid'
      and (p_from is null or coalesce(p.arrival_date, (p.stripe_created_at at time zone 'America/Regina')::date) >= p_from)
      and (p_to is null or coalesce(p.arrival_date, (p.stripe_created_at at time zone 'America/Regina')::date) <= p_to)
      and not exists (
        select 1 from public.finance_bank_entries b
        where b.status='active'
          and b.source_type='stripe_payout'
          and b.source_reference=p.stripe_payout_id
      )
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'metrics', jsonb_build_object(
      'activeCount', coalesce((select count(*) from filtered where status='active'),0),
      'creditTotal', coalesce((select sum(amount) from filtered where status='active' and direction='credit'),0),
      'debitTotal', coalesce((select sum(amount) from filtered where status='active' and direction='debit'),0),
      'matchedCount', coalesce((select count(*) from filtered where status='active' and match_status='matched'),0),
      'reviewCount', coalesce((select count(*) from filtered where status='active' and match_status='review'),0),
      'unclassifiedCount', coalesce((select count(*) from filtered where status='active' and match_status='unclassified'),0),
      'varianceNet', coalesce((select sum(variance) from filtered where status='active' and variance is not null),0),
      'voidedCount', coalesce((select count(*) from filtered where status='voided'),0),
      'unmatchedStripePayoutCount', coalesce((select count(*) from unmatched_payouts),0),
      'unmatchedStripePayoutAmount', coalesce((select sum(amount) from unmatched_payouts),0)
    ),
    'entries', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.occurred_on desc, x.created_at desc)
      from (
        select id, occurred_on, direction, amount, currency, description, reference,
          source_type, source_reference, expected_amount, variance, match_status, notes,
          status, created_at, updated_at, voided_at, void_reason
        from filtered
        order by occurred_on desc, created_at desc
        limit v_limit
      ) x
    ), '[]'::jsonb),
    'unmatchedStripePayouts', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.arrival_date desc nulls last, x.stripe_created_at desc)
      from (
        select stripe_payout_id, amount, currency, status, method, payout_type,
          automatic, arrival_date, stripe_created_at, updated_at
        from unmatched_payouts
        order by arrival_date desc nulls last, stripe_created_at desc
        limit v_limit
      ) x
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select ev.id, ev.bank_entry_id, ev.event_type, ev.reason, ev.created_at
        from public.finance_bank_entry_events ev
        join filtered b on b.id=ev.bank_entry_id
        order by ev.created_at desc
        limit least(v_limit*4,2000)
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

create or replace function public.create_admin_bank_entry(
  p_occurred_on date,
  p_direction text,
  p_amount numeric,
  p_description text,
  p_reference text default null,
  p_source_type text default 'other',
  p_source_reference text default null,
  p_expected_amount numeric default null,
  p_notes text default null
) returns jsonb
language sql
set search_path = pg_catalog, public, private
as $function$
  select private.finance_create_bank_entry_impl(
    p_occurred_on,p_direction,p_amount,p_description,p_reference,p_source_type,
    p_source_reference,p_expected_amount,p_notes
  );
$function$;

create or replace function public.void_admin_bank_entry(
  p_bank_entry_id uuid,
  p_reason text
) returns jsonb
language sql
set search_path = pg_catalog, public, private
as $function$
  select private.finance_void_bank_entry_impl(p_bank_entry_id,p_reason);
$function$;

create or replace function public.get_admin_bank_reconciliation(
  p_from date default null,
  p_to date default null,
  p_limit integer default 500
) returns jsonb
language sql
stable
set search_path = pg_catalog, public, private
as $function$
  select private.finance_get_bank_reconciliation_impl(p_from,p_to,p_limit);
$function$;

revoke all on function public.create_admin_bank_entry(date,text,numeric,text,text,text,text,numeric,text) from public, anon;
revoke all on function public.void_admin_bank_entry(uuid,text) from public, anon;
revoke all on function public.get_admin_bank_reconciliation(date,date,integer) from public, anon;
grant execute on function public.create_admin_bank_entry(date,text,numeric,text,text,text,text,numeric,text) to authenticated;
grant execute on function public.void_admin_bank_entry(uuid,text) to authenticated;
grant execute on function public.get_admin_bank_reconciliation(date,date,integer) to authenticated;

revoke all on function private.finance_create_bank_entry_impl(date,text,numeric,text,text,text,text,numeric,text) from public, anon;
revoke all on function private.finance_void_bank_entry_impl(uuid,text) from public, anon;
revoke all on function private.finance_get_bank_reconciliation_impl(date,date,integer) from public, anon;
grant execute on function private.finance_create_bank_entry_impl(date,text,numeric,text,text,text,text,numeric,text) to authenticated;
grant execute on function private.finance_void_bank_entry_impl(uuid,text) to authenticated;
grant execute on function private.finance_get_bank_reconciliation_impl(date,date,integer) to authenticated;
