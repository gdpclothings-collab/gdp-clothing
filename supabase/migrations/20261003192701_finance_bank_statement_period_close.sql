create table if not exists public.finance_bank_statement_reconciliations (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  opening_balance numeric(14,2) not null,
  status text not null default 'open' check (status in ('open','closed')),
  credit_snapshot numeric(14,2) not null default 0,
  debit_snapshot numeric(14,2) not null default 0,
  entry_count_snapshot integer not null default 0 check (entry_count_snapshot >= 0),
  book_closing_balance numeric(14,2),
  statement_closing_balance numeric(14,2),
  variance numeric(14,2),
  notes text,
  close_notes text,
  opened_at timestamptz not null default now(),
  opened_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  reopen_count integer not null default 0 check (reopen_count >= 0),
  last_reopened_at timestamptz,
  last_reopened_by uuid references auth.users(id) on delete set null,
  last_reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_bank_statement_period_order check (period_start <= period_end),
  constraint finance_bank_statement_notes_length check (char_length(coalesce(notes,'')) <= 1000),
  constraint finance_bank_statement_close_notes_length check (char_length(coalesce(close_notes,'')) <= 1000),
  constraint finance_bank_statement_reopen_reason_length check (char_length(coalesce(last_reopen_reason,'')) <= 500),
  constraint finance_bank_statement_closed_shape check (
    (status = 'open') or
    (closed_at is not null and statement_closing_balance is not null and book_closing_balance is not null and variance is not null)
  )
);

alter table public.finance_bank_statement_reconciliations
  add constraint finance_bank_statement_no_overlap
  exclude using gist (daterange(period_start, period_end, '[]') with &&);

create index if not exists finance_bank_statement_status_end_idx
  on public.finance_bank_statement_reconciliations (status, period_end desc);
create index if not exists finance_bank_statement_opened_by_idx
  on public.finance_bank_statement_reconciliations (opened_by);

create table if not exists public.finance_bank_statement_events (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references public.finance_bank_statement_reconciliations(id) on delete restrict,
  event_type text not null check (event_type in ('opened','closed','reopened')),
  reason text,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finance_bank_statement_event_reason_length check (char_length(coalesce(reason,'')) <= 500),
  constraint finance_bank_statement_event_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists finance_bank_statement_events_reconciliation_idx
  on public.finance_bank_statement_events (reconciliation_id, created_at desc);
create index if not exists finance_bank_statement_events_created_by_idx
  on public.finance_bank_statement_events (created_by);

alter table public.finance_bank_statement_reconciliations enable row level security;
alter table public.finance_bank_statement_events enable row level security;

drop policy if exists finance_bank_statement_admin_read on public.finance_bank_statement_reconciliations;
create policy finance_bank_statement_admin_read
  on public.finance_bank_statement_reconciliations for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_bank_statement_events_admin_read on public.finance_bank_statement_events;
create policy finance_bank_statement_events_admin_read
  on public.finance_bank_statement_events for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

revoke all on table public.finance_bank_statement_reconciliations from public, anon, authenticated;
revoke all on table public.finance_bank_statement_events from public, anon, authenticated;
grant select on table public.finance_bank_statement_reconciliations to authenticated;
grant select on table public.finance_bank_statement_events to authenticated;
grant all on table public.finance_bank_statement_reconciliations to service_role;
grant all on table public.finance_bank_statement_events to service_role;

create or replace function private.finance_bank_date_locked(p_date date)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.finance_bank_statement_reconciliations s
    where s.status = 'closed'
      and p_date between s.period_start and s.period_end
  );
$function$;

revoke all on function private.finance_bank_date_locked(date) from public, anon, authenticated;

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
  if private.finance_bank_date_locked(p_occurred_on) then
    raise exception 'bank statement period is closed; reopen it before changing bank activity' using errcode = '55000';
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
set search_path = pg_catalog
as $function$
declare
  v_before public.finance_bank_entries;
  v_after public.finance_bank_entries;
  v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
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
  if private.finance_bank_date_locked(v_before.occurred_on) then
    raise exception 'bank statement period is closed; reopen it before voiding bank activity' using errcode = '55000';
  end if;

  update public.finance_bank_entries
  set status='voided', voided_at=now(), voided_by=auth.uid(), void_reason=v_reason, updated_at=now()
  where id=p_bank_entry_id
  returning * into v_after;

  update public.finance_bank_import_rows
  set active = false
  where bank_entry_id = p_bank_entry_id and active;

  insert into public.finance_bank_entry_events (bank_entry_id, event_type, reason, snapshot, created_by)
  values (v_after.id, 'voided', v_reason, to_jsonb(v_after), auth.uid());

  return to_jsonb(v_after);
end;
$function$;

create or replace function private.finance_preview_bank_import_impl(p_rows jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_count integer;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'bank import rows must be an array' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count < 1 or v_count > 1000 then
    raise exception 'bank import preview must contain between 1 and 1000 rows' using errcode = '22023';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'clientKey', x.item->>'clientKey',
      'fingerprint', x.fingerprint,
      'duplicate', (r.id is not null),
      'existingBankEntryId', r.bank_entry_id,
      'locked', (locked.id is not null),
      'lockedStatementId', locked.id,
      'lockedPeriodStart', locked.period_start,
      'lockedPeriodEnd', locked.period_end
    ) order by x.ordinality), '[]'::jsonb)
    from (
      select e.item, e.ordinality, private.finance_bank_import_row_fingerprint(e.item) as fingerprint
      from jsonb_array_elements(p_rows) with ordinality as e(item, ordinality)
    ) x
    left join public.finance_bank_import_rows r
      on r.row_fingerprint = x.fingerprint and r.active
    left join lateral (
      select s.id, s.period_start, s.period_end
      from public.finance_bank_statement_reconciliations s
      where s.status = 'closed'
        and (x.item->>'occurredOn')::date between s.period_start and s.period_end
      limit 1
    ) locked on true
  );
end;
$function$;

create or replace function private.finance_create_bank_statement_reconciliation_impl(
  p_period_start date,
  p_period_end date,
  p_opening_balance numeric,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_row public.finance_bank_statement_reconciliations;
  v_notes text := nullif(btrim(coalesce(p_notes,'')), '');
  v_opening numeric := round(coalesce(p_opening_balance,0),2);
  v_today date := (now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null or p_period_start > p_period_end then
    raise exception 'valid bank statement start and end dates are required' using errcode = '22023';
  end if;
  if p_period_end > v_today then
    raise exception 'bank statement period cannot end in the future' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes,'')) > 1000 then
    raise exception 'bank statement notes are too long' using errcode = '22001';
  end if;

  insert into public.finance_bank_statement_reconciliations (
    period_start, period_end, opening_balance, notes, opened_by
  ) values (
    p_period_start, p_period_end, v_opening, v_notes, auth.uid()
  ) returning * into v_row;

  insert into public.finance_bank_statement_events (reconciliation_id, event_type, snapshot, created_by)
  values (v_row.id, 'opened', to_jsonb(v_row), auth.uid());

  return to_jsonb(v_row);
exception
  when exclusion_violation then
    raise exception 'bank statement periods cannot overlap an existing reconciliation period' using errcode = '23P01';
end;
$function$;

create or replace function private.finance_close_bank_statement_reconciliation_impl(
  p_reconciliation_id uuid,
  p_statement_closing_balance numeric,
  p_close_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_before public.finance_bank_statement_reconciliations;
  v_after public.finance_bank_statement_reconciliations;
  v_credit numeric := 0;
  v_debit numeric := 0;
  v_count integer := 0;
  v_book numeric;
  v_statement numeric;
  v_variance numeric;
  v_notes text := nullif(btrim(coalesce(p_close_notes,'')), '');
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_reconciliation_id is null or p_statement_closing_balance is null then
    raise exception 'bank reconciliation and statement closing balance are required' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes,'')) > 1000 then
    raise exception 'bank statement close notes are too long' using errcode = '22001';
  end if;

  select * into v_before
  from public.finance_bank_statement_reconciliations
  where id = p_reconciliation_id
  for update;
  if v_before.id is null then
    raise exception 'bank statement reconciliation not found' using errcode = 'P0002';
  end if;
  if v_before.status <> 'open' then
    raise exception 'bank statement reconciliation is already closed' using errcode = '22023';
  end if;

  select
    coalesce(sum(amount) filter (where direction='credit'),0),
    coalesce(sum(amount) filter (where direction='debit'),0),
    count(*)::integer
  into v_credit, v_debit, v_count
  from public.finance_bank_entries
  where status='active'
    and occurred_on between v_before.period_start and v_before.period_end;

  v_credit := round(v_credit,2);
  v_debit := round(v_debit,2);
  v_book := round(v_before.opening_balance + v_credit - v_debit,2);
  v_statement := round(p_statement_closing_balance,2);
  v_variance := round(v_statement - v_book,2);

  if v_variance <> 0 then
    raise exception 'bank statement does not reconcile; difference is %', v_variance using errcode = '22023';
  end if;

  update public.finance_bank_statement_reconciliations
  set status='closed',
      credit_snapshot=v_credit,
      debit_snapshot=v_debit,
      entry_count_snapshot=v_count,
      book_closing_balance=v_book,
      statement_closing_balance=v_statement,
      variance=v_variance,
      close_notes=v_notes,
      closed_at=now(),
      closed_by=auth.uid(),
      updated_at=now()
  where id=v_before.id
  returning * into v_after;

  insert into public.finance_bank_statement_events (reconciliation_id, event_type, snapshot, created_by)
  values (v_after.id, 'closed', to_jsonb(v_after), auth.uid());

  return to_jsonb(v_after);
end;
$function$;

create or replace function private.finance_reopen_bank_statement_reconciliation_impl(
  p_reconciliation_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_before public.finance_bank_statement_reconciliations;
  v_after public.finance_bank_statement_reconciliations;
  v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_reconciliation_id is null then
    raise exception 'bank reconciliation is required' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'reopen reason is required' using errcode = '22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'reopen reason is too long' using errcode = '22001';
  end if;

  select * into v_before
  from public.finance_bank_statement_reconciliations
  where id=p_reconciliation_id
  for update;
  if v_before.id is null then
    raise exception 'bank statement reconciliation not found' using errcode = 'P0002';
  end if;
  if v_before.status <> 'closed' then
    raise exception 'bank statement reconciliation is already open' using errcode = '22023';
  end if;

  insert into public.finance_bank_statement_events (reconciliation_id, event_type, reason, snapshot, created_by)
  values (v_before.id, 'reopened', v_reason, to_jsonb(v_before), auth.uid());

  update public.finance_bank_statement_reconciliations
  set status='open',
      credit_snapshot=0,
      debit_snapshot=0,
      entry_count_snapshot=0,
      book_closing_balance=null,
      statement_closing_balance=null,
      variance=null,
      close_notes=null,
      closed_at=null,
      closed_by=null,
      reopen_count=reopen_count+1,
      last_reopened_at=now(),
      last_reopened_by=auth.uid(),
      last_reopen_reason=v_reason,
      updated_at=now()
  where id=v_before.id
  returning * into v_after;

  return to_jsonb(v_after);
end;
$function$;

create or replace function private.finance_get_bank_statement_reconciliations_impl(
  p_from date default null,
  p_to date default null,
  p_limit integer default 100
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_limit integer := greatest(10, least(500, coalesce(p_limit,100)));
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  return (
    with base as (
      select s.*,
        coalesce((select sum(b.amount) from public.finance_bank_entries b where b.status='active' and b.direction='credit' and b.occurred_on between s.period_start and s.period_end),0)::numeric as live_credit,
        coalesce((select sum(b.amount) from public.finance_bank_entries b where b.status='active' and b.direction='debit' and b.occurred_on between s.period_start and s.period_end),0)::numeric as live_debit,
        coalesce((select count(*) from public.finance_bank_entries b where b.status='active' and b.occurred_on between s.period_start and s.period_end),0)::integer as live_count
      from public.finance_bank_statement_reconciliations s
      where (p_from is null or s.period_end >= p_from)
        and (p_to is null or s.period_start <= p_to)
    ), computed as (
      select
        id, period_start, period_end, opening_balance, status, notes, close_notes,
        opened_at, opened_by, closed_at, closed_by, reopen_count,
        last_reopened_at, last_reopened_by, last_reopen_reason, created_at, updated_at,
        case when status='closed' then credit_snapshot else round(live_credit,2) end as credit_total,
        case when status='closed' then debit_snapshot else round(live_debit,2) end as debit_total,
        case when status='closed' then entry_count_snapshot else live_count end as entry_count,
        case when status='closed' then book_closing_balance else round(opening_balance + live_credit - live_debit,2) end as calculated_closing_balance,
        statement_closing_balance,
        variance
      from base
    ), limited as (
      select * from computed order by period_end desc, created_at desc limit v_limit
    )
    select jsonb_build_object(
      'generatedAt', now(),
      'metrics', jsonb_build_object(
        'openCount', coalesce((select count(*) from base where status='open'),0),
        'closedCount', coalesce((select count(*) from base where status='closed'),0),
        'lockedEntryCount', coalesce((select sum(entry_count_snapshot) from base where status='closed'),0),
        'latestClosedPeriodEnd', (select max(period_end) from base where status='closed')
      ),
      'statements', coalesce((select jsonb_agg(to_jsonb(l) order by l.period_end desc, l.created_at desc) from limited l), '[]'::jsonb),
      'events', coalesce((
        select jsonb_agg(to_jsonb(e) order by e.created_at desc)
        from (
          select ev.id, ev.reconciliation_id, ev.event_type, ev.reason, ev.created_at
          from public.finance_bank_statement_events ev
          join base b on b.id=ev.reconciliation_id
          order by ev.created_at desc
          limit least(v_limit*5,1000)
        ) e
      ), '[]'::jsonb)
    )
  );
end;
$function$;

create or replace function public.create_admin_bank_statement_reconciliation(
  p_period_start date,
  p_period_end date,
  p_opening_balance numeric,
  p_notes text default null
) returns jsonb
language sql
set search_path = pg_catalog
as $function$
  select private.finance_create_bank_statement_reconciliation_impl(p_period_start,p_period_end,p_opening_balance,p_notes);
$function$;

create or replace function public.close_admin_bank_statement_reconciliation(
  p_reconciliation_id uuid,
  p_statement_closing_balance numeric,
  p_close_notes text default null
) returns jsonb
language sql
set search_path = pg_catalog
as $function$
  select private.finance_close_bank_statement_reconciliation_impl(p_reconciliation_id,p_statement_closing_balance,p_close_notes);
$function$;

create or replace function public.reopen_admin_bank_statement_reconciliation(
  p_reconciliation_id uuid,
  p_reason text
) returns jsonb
language sql
set search_path = pg_catalog
as $function$
  select private.finance_reopen_bank_statement_reconciliation_impl(p_reconciliation_id,p_reason);
$function$;

create or replace function public.get_admin_bank_statement_reconciliations(
  p_from date default null,
  p_to date default null,
  p_limit integer default 100
) returns jsonb
language sql
stable
set search_path = pg_catalog
as $function$
  select private.finance_get_bank_statement_reconciliations_impl(p_from,p_to,p_limit);
$function$;

revoke all on function public.create_admin_bank_statement_reconciliation(date,date,numeric,text) from public, anon;
revoke all on function public.close_admin_bank_statement_reconciliation(uuid,numeric,text) from public, anon;
revoke all on function public.reopen_admin_bank_statement_reconciliation(uuid,text) from public, anon;
revoke all on function public.get_admin_bank_statement_reconciliations(date,date,integer) from public, anon;
grant execute on function public.create_admin_bank_statement_reconciliation(date,date,numeric,text) to authenticated;
grant execute on function public.close_admin_bank_statement_reconciliation(uuid,numeric,text) to authenticated;
grant execute on function public.reopen_admin_bank_statement_reconciliation(uuid,text) to authenticated;
grant execute on function public.get_admin_bank_statement_reconciliations(date,date,integer) to authenticated;

revoke all on function private.finance_create_bank_statement_reconciliation_impl(date,date,numeric,text) from public, anon;
revoke all on function private.finance_close_bank_statement_reconciliation_impl(uuid,numeric,text) from public, anon;
revoke all on function private.finance_reopen_bank_statement_reconciliation_impl(uuid,text) from public, anon;
revoke all on function private.finance_get_bank_statement_reconciliations_impl(date,date,integer) from public, anon;
grant execute on function private.finance_create_bank_statement_reconciliation_impl(date,date,numeric,text) to authenticated;
grant execute on function private.finance_close_bank_statement_reconciliation_impl(uuid,numeric,text) to authenticated;
grant execute on function private.finance_reopen_bank_statement_reconciliation_impl(uuid,text) to authenticated;
grant execute on function private.finance_get_bank_statement_reconciliations_impl(date,date,integer) to authenticated;
