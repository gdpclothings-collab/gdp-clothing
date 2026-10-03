begin;

alter table public.finance_expenses
  add column if not exists status text not null default 'active',
  add column if not exists receipt_reference text,
  add column if not exists correction_count integer not null default 0,
  add column if not exists last_corrected_at timestamptz,
  add column if not exists last_corrected_by uuid references auth.users(id) on delete set null,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;

alter table public.finance_expenses
  drop constraint if exists finance_expenses_status_check,
  add constraint finance_expenses_status_check check (status in ('active','voided')),
  drop constraint if exists finance_expenses_receipt_reference_len,
  add constraint finance_expenses_receipt_reference_len check (receipt_reference is null or char_length(receipt_reference) <= 200),
  drop constraint if exists finance_expenses_correction_count_check,
  add constraint finance_expenses_correction_count_check check (correction_count >= 0),
  drop constraint if exists finance_expenses_void_reason_len,
  add constraint finance_expenses_void_reason_len check (void_reason is null or char_length(void_reason) <= 500),
  drop constraint if exists finance_expenses_void_shape,
  add constraint finance_expenses_void_shape check (
    (status = 'active' and voided_at is null and voided_by is null and void_reason is null)
    or
    (status = 'voided' and voided_at is not null and void_reason is not null)
  );

create index if not exists finance_expenses_status_date_idx on public.finance_expenses (status, occurred_on desc);
create index if not exists finance_expenses_last_corrected_by_idx on public.finance_expenses (last_corrected_by);
create index if not exists finance_expenses_voided_by_idx on public.finance_expenses (voided_by);

create table public.finance_expense_events (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.finance_expenses(id) on delete restrict,
  event_type text not null check (event_type in ('created','corrected','voided','tax_updated')),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finance_expense_events_reason_len check (reason is null or char_length(reason) <= 500),
  constraint finance_expense_events_reason_required check (
    event_type = 'created' or nullif(trim(coalesce(reason,'')),'') is not null
  )
);

create index finance_expense_events_expense_created_idx on public.finance_expense_events (expense_id, created_at desc);
create index finance_expense_events_created_by_idx on public.finance_expense_events (created_by);

alter table public.finance_expense_events enable row level security;

drop policy if exists finance_expense_events_admin_select on public.finance_expense_events;
create policy finance_expense_events_admin_select
on public.finance_expense_events
for select
to authenticated
using ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_expenses_admin_select on public.finance_expenses;
create policy finance_expenses_admin_select
on public.finance_expenses
for select
to authenticated
using ((select public.is_admin_step_up_authorized()) and status = 'active');

drop policy if exists finance_expenses_admin_insert on public.finance_expenses;
drop policy if exists finance_expenses_admin_update on public.finance_expenses;
drop policy if exists finance_expenses_admin_delete on public.finance_expenses;

revoke all on public.finance_expenses from public, anon, authenticated;
grant select on public.finance_expenses to authenticated;
grant all on public.finance_expenses to service_role;

revoke all on public.finance_expense_events from public, anon, authenticated;
grant select on public.finance_expense_events to authenticated;
grant all on public.finance_expense_events to service_role;

create or replace function public.create_admin_finance_expense(
  p_occurred_on date, p_vendor text, p_category text, p_description text,
  p_amount numeric, p_tax numeric default 0, p_gst_hst_tax numeric default null,
  p_pst_tax numeric default null, p_itc_eligible boolean default false,
  p_payment_method text default null, p_receipt_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.finance_expenses;
  v_description text := nullif(trim(coalesce(p_description,'')), '');
  v_vendor text := nullif(trim(coalesce(p_vendor,'')), '');
  v_category text := lower(trim(coalesce(p_category,'miscellaneous')));
  v_payment text := nullif(trim(coalesce(p_payment_method,'')), '');
  v_receipt text := nullif(trim(coalesce(p_receipt_reference,'')), '');
  v_notes text := nullif(trim(coalesce(p_notes,'')), '');
  v_amount numeric := round(coalesce(p_amount,0),2);
  v_tax numeric := round(coalesce(p_tax,0),2);
  v_gst numeric := case when p_gst_hst_tax is null then null else round(p_gst_hst_tax,2) end;
  v_pst numeric := case when p_pst_tax is null then null else round(p_pst_tax,2) end;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  if p_occurred_on is null then raise exception 'expense date is required' using errcode = '22023'; end if;
  if p_occurred_on > (now() at time zone 'America/Regina')::date then raise exception 'expense date cannot be in the future' using errcode = '22023'; end if;
  if v_description is null then raise exception 'expense description is required' using errcode = '22023'; end if;
  if v_amount <= 0 then raise exception 'expense amount must be greater than zero' using errcode = '22023'; end if;
  if v_tax < 0 or coalesce(v_gst,0) < 0 or coalesce(v_pst,0) < 0 then raise exception 'expense tax amounts cannot be negative' using errcode = '22023'; end if;
  if char_length(v_description) > 500 or char_length(coalesce(v_vendor,'')) > 200 or char_length(v_category) > 100 or char_length(coalesce(v_payment,'')) > 100 or char_length(coalesce(v_receipt,'')) > 200 or char_length(coalesce(v_notes,'')) > 1000 then raise exception 'one or more expense text fields are too long' using errcode = '22001'; end if;

  insert into public.finance_expenses (
    occurred_on, vendor, category, description, amount, tax,
    gst_hst_tax, pst_tax, gst_hst_itc_eligible, currency, payment_method,
    receipt_reference, notes, status, created_by, created_at, updated_at
  ) values (
    p_occurred_on, v_vendor, v_category, v_description, v_amount, v_tax,
    v_gst, v_pst, case when coalesce(v_gst,0) > 0 then coalesce(p_itc_eligible,false) else false end,
    'CAD', v_payment, v_receipt, v_notes, 'active', auth.uid(), now(), now()
  ) returning * into v_row;

  insert into public.finance_expense_events (expense_id, event_type, after_snapshot, created_by)
  values (v_row.id, 'created', to_jsonb(v_row), auth.uid());
  return to_jsonb(v_row);
end;
$$;

create or replace function public.correct_admin_finance_expense(
  p_expense_id uuid, p_occurred_on date, p_vendor text, p_category text,
  p_description text, p_amount numeric, p_tax numeric default 0,
  p_gst_hst_tax numeric default null, p_pst_tax numeric default null,
  p_itc_eligible boolean default false, p_payment_method text default null,
  p_receipt_reference text default null, p_notes text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_before public.finance_expenses;
  v_after public.finance_expenses;
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
  v_description text := nullif(trim(coalesce(p_description,'')), '');
  v_vendor text := nullif(trim(coalesce(p_vendor,'')), '');
  v_category text := lower(trim(coalesce(p_category,'miscellaneous')));
  v_payment text := nullif(trim(coalesce(p_payment_method,'')), '');
  v_receipt text := nullif(trim(coalesce(p_receipt_reference,'')), '');
  v_notes text := nullif(trim(coalesce(p_notes,'')), '');
  v_amount numeric := round(coalesce(p_amount,0),2);
  v_tax numeric := round(coalesce(p_tax,0),2);
  v_gst numeric := case when p_gst_hst_tax is null then null else round(p_gst_hst_tax,2) end;
  v_pst numeric := case when p_pst_tax is null then null else round(p_pst_tax,2) end;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  if p_expense_id is null then raise exception 'expense is required' using errcode = '22023'; end if;
  if v_reason is null then raise exception 'correction reason is required' using errcode = '22023'; end if;
  if p_occurred_on is null or p_occurred_on > (now() at time zone 'America/Regina')::date then raise exception 'invalid expense date' using errcode = '22023'; end if;
  if v_description is null then raise exception 'expense description is required' using errcode = '22023'; end if;
  if v_amount <= 0 then raise exception 'expense amount must be greater than zero' using errcode = '22023'; end if;
  if v_tax < 0 or coalesce(v_gst,0) < 0 or coalesce(v_pst,0) < 0 then raise exception 'expense tax amounts cannot be negative' using errcode = '22023'; end if;
  if char_length(v_reason) > 500 or char_length(v_description) > 500 or char_length(coalesce(v_vendor,'')) > 200 or char_length(v_category) > 100 or char_length(coalesce(v_payment,'')) > 100 or char_length(coalesce(v_receipt,'')) > 200 or char_length(coalesce(v_notes,'')) > 1000 then raise exception 'one or more expense text fields are too long' using errcode = '22001'; end if;

  select * into v_before from public.finance_expenses where id = p_expense_id for update;
  if v_before.id is null then raise exception 'expense not found' using errcode = 'P0002'; end if;
  if v_before.status <> 'active' then raise exception 'only active expenses can be corrected' using errcode = '22023'; end if;

  update public.finance_expenses
  set occurred_on = p_occurred_on, vendor = v_vendor, category = v_category,
      description = v_description, amount = v_amount, tax = v_tax,
      gst_hst_tax = v_gst, pst_tax = v_pst,
      gst_hst_itc_eligible = case when coalesce(v_gst,0) > 0 then coalesce(p_itc_eligible,false) else false end,
      payment_method = v_payment, receipt_reference = v_receipt, notes = v_notes,
      correction_count = correction_count + 1, last_corrected_at = now(),
      last_corrected_by = auth.uid(), updated_at = now()
  where id = p_expense_id returning * into v_after;

  insert into public.finance_expense_events (expense_id, event_type, reason, before_snapshot, after_snapshot, created_by)
  values (p_expense_id, 'corrected', v_reason, to_jsonb(v_before), to_jsonb(v_after), auth.uid());
  return to_jsonb(v_after);
end;
$$;

create or replace function public.void_admin_finance_expense(p_expense_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_before public.finance_expenses;
  v_after public.finance_expenses;
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  if p_expense_id is null then raise exception 'expense is required' using errcode = '22023'; end if;
  if v_reason is null then raise exception 'void reason is required' using errcode = '22023'; end if;
  if char_length(v_reason) > 500 then raise exception 'void reason is too long' using errcode = '22001'; end if;
  select * into v_before from public.finance_expenses where id = p_expense_id for update;
  if v_before.id is null then raise exception 'expense not found' using errcode = 'P0002'; end if;
  if v_before.status <> 'active' then raise exception 'expense is already voided' using errcode = '22023'; end if;
  update public.finance_expenses set status='voided', voided_at=now(), voided_by=auth.uid(), void_reason=v_reason, updated_at=now()
  where id=p_expense_id returning * into v_after;
  insert into public.finance_expense_events (expense_id,event_type,reason,before_snapshot,after_snapshot,created_by)
  values (p_expense_id,'voided',v_reason,to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end;
$$;

create or replace function public.get_admin_expense_controls(p_from date default null, p_to date default null, p_limit integer default 500)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare v_limit integer := greatest(25, least(1000, coalesce(p_limit,500))); v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  with filtered as (
    select e.* from public.finance_expenses e
    where (p_from is null or e.occurred_on >= p_from) and (p_to is null or e.occurred_on <= p_to)
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'summary',jsonb_build_object(
      'activeCount',coalesce((select count(*) from filtered where status='active'),0),
      'activeTotal',coalesce((select sum(amount+tax) from filtered where status='active'),0),
      'gstHstTax',coalesce((select sum(gst_hst_tax) from filtered where status='active'),0),
      'pstTax',coalesce((select sum(pst_tax) from filtered where status='active'),0),
      'itcPotential',coalesce((select sum(gst_hst_tax) from filtered where status='active' and gst_hst_itc_eligible),0),
      'receiptReferences',coalesce((select count(*) from filtered where status='active' and nullif(trim(coalesce(receipt_reference,'')),'') is not null),0),
      'voidedCount',coalesce((select count(*) from filtered where status='voided'),0)
    ),
    'expenses',coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_on desc,x.created_at desc) from (
      select id,occurred_on,vendor,category,description,amount,tax,gst_hst_tax,pst_tax,gst_hst_itc_eligible,currency,payment_method,receipt_path,receipt_reference,notes,status,correction_count,last_corrected_at,voided_at,void_reason,created_at,updated_at
      from filtered order by occurred_on desc,created_at desc limit v_limit
    ) x),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select ev.id,ev.expense_id,ev.event_type,ev.reason,ev.created_at from public.finance_expense_events ev join filtered e on e.id=ev.expense_id order by ev.created_at desc limit least(v_limit*4,2000)
    ) x),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.update_admin_expense_tax(p_expense_id uuid,p_gst_hst_tax numeric,p_pst_tax numeric,p_itc_eligible boolean default false)
returns public.finance_expenses
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_before public.finance_expenses; v_after public.finance_expenses;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_gst_hst_tax is null or p_pst_tax is null or p_gst_hst_tax < 0 or p_pst_tax < 0 then raise exception 'tax amounts must be non-negative' using errcode='22003'; end if;
  select * into v_before from public.finance_expenses where id=p_expense_id for update;
  if v_before.id is null then raise exception 'expense not found' using errcode='P0002'; end if;
  if v_before.status <> 'active' then raise exception 'only active expenses can be updated' using errcode='22023'; end if;
  update public.finance_expenses set gst_hst_tax=round(p_gst_hst_tax,2),pst_tax=round(p_pst_tax,2),tax=round(p_gst_hst_tax+p_pst_tax,2),gst_hst_itc_eligible=case when p_gst_hst_tax>0 then coalesce(p_itc_eligible,false) else false end,correction_count=correction_count+1,last_corrected_at=now(),last_corrected_by=auth.uid(),updated_at=now()
  where id=p_expense_id returning * into v_after;
  insert into public.finance_expense_events(expense_id,event_type,reason,before_snapshot,after_snapshot,created_by)
  values(p_expense_id,'tax_updated','Tax classification updated',to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return v_after;
end;
$$;

revoke all on function public.create_admin_finance_expense(date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text) from public,anon;
revoke all on function public.correct_admin_finance_expense(uuid,date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text,text) from public,anon;
revoke all on function public.void_admin_finance_expense(uuid,text) from public,anon;
revoke all on function public.get_admin_expense_controls(date,date,integer) from public,anon;
revoke all on function public.update_admin_expense_tax(uuid,numeric,numeric,boolean) from public,anon;

grant execute on function public.create_admin_finance_expense(date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text) to authenticated,service_role;
grant execute on function public.correct_admin_finance_expense(uuid,date,text,text,text,numeric,numeric,numeric,numeric,boolean,text,text,text,text) to authenticated,service_role;
grant execute on function public.void_admin_finance_expense(uuid,text) to authenticated,service_role;
grant execute on function public.get_admin_expense_controls(date,date,integer) to authenticated,service_role;
grant execute on function public.update_admin_expense_tax(uuid,numeric,numeric,boolean) to authenticated,service_role;

commit;
