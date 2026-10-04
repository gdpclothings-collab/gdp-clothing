begin;

create table if not exists public.finance_accounting_period_closes (
  id uuid primary key default gen_random_uuid(),
  period_start date not null unique,
  period_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  close_notes text,
  close_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  reopen_count integer not null default 0 check (reopen_count >= 0),
  last_reopened_by uuid references auth.users(id) on delete set null,
  last_reopened_at timestamptz,
  last_reopen_reason text,
  constraint finance_accounting_period_month_start check (
    period_start = date_trunc('month', period_start::timestamp)::date
  ),
  constraint finance_accounting_period_month_end check (
    period_end = (date_trunc('month', period_start::timestamp) + interval '1 month - 1 day')::date
  ),
  constraint finance_accounting_period_notes_len check (close_notes is null or char_length(close_notes) <= 1500),
  constraint finance_accounting_period_reopen_reason_len check (last_reopen_reason is null or char_length(last_reopen_reason) between 1 and 500),
  constraint finance_accounting_period_snapshot_object check (jsonb_typeof(close_snapshot) = 'object'),
  constraint finance_accounting_period_closed_shape check (
    status = 'open' or (closed_by is not null and closed_at is not null)
  )
);

create table if not exists public.finance_accounting_period_events (
  id bigint generated always as identity primary key,
  period_close_id uuid not null references public.finance_accounting_period_closes(id) on delete restrict,
  event_type text not null check (event_type in ('closed','reopened')),
  reason text,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finance_accounting_period_event_reason_len check (reason is null or char_length(reason) <= 500),
  constraint finance_accounting_period_event_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists finance_accounting_period_status_end_idx
  on public.finance_accounting_period_closes(status,period_end desc);
create index if not exists finance_accounting_period_created_by_idx
  on public.finance_accounting_period_closes(created_by) where created_by is not null;
create index if not exists finance_accounting_period_updated_by_idx
  on public.finance_accounting_period_closes(updated_by) where updated_by is not null;
create index if not exists finance_accounting_period_closed_by_idx
  on public.finance_accounting_period_closes(closed_by) where closed_by is not null;
create index if not exists finance_accounting_period_reopened_by_idx
  on public.finance_accounting_period_closes(last_reopened_by) where last_reopened_by is not null;
create index if not exists finance_accounting_period_events_period_idx
  on public.finance_accounting_period_events(period_close_id,created_at desc,id desc);
create index if not exists finance_accounting_period_events_created_by_idx
  on public.finance_accounting_period_events(created_by) where created_by is not null;

alter table public.finance_accounting_period_closes enable row level security;
alter table public.finance_accounting_period_events enable row level security;

revoke all on table public.finance_accounting_period_closes from public,anon,authenticated;
revoke all on table public.finance_accounting_period_events from public,anon,authenticated;
grant select on table public.finance_accounting_period_closes to authenticated;
grant select on table public.finance_accounting_period_events to authenticated;
grant all on table public.finance_accounting_period_closes to service_role;
grant all on table public.finance_accounting_period_events to service_role;

drop policy if exists finance_accounting_period_closes_admin_select on public.finance_accounting_period_closes;
create policy finance_accounting_period_closes_admin_select
  on public.finance_accounting_period_closes for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_accounting_period_events_admin_select on public.finance_accounting_period_events;
create policy finance_accounting_period_events_admin_select
  on public.finance_accounting_period_events for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

create or replace function private.finance_accounting_period_date_locked(p_date date)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog
as $$
  select exists (
    select 1
    from public.finance_accounting_period_closes c
    where c.status='closed'
      and p_date between c.period_start and c.period_end
  );
$$;

create or replace function private.finance_guard_accounting_period_date()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_close public.finance_accounting_period_closes;
begin
  select * into v_close
  from public.finance_accounting_period_closes c
  where c.status='closed'
    and new.entry_date between c.period_start and c.period_end
  order by c.period_end desc
  limit 1;

  if v_close.id is not null then
    raise exception 'accounting period % through % is closed; reopen the period before posting or backdating ledger activity',v_close.period_start,v_close.period_end using errcode='55000';
  end if;

  return new;
end;
$$;

drop trigger if exists finance_journal_entries_accounting_period_guard on public.finance_journal_entries;
create trigger finance_journal_entries_accounting_period_guard
before insert or update of entry_date on public.finance_journal_entries
for each row execute function private.finance_guard_accounting_period_date();

create or replace function private.finance_accounting_period_close_checklist(p_period_start date)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_today date := (now() at time zone 'America/Regina')::date;
  v_start date;
  v_end date;
  v_cutover public.finance_opening_balance_cutovers;
  v_existing public.finance_accounting_period_closes;
  v_latest_closed public.finance_accounting_period_closes;
  v_first_activity date;
  v_expected_start date;
  v_unresolved_failures integer := 0;
  v_pending_cogs integer := 0;
  v_ledger_debits numeric(18,2) := 0;
  v_ledger_credits numeric(18,2) := 0;
  v_ledger_difference numeric(18,2) := 0;
  v_period_journal_count integer := 0;
  v_cash_activity_days integer := 0;
  v_cash_unclosed_days integer := 0;
  v_bank_entry_count integer := 0;
  v_bank_unreconciled_entries integer := 0;
  v_period_complete boolean := false;
  v_sequence_ok boolean := false;
  v_opening_ok boolean := false;
  v_closable boolean := false;
  v_reasons jsonb := '[]'::jsonb;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  if p_period_start is null then
    raise exception 'accounting period month is required' using errcode='22023';
  end if;

  v_start := date_trunc('month',p_period_start::timestamp)::date;
  if p_period_start <> v_start then
    raise exception 'accounting period start must be the first day of a month' using errcode='22023';
  end if;
  v_end := (date_trunc('month',v_start::timestamp) + interval '1 month - 1 day')::date;
  v_period_complete := v_end < date_trunc('month',v_today::timestamp)::date;

  select * into v_cutover
  from public.finance_opening_balance_cutovers
  where status='posted'
  order by posted_at desc nulls last,updated_at desc
  limit 1;

  select min(entry_date) into v_first_activity
  from public.finance_journal_entries
  where source_type not in ('opening_balance','opening_reversal');

  select * into v_latest_closed
  from public.finance_accounting_period_closes
  where status='closed'
  order by period_end desc
  limit 1;

  select * into v_existing
  from public.finance_accounting_period_closes
  where period_start=v_start
  limit 1;

  if v_latest_closed.id is not null then
    v_expected_start := v_latest_closed.period_end + 1;
  elsif v_first_activity is not null then
    v_expected_start := date_trunc('month',v_first_activity::timestamp)::date;
  elsif v_cutover.id is not null then
    v_expected_start := date_trunc('month',v_cutover.cutover_date::timestamp)::date;
  else
    v_expected_start := null;
  end if;

  v_sequence_ok := v_expected_start is not null and v_start=v_expected_start;
  v_opening_ok := v_cutover.id is not null and v_cutover.cutover_date<=v_end;

  select count(*)::integer into v_unresolved_failures
  from public.finance_ledger_posting_failures
  where resolved_at is null;

  select count(*)::integer into v_pending_cogs
  from public.orders o
  where coalesce(o.payment_mode,'live')='live'
    and o.payment_status in ('paid','refunded','partially_refunded')
    and (coalesce(o.updated_at,o.created_at,now()) at time zone 'America/Regina')::date<=v_end
    and exists(
      select 1
      from public.order_items oi
      left join public.finance_order_item_costs c on c.order_item_id=oi.id
      where oi.order_id=o.id and not coalesce(c.is_configured,false)
    );

  select
    round(coalesce(sum(l.debit),0),2),
    round(coalesce(sum(l.credit),0),2)
  into v_ledger_debits,v_ledger_credits
  from public.finance_journal_lines l
  join public.finance_journal_entries e on e.id=l.entry_id
  where e.entry_date<=v_end and e.status in ('posted','reversed');
  v_ledger_difference := round(v_ledger_debits-v_ledger_credits,2);

  select count(*)::integer into v_period_journal_count
  from public.finance_journal_entries e
  where e.entry_date between v_start and v_end;

  with cash_dates as (
    select distinct (s.occurred_at at time zone 'America/Regina')::date as business_date
    from public.finance_manual_sales s
    where s.status='paid'
      and lower(trim(coalesce(s.payment_method,'')))='cash'
      and (s.occurred_at at time zone 'America/Regina')::date between v_start and v_end
    union
    select distinct e.occurred_on as business_date
    from public.finance_expenses e
    where e.status='active'
      and lower(trim(coalesce(e.payment_method,'')))='cash'
      and e.occurred_on between v_start and v_end
  )
  select
    count(*)::integer,
    count(*) filter (where not exists(
      select 1
      from public.finance_cash_reconciliations r
      where r.status='closed' and r.business_date=c.business_date
    ))::integer
  into v_cash_activity_days,v_cash_unclosed_days
  from cash_dates c;

  select
    count(*)::integer,
    count(*) filter (where not exists(
      select 1
      from public.finance_bank_statement_reconciliations r
      where r.status='closed' and b.occurred_on between r.period_start and r.period_end
    ))::integer
  into v_bank_entry_count,v_bank_unreconciled_entries
  from public.finance_bank_entries b
  where b.status='active' and b.occurred_on between v_start and v_end;

  if v_existing.id is not null and v_existing.status='closed' then
    v_reasons := v_reasons || jsonb_build_array('This accounting period is already closed.');
  end if;
  if not v_period_complete then
    v_reasons := v_reasons || jsonb_build_array('Only fully completed calendar months can be closed.');
  end if;
  if not v_sequence_ok then
    if v_expected_start is null then
      v_reasons := v_reasons || jsonb_build_array('No opening cutover or operational GL activity exists to establish the first close month.');
    else
      v_reasons := v_reasons || jsonb_build_array(concat('Close periods in sequence. The next eligible month starts ',v_expected_start,'.'));
    end if;
  end if;
  if not v_opening_ok then
    v_reasons := v_reasons || jsonb_build_array('A real posted opening-balance cutover is required before accounting periods can be closed.');
  end if;
  if v_unresolved_failures>0 then
    v_reasons := v_reasons || jsonb_build_array(concat(v_unresolved_failures,' unresolved source-to-ledger posting failure(s) must be resolved.'));
  end if;
  if v_pending_cogs>0 then
    v_reasons := v_reasons || jsonb_build_array(concat(v_pending_cogs,' paid order(s) through the period end still need complete COGS configuration.'));
  end if;
  if v_ledger_difference<>0 then
    v_reasons := v_reasons || jsonb_build_array(concat('General Ledger is out of balance by ',v_ledger_difference,'.'));
  end if;
  if v_cash_unclosed_days>0 then
    v_reasons := v_reasons || jsonb_build_array(concat(v_cash_unclosed_days,' cash activity day(s) still need Cash Close.'));
  end if;
  if v_bank_unreconciled_entries>0 then
    v_reasons := v_reasons || jsonb_build_array(concat(v_bank_unreconciled_entries,' active bank entry/entries are not covered by a closed bank statement reconciliation.'));
  end if;

  v_closable := (
    (v_existing.id is null or v_existing.status='open')
    and v_period_complete
    and v_sequence_ok
    and v_opening_ok
    and v_unresolved_failures=0
    and v_pending_cogs=0
    and v_ledger_difference=0
    and v_cash_unclosed_days=0
    and v_bank_unreconciled_entries=0
  );

  return jsonb_build_object(
    'periodStart',v_start,
    'periodEnd',v_end,
    'periodComplete',v_period_complete,
    'expectedNextPeriodStart',v_expected_start,
    'sequenceOkay',v_sequence_ok,
    'alreadyClosed',(v_existing.id is not null and v_existing.status='closed'),
    'openingCutover',case when v_cutover.id is null then null else jsonb_build_object(
      'id',v_cutover.id,'cutoverDate',v_cutover.cutover_date,'postedAt',v_cutover.posted_at
    ) end,
    'openingCutoverReady',v_opening_ok,
    'unresolvedSourceFailures',v_unresolved_failures,
    'pendingCogsOrders',v_pending_cogs,
    'ledger',jsonb_build_object(
      'journalCountThroughPeriod',(
        select count(*) from public.finance_journal_entries e where e.entry_date<=v_end
      ),
      'periodJournalCount',v_period_journal_count,
      'totalDebits',v_ledger_debits,
      'totalCredits',v_ledger_credits,
      'difference',v_ledger_difference,
      'balanced',(v_ledger_difference=0)
    ),
    'cashClose',jsonb_build_object(
      'activityDays',v_cash_activity_days,
      'unclosedActivityDays',v_cash_unclosed_days,
      'ready',(v_cash_unclosed_days=0)
    ),
    'bankClose',jsonb_build_object(
      'activeEntries',v_bank_entry_count,
      'unreconciledEntries',v_bank_unreconciled_entries,
      'ready',(v_bank_unreconciled_entries=0)
    ),
    'closable',v_closable,
    'blockedReasons',v_reasons,
    'isCalendarYearEnd',(extract(month from v_end)=12),
    'yearEndNote','Monthly close does not auto-post retained earnings or year-end closing entries.'
  );
end;
$$;

create or replace function private.finance_get_accounting_period_close_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_first_activity date;
  v_cutover public.finance_opening_balance_cutovers;
  v_latest_closed public.finance_accounting_period_closes;
  v_suggested_start date;
  v_checklist jsonb;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;

  select min(entry_date) into v_first_activity
  from public.finance_journal_entries
  where source_type not in ('opening_balance','opening_reversal');

  select * into v_cutover
  from public.finance_opening_balance_cutovers
  where status='posted'
  order by posted_at desc nulls last,updated_at desc
  limit 1;

  select * into v_latest_closed
  from public.finance_accounting_period_closes
  where status='closed'
  order by period_end desc
  limit 1;

  if v_latest_closed.id is not null then
    v_suggested_start := v_latest_closed.period_end+1;
  elsif v_first_activity is not null then
    v_suggested_start := date_trunc('month',v_first_activity::timestamp)::date;
  elsif v_cutover.id is not null then
    v_suggested_start := date_trunc('month',v_cutover.cutover_date::timestamp)::date;
  else
    v_suggested_start := null;
  end if;

  if v_suggested_start is not null then
    v_checklist := private.finance_accounting_period_close_checklist(v_suggested_start);
  end if;

  return jsonb_build_object(
    'generatedAt',now(),
    'firstOperationalActivityDate',v_first_activity,
    'activeOpeningCutover',case when v_cutover.id is null then null else jsonb_build_object(
      'id',v_cutover.id,'cutoverDate',v_cutover.cutover_date,'postedAt',v_cutover.posted_at
    ) end,
    'latestClosedPeriod',case when v_latest_closed.id is null then null else jsonb_build_object(
      'id',v_latest_closed.id,'periodStart',v_latest_closed.period_start,'periodEnd',v_latest_closed.period_end,
      'closedAt',v_latest_closed.closed_at,'reopenCount',v_latest_closed.reopen_count
    ) end,
    'suggestedPeriodStart',v_suggested_start,
    'checklist',v_checklist,
    'periods',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'periodStart',c.period_start,'periodEnd',c.period_end,'status',c.status,
        'closeNotes',c.close_notes,'closeSnapshot',c.close_snapshot,
        'createdAt',c.created_at,'updatedAt',c.updated_at,'closedAt',c.closed_at,
        'reopenCount',c.reopen_count,'lastReopenedAt',c.last_reopened_at,
        'lastReopenReason',c.last_reopen_reason
      ) order by c.period_start desc)
      from public.finance_accounting_period_closes c
    ),'[]'::jsonb),
    'policy',jsonb_build_object(
      'calendarMonthlyClose',true,
      'closeSequentially',true,
      'closedPeriodJournalLock',true,
      'retainedEarningsAutoPost',false,
      'hardDeleteAllowed',false
    )
  );
end;
$$;

create or replace function private.finance_preview_accounting_period_close_impl(p_period_start date)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  return private.finance_accounting_period_close_checklist(p_period_start);
end;
$$;

create or replace function private.finance_close_accounting_period_impl(
  p_period_start date,
  p_close_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_checklist jsonb;
  v_row public.finance_accounting_period_closes;
  v_start date;
  v_end date;
  v_notes text:=nullif(trim(coalesce(p_close_notes,'')),'');
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  if p_period_start is null then
    raise exception 'accounting period month is required' using errcode='22023';
  end if;
  if v_notes is not null and char_length(v_notes)>1500 then
    raise exception 'accounting period close notes are too long' using errcode='22001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gdp-finance-accounting-period-close',0));

  v_start:=date_trunc('month',p_period_start::timestamp)::date;
  if p_period_start<>v_start then
    raise exception 'accounting period start must be the first day of a month' using errcode='22023';
  end if;
  v_end:=(date_trunc('month',v_start::timestamp)+interval '1 month - 1 day')::date;
  v_checklist:=private.finance_accounting_period_close_checklist(v_start);

  if not coalesce((v_checklist->>'closable')::boolean,false) then
    raise exception 'accounting period is not ready to close; review the close checklist' using errcode='55000';
  end if;

  insert into public.finance_accounting_period_closes(
    period_start,period_end,status,close_notes,close_snapshot,
    created_by,created_at,updated_by,updated_at,closed_by,closed_at
  ) values(
    v_start,v_end,'closed',v_notes,v_checklist,
    auth.uid(),now(),auth.uid(),now(),auth.uid(),now()
  )
  on conflict(period_start) do update set
    period_end=excluded.period_end,
    status='closed',
    close_notes=excluded.close_notes,
    close_snapshot=excluded.close_snapshot,
    updated_by=auth.uid(),
    updated_at=now(),
    closed_by=auth.uid(),
    closed_at=now()
  where public.finance_accounting_period_closes.status='open'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'accounting period is already closed' using errcode='55000';
  end if;

  insert into public.finance_accounting_period_events(period_close_id,event_type,reason,snapshot,created_by)
  values(v_row.id,'closed',v_notes,jsonb_build_object('period',to_jsonb(v_row),'checklist',v_checklist),auth.uid());

  return jsonb_build_object('period',to_jsonb(v_row),'checklist',v_checklist);
end;
$$;

create or replace function private.finance_reopen_accounting_period_impl(
  p_period_close_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_before public.finance_accounting_period_closes;
  v_after public.finance_accounting_period_closes;
  v_latest_id uuid;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  if p_period_close_id is null then
    raise exception 'accounting period is required' using errcode='22023';
  end if;
  if v_reason is null then
    raise exception 'reopen reason is required' using errcode='22023';
  end if;
  if char_length(v_reason)>500 then
    raise exception 'reopen reason is too long' using errcode='22001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gdp-finance-accounting-period-close',0));

  select id into v_latest_id
  from public.finance_accounting_period_closes
  where status='closed'
  order by period_end desc
  limit 1;

  select * into v_before
  from public.finance_accounting_period_closes
  where id=p_period_close_id
  for update;

  if v_before.id is null then
    raise exception 'accounting period close not found' using errcode='P0002';
  end if;
  if v_before.status<>'closed' then
    raise exception 'accounting period is already open' using errcode='22023';
  end if;
  if v_latest_id is distinct from v_before.id then
    raise exception 'reopen accounting periods in reverse chronological order; reopen the latest closed month first' using errcode='55000';
  end if;

  update public.finance_accounting_period_closes
  set status='open',
      reopen_count=reopen_count+1,
      last_reopened_by=auth.uid(),
      last_reopened_at=now(),
      last_reopen_reason=v_reason,
      updated_by=auth.uid(),
      updated_at=now()
  where id=v_before.id
  returning * into v_after;

  insert into public.finance_accounting_period_events(period_close_id,event_type,reason,snapshot,created_by)
  values(v_after.id,'reopened',v_reason,jsonb_build_object('before',to_jsonb(v_before),'after',to_jsonb(v_after)),auth.uid());

  return jsonb_build_object('period',to_jsonb(v_after));
end;
$$;

revoke all on function private.finance_accounting_period_date_locked(date) from public,anon,authenticated;
revoke all on function private.finance_guard_accounting_period_date() from public,anon,authenticated;
revoke all on function private.finance_accounting_period_close_checklist(date) from public,anon,authenticated;
grant execute on function private.finance_accounting_period_date_locked(date) to service_role;
grant execute on function private.finance_guard_accounting_period_date() to service_role;
grant execute on function private.finance_accounting_period_close_checklist(date) to service_role;

revoke all on function private.finance_get_accounting_period_close_impl() from public,anon;
revoke all on function private.finance_preview_accounting_period_close_impl(date) from public,anon;
revoke all on function private.finance_close_accounting_period_impl(date,text) from public,anon;
revoke all on function private.finance_reopen_accounting_period_impl(uuid,text) from public,anon;
grant execute on function private.finance_get_accounting_period_close_impl() to authenticated,service_role;
grant execute on function private.finance_preview_accounting_period_close_impl(date) to authenticated,service_role;
grant execute on function private.finance_close_accounting_period_impl(date,text) to authenticated,service_role;
grant execute on function private.finance_reopen_accounting_period_impl(uuid,text) to authenticated,service_role;

create or replace function public.get_admin_accounting_period_close()
returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog
as $$ select private.finance_get_accounting_period_close_impl(); $$;

create or replace function public.preview_admin_accounting_period_close(p_period_start date)
returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog
as $$ select private.finance_preview_accounting_period_close_impl(p_period_start); $$;

create or replace function public.close_admin_accounting_period(p_period_start date,p_close_notes text default null)
returns jsonb
language sql
security invoker
set search_path=pg_catalog
as $$ select private.finance_close_accounting_period_impl(p_period_start,p_close_notes); $$;

create or replace function public.reopen_admin_accounting_period(p_period_close_id uuid,p_reason text)
returns jsonb
language sql
security invoker
set search_path=pg_catalog
as $$ select private.finance_reopen_accounting_period_impl(p_period_close_id,p_reason); $$;

revoke all on function public.get_admin_accounting_period_close() from public,anon;
revoke all on function public.preview_admin_accounting_period_close(date) from public,anon;
revoke all on function public.close_admin_accounting_period(date,text) from public,anon;
revoke all on function public.reopen_admin_accounting_period(uuid,text) from public,anon;
grant execute on function public.get_admin_accounting_period_close() to authenticated,service_role;
grant execute on function public.preview_admin_accounting_period_close(date) to authenticated,service_role;
grant execute on function public.close_admin_accounting_period(date,text) to authenticated,service_role;
grant execute on function public.reopen_admin_accounting_period(uuid,text) to authenticated,service_role;

commit;
