begin;

create table public.finance_cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  opening_cash numeric(12,2) not null default 0 check (opening_cash >= 0),
  status text not null default 'open' check (status in ('open','closed')),
  cash_sales_snapshot numeric(12,2) not null default 0 check (cash_sales_snapshot >= 0),
  cash_refunds_snapshot numeric(12,2) not null default 0 check (cash_refunds_snapshot >= 0),
  cash_expenses_snapshot numeric(12,2) not null default 0 check (cash_expenses_snapshot >= 0),
  cash_in_snapshot numeric(12,2) not null default 0 check (cash_in_snapshot >= 0),
  cash_out_snapshot numeric(12,2) not null default 0 check (cash_out_snapshot >= 0),
  expected_cash numeric(12,2),
  actual_cash numeric(12,2) check (actual_cash is null or actual_cash >= 0),
  variance numeric(12,2),
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
  constraint finance_cash_reconciliations_notes_len check (notes is null or char_length(notes) <= 1000),
  constraint finance_cash_reconciliations_close_notes_len check (close_notes is null or char_length(close_notes) <= 1000),
  constraint finance_cash_reconciliations_reopen_reason_len check (last_reopen_reason is null or char_length(last_reopen_reason) <= 500),
  constraint finance_cash_reconciliations_close_shape check (
    (status = 'open' and closed_at is null and closed_by is null and expected_cash is null and actual_cash is null and variance is null)
    or
    (status = 'closed' and closed_at is not null and expected_cash is not null and actual_cash is not null and variance is not null)
  )
);

create index finance_cash_reconciliations_status_date_idx on public.finance_cash_reconciliations (status, business_date desc);
create index finance_cash_reconciliations_opened_by_idx on public.finance_cash_reconciliations (opened_by);
create index finance_cash_reconciliations_closed_by_idx on public.finance_cash_reconciliations (closed_by);
create index finance_cash_reconciliations_reopened_by_idx on public.finance_cash_reconciliations (last_reopened_by);

create table public.finance_cash_adjustments (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references public.finance_cash_reconciliations(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('refund','cash_in','cash_out')),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  reference text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint finance_cash_adjustments_reason_len check (char_length(trim(reason)) between 1 and 500),
  constraint finance_cash_adjustments_reference_len check (reference is null or char_length(reference) <= 100)
);

create index finance_cash_adjustments_reconciliation_idx on public.finance_cash_adjustments (reconciliation_id, occurred_at desc);
create index finance_cash_adjustments_created_by_idx on public.finance_cash_adjustments (created_by);

alter table public.finance_cash_reconciliations enable row level security;
alter table public.finance_cash_adjustments enable row level security;

create policy finance_cash_reconciliations_admin_select on public.finance_cash_reconciliations for select to authenticated using ((select public.is_admin_step_up_authorized()));
create policy finance_cash_reconciliations_admin_insert on public.finance_cash_reconciliations for insert to authenticated with check ((select public.is_admin_step_up_authorized()));
create policy finance_cash_reconciliations_admin_update on public.finance_cash_reconciliations for update to authenticated using ((select public.is_admin_step_up_authorized())) with check ((select public.is_admin_step_up_authorized()));
create policy finance_cash_adjustments_admin_select on public.finance_cash_adjustments for select to authenticated using ((select public.is_admin_step_up_authorized()));
create policy finance_cash_adjustments_admin_insert on public.finance_cash_adjustments for insert to authenticated with check ((select public.is_admin_step_up_authorized()));

revoke all on public.finance_cash_reconciliations from public, anon, authenticated;
revoke all on public.finance_cash_adjustments from public, anon, authenticated;
grant select, insert on public.finance_cash_reconciliations to authenticated;
grant update (status, cash_sales_snapshot, cash_refunds_snapshot, cash_expenses_snapshot, cash_in_snapshot, cash_out_snapshot, expected_cash, actual_cash, variance, close_notes, closed_at, closed_by, reopen_count, last_reopened_at, last_reopened_by, last_reopen_reason, updated_at) on public.finance_cash_reconciliations to authenticated;
grant select, insert on public.finance_cash_adjustments to authenticated;
grant all on public.finance_cash_reconciliations to service_role;
grant all on public.finance_cash_adjustments to service_role;

create or replace function public.create_admin_cash_reconciliation(p_business_date date, p_opening_cash numeric, p_notes text default null)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_date date := coalesce(p_business_date, (now() at time zone 'America/Regina')::date);
  v_today date := (now() at time zone 'America/Regina')::date;
  v_opening numeric := round(coalesce(p_opening_cash, 0), 2);
  v_notes text := nullif(trim(coalesce(p_notes,'')), '');
  v_row public.finance_cash_reconciliations;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  if v_date > v_today then raise exception 'cash reconciliation cannot be opened for a future date' using errcode = '22023'; end if;
  if v_opening < 0 then raise exception 'opening cash cannot be negative' using errcode = '22023'; end if;
  if char_length(coalesce(v_notes,'')) > 1000 then raise exception 'cash reconciliation note is too long' using errcode = '22001'; end if;
  insert into public.finance_cash_reconciliations (business_date, opening_cash, notes, opened_by)
  values (v_date, v_opening, v_notes, auth.uid()) returning * into v_row;
  return to_jsonb(v_row);
exception when unique_violation then raise exception 'a cash reconciliation already exists for this date' using errcode = '23505';
end; $$;

create or replace function public.add_admin_cash_adjustment(p_reconciliation_id uuid, p_adjustment_type text, p_amount numeric, p_reason text, p_reference text default null)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_type text := lower(trim(coalesce(p_adjustment_type,'')));
  v_amount numeric := round(coalesce(p_amount,0),2);
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
  v_reference text := nullif(trim(coalesce(p_reference,'')), '');
  v_recon public.finance_cash_reconciliations;
  v_row public.finance_cash_adjustments;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  if v_type not in ('refund','cash_in','cash_out') then raise exception 'invalid cash adjustment type' using errcode = '22023'; end if;
  if v_amount <= 0 then raise exception 'cash adjustment amount must be greater than zero' using errcode = '22023'; end if;
  if v_reason is null then raise exception 'cash adjustment reason is required' using errcode = '22023'; end if;
  if char_length(v_reason) > 500 or char_length(coalesce(v_reference,'')) > 100 then raise exception 'cash adjustment text field is too long' using errcode = '22001'; end if;
  select * into v_recon from public.finance_cash_reconciliations where id = p_reconciliation_id for update;
  if v_recon.id is null then raise exception 'cash reconciliation not found' using errcode = 'P0002'; end if;
  if v_recon.status <> 'open' then raise exception 'cash adjustments can only be added while the reconciliation is open' using errcode = '22023'; end if;
  insert into public.finance_cash_adjustments (reconciliation_id, adjustment_type, amount, reason, reference, created_by)
  values (p_reconciliation_id, v_type, v_amount, v_reason, v_reference, auth.uid()) returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.close_admin_cash_reconciliation(p_reconciliation_id uuid, p_actual_cash numeric, p_close_notes text default null)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_recon public.finance_cash_reconciliations;
  v_actual numeric := round(coalesce(p_actual_cash,-1),2);
  v_close_notes text := nullif(trim(coalesce(p_close_notes,'')), '');
  v_cash_sales numeric := 0; v_cash_expenses numeric := 0; v_cash_refunds numeric := 0; v_cash_in numeric := 0; v_cash_out numeric := 0;
  v_expected numeric := 0; v_variance numeric := 0; v_row public.finance_cash_reconciliations;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  if v_actual < 0 then raise exception 'actual cash cannot be negative' using errcode = '22023'; end if;
  if char_length(coalesce(v_close_notes,'')) > 1000 then raise exception 'cash close note is too long' using errcode = '22001'; end if;
  select * into v_recon from public.finance_cash_reconciliations where id = p_reconciliation_id for update;
  if v_recon.id is null then raise exception 'cash reconciliation not found' using errcode = 'P0002'; end if;
  if v_recon.status <> 'open' then raise exception 'cash reconciliation is already closed' using errcode = '22023'; end if;
  select coalesce(sum(s.total),0) into v_cash_sales from public.finance_manual_sales s where s.status='paid' and s.payment_method='cash' and (s.occurred_at at time zone 'America/Regina')::date = v_recon.business_date;
  select coalesce(sum(e.amount + e.tax),0) into v_cash_expenses from public.finance_expenses e where e.occurred_on=v_recon.business_date and lower(trim(coalesce(e.payment_method,'')))='cash';
  select coalesce(sum(a.amount) filter (where a.adjustment_type='refund'),0), coalesce(sum(a.amount) filter (where a.adjustment_type='cash_in'),0), coalesce(sum(a.amount) filter (where a.adjustment_type='cash_out'),0)
  into v_cash_refunds, v_cash_in, v_cash_out from public.finance_cash_adjustments a where a.reconciliation_id=v_recon.id;
  v_expected := round(v_recon.opening_cash + v_cash_sales + v_cash_in - v_cash_refunds - v_cash_out - v_cash_expenses,2);
  v_variance := round(v_actual - v_expected,2);
  update public.finance_cash_reconciliations set status='closed', cash_sales_snapshot=v_cash_sales, cash_refunds_snapshot=v_cash_refunds, cash_expenses_snapshot=v_cash_expenses, cash_in_snapshot=v_cash_in, cash_out_snapshot=v_cash_out, expected_cash=v_expected, actual_cash=v_actual, variance=v_variance, close_notes=v_close_notes, closed_at=now(), closed_by=auth.uid(), updated_at=now()
  where id=v_recon.id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.reopen_admin_cash_reconciliation(p_reconciliation_id uuid, p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
  v_recon public.finance_cash_reconciliations; v_row public.finance_cash_reconciliations;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  if v_reason is null then raise exception 'reopen reason is required' using errcode = '22023'; end if;
  if char_length(v_reason) > 500 then raise exception 'reopen reason is too long' using errcode = '22001'; end if;
  select * into v_recon from public.finance_cash_reconciliations where id=p_reconciliation_id for update;
  if v_recon.id is null then raise exception 'cash reconciliation not found' using errcode = 'P0002'; end if;
  if v_recon.status <> 'closed' then raise exception 'only a closed cash reconciliation can be reopened' using errcode = '22023'; end if;
  update public.finance_cash_reconciliations set status='open', cash_sales_snapshot=0, cash_refunds_snapshot=0, cash_expenses_snapshot=0, cash_in_snapshot=0, cash_out_snapshot=0, expected_cash=null, actual_cash=null, variance=null, close_notes=null, closed_at=null, closed_by=null, reopen_count=reopen_count+1, last_reopened_at=now(), last_reopened_by=auth.uid(), last_reopen_reason=v_reason, updated_at=now()
  where id=v_recon.id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.get_admin_cash_reconciliations(p_from date default null, p_to date default null, p_limit integer default 90)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, public as $$
declare v_limit integer := greatest(7, least(366, coalesce(p_limit,90))); v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  with filtered as (
    select r.* from public.finance_cash_reconciliations r where (p_from is null or r.business_date>=p_from) and (p_to is null or r.business_date<=p_to)
  ), live as (
    select r.*,
      case when r.status='closed' then r.cash_sales_snapshot else coalesce(s.cash_sales,0) end as cash_sales,
      case when r.status='closed' then r.cash_refunds_snapshot else coalesce(a.cash_refunds,0) end as cash_refunds,
      case when r.status='closed' then r.cash_expenses_snapshot else coalesce(e.cash_expenses,0) end as cash_expenses,
      case when r.status='closed' then r.cash_in_snapshot else coalesce(a.cash_in,0) end as cash_in,
      case when r.status='closed' then r.cash_out_snapshot else coalesce(a.cash_out,0) end as cash_out
    from filtered r
    left join lateral (select coalesce(sum(ms.total),0) cash_sales from public.finance_manual_sales ms where ms.status='paid' and ms.payment_method='cash' and (ms.occurred_at at time zone 'America/Regina')::date=r.business_date) s on true
    left join lateral (select coalesce(sum(fe.amount+fe.tax),0) cash_expenses from public.finance_expenses fe where fe.occurred_on=r.business_date and lower(trim(coalesce(fe.payment_method,'')))='cash') e on true
    left join lateral (select coalesce(sum(ca.amount) filter (where ca.adjustment_type='refund'),0) cash_refunds, coalesce(sum(ca.amount) filter (where ca.adjustment_type='cash_in'),0) cash_in, coalesce(sum(ca.amount) filter (where ca.adjustment_type='cash_out'),0) cash_out from public.finance_cash_adjustments ca where ca.reconciliation_id=r.id) a on true
  ), calculated as (
    select l.*, case when l.status='closed' then l.expected_cash else round(l.opening_cash+l.cash_sales+l.cash_in-l.cash_refunds-l.cash_out-l.cash_expenses,2) end current_expected_cash,
      case when l.status='closed' then l.variance else null end current_variance from live l
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'metrics',jsonb_build_object('openDays',coalesce((select count(*) from calculated where status='open'),0),'closedDays',coalesce((select count(*) from calculated where status='closed'),0),'closedVariance',coalesce((select sum(current_variance) from calculated where status='closed'),0),'shortageTotal',coalesce((select sum(-current_variance) from calculated where status='closed' and current_variance<0),0),'overageTotal',coalesce((select sum(current_variance) from calculated where status='closed' and current_variance>0),0)),
    'reconciliations',coalesce((select jsonb_agg(to_jsonb(x) order by x.business_date desc) from (select id,business_date,opening_cash,status,cash_sales,cash_refunds,cash_expenses,cash_in,cash_out,current_expected_cash expected_cash,actual_cash,current_variance variance,notes,close_notes,opened_at,closed_at,reopen_count,last_reopened_at,last_reopen_reason,created_at,updated_at from calculated order by business_date desc limit v_limit) x),'[]'::jsonb),
    'adjustments',coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_at desc) from (select a.id,a.reconciliation_id,a.adjustment_type,a.amount,a.reason,a.reference,a.occurred_at,a.created_at from public.finance_cash_adjustments a join filtered r on r.id=a.reconciliation_id order by a.occurred_at desc limit least(v_limit*20,2000)) x),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

revoke all on function public.create_admin_cash_reconciliation(date,numeric,text) from public, anon;
revoke all on function public.add_admin_cash_adjustment(uuid,text,numeric,text,text) from public, anon;
revoke all on function public.close_admin_cash_reconciliation(uuid,numeric,text) from public, anon;
revoke all on function public.reopen_admin_cash_reconciliation(uuid,text) from public, anon;
revoke all on function public.get_admin_cash_reconciliations(date,date,integer) from public, anon;
grant execute on function public.create_admin_cash_reconciliation(date,numeric,text) to authenticated, service_role;
grant execute on function public.add_admin_cash_adjustment(uuid,text,numeric,text,text) to authenticated, service_role;
grant execute on function public.close_admin_cash_reconciliation(uuid,numeric,text) to authenticated, service_role;
grant execute on function public.reopen_admin_cash_reconciliation(uuid,text) to authenticated, service_role;
grant execute on function public.get_admin_cash_reconciliations(date,date,integer) to authenticated, service_role;

commit;
