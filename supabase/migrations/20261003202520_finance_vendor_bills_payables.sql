create table if not exists public.finance_vendor_bills (
  id uuid primary key default gen_random_uuid(),
  issue_date date not null,
  due_date date not null,
  vendor text not null,
  bill_number text,
  category text not null default 'miscellaneous',
  description text not null,
  amount numeric(12,2) not null,
  gst_hst_tax numeric(12,2) not null default 0,
  pst_tax numeric(12,2) not null default 0,
  gst_hst_itc_eligible boolean not null default false,
  currency text not null default 'CAD',
  status text not null default 'open',
  payment_method text,
  payment_reference text,
  paid_on date,
  paid_at timestamptz,
  paid_by uuid,
  expense_id uuid references public.finance_expenses(id) on delete restrict,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  constraint finance_vendor_bills_dates_chk check (due_date >= issue_date),
  constraint finance_vendor_bills_amount_chk check (amount > 0),
  constraint finance_vendor_bills_tax_chk check (gst_hst_tax >= 0 and pst_tax >= 0),
  constraint finance_vendor_bills_currency_chk check (currency = 'CAD'),
  constraint finance_vendor_bills_status_chk check (status in ('open','paid','voided')),
  constraint finance_vendor_bills_state_chk check (
    (status='open' and paid_on is null and paid_at is null and paid_by is null and expense_id is null and voided_at is null and voided_by is null and void_reason is null)
    or
    (status='paid' and paid_on is not null and paid_at is not null and paid_by is not null and expense_id is not null and voided_at is null and voided_by is null and void_reason is null)
    or
    (status='voided' and paid_on is null and paid_at is null and paid_by is null and expense_id is null and voided_at is not null and voided_by is not null and nullif(trim(void_reason),'') is not null)
  )
);

create table if not exists public.finance_vendor_bill_events (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.finance_vendor_bills(id) on delete restrict,
  event_type text not null check (event_type in ('created','paid','voided')),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists finance_vendor_bills_status_due_idx on public.finance_vendor_bills(status,due_date);
create unique index if not exists finance_vendor_bills_expense_unique_idx on public.finance_vendor_bills(expense_id) where expense_id is not null;
create unique index if not exists finance_vendor_bills_vendor_number_unique_idx on public.finance_vendor_bills(lower(vendor),lower(bill_number)) where bill_number is not null and status <> 'voided';
create index if not exists finance_vendor_bill_events_bill_created_idx on public.finance_vendor_bill_events(bill_id,created_at desc);

alter table public.finance_vendor_bills enable row level security;
alter table public.finance_vendor_bill_events enable row level security;
revoke all on table public.finance_vendor_bills from anon;
revoke all on table public.finance_vendor_bill_events from anon;
revoke insert, update, delete on table public.finance_vendor_bills from authenticated;
revoke insert, update, delete on table public.finance_vendor_bill_events from authenticated;
grant select on table public.finance_vendor_bills to authenticated;
grant select on table public.finance_vendor_bill_events to authenticated;
grant all on table public.finance_vendor_bills to service_role;
grant all on table public.finance_vendor_bill_events to service_role;

drop policy if exists finance_vendor_bills_admin_select on public.finance_vendor_bills;
create policy finance_vendor_bills_admin_select on public.finance_vendor_bills for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_vendor_bill_events_admin_select on public.finance_vendor_bill_events;
create policy finance_vendor_bill_events_admin_select on public.finance_vendor_bill_events for select to authenticated using ((select public.is_admin_step_up_authorized()));

create or replace function private.finance_create_vendor_bill_impl(p_issue_date date,p_due_date date,p_vendor text,p_bill_number text,p_category text,p_description text,p_amount numeric,p_gst_hst_tax numeric default 0,p_pst_tax numeric default 0,p_itc_eligible boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_row public.finance_vendor_bills; v_vendor text := nullif(trim(coalesce(p_vendor,'')), ''); v_bill_number text := nullif(trim(coalesce(p_bill_number,'')), ''); v_category text := lower(trim(coalesce(p_category,'miscellaneous'))); v_description text := nullif(trim(coalesce(p_description,'')), ''); v_notes text := nullif(trim(coalesce(p_notes,'')), ''); v_amount numeric := round(coalesce(p_amount,0),2); v_gst numeric := round(coalesce(p_gst_hst_tax,0),2); v_pst numeric := round(coalesce(p_pst_tax,0),2); v_today date := (now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode = '42501'; end if;
  if p_issue_date is null or p_due_date is null then raise exception 'issue date and due date are required' using errcode='22023'; end if;
  if p_issue_date > v_today then raise exception 'bill issue date cannot be in the future' using errcode='22023'; end if;
  if p_due_date < p_issue_date then raise exception 'due date cannot be before issue date' using errcode='22023'; end if;
  if v_vendor is null then raise exception 'vendor is required' using errcode='22023'; end if;
  if v_description is null then raise exception 'description is required' using errcode='22023'; end if;
  if v_amount <= 0 then raise exception 'bill amount must be greater than zero' using errcode='22023'; end if;
  if v_gst < 0 or v_pst < 0 then raise exception 'bill tax amounts cannot be negative' using errcode='22023'; end if;
  if char_length(v_vendor)>200 or char_length(coalesce(v_bill_number,''))>120 or char_length(v_category)>100 or char_length(v_description)>500 or char_length(coalesce(v_notes,''))>1000 then raise exception 'one or more bill text fields are too long' using errcode='22001'; end if;
  insert into public.finance_vendor_bills(issue_date,due_date,vendor,bill_number,category,description,amount,gst_hst_tax,pst_tax,gst_hst_itc_eligible,currency,status,notes,created_by,created_at,updated_at)
  values(p_issue_date,p_due_date,v_vendor,v_bill_number,v_category,v_description,v_amount,v_gst,v_pst,case when v_gst>0 then coalesce(p_itc_eligible,false) else false end,'CAD','open',v_notes,auth.uid(),now(),now()) returning * into v_row;
  insert into public.finance_vendor_bill_events(bill_id,event_type,after_snapshot,created_by) values(v_row.id,'created',to_jsonb(v_row),auth.uid());
  return to_jsonb(v_row);
exception when unique_violation then raise exception 'this vendor bill number is already recorded' using errcode='23505';
end; $$;

create or replace function private.finance_mark_vendor_bill_paid_impl(p_bill_id uuid,p_paid_on date,p_payment_method text,p_payment_reference text default null,p_payment_note text default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_before public.finance_vendor_bills; v_after public.finance_vendor_bills; v_expense jsonb; v_expense_id uuid; v_payment_method text := nullif(trim(coalesce(p_payment_method,'')), ''); v_payment_reference text := nullif(trim(coalesce(p_payment_reference,'')), ''); v_payment_note text := nullif(trim(coalesce(p_payment_note,'')), ''); v_today date := (now() at time zone 'America/Regina')::date; v_expense_notes text;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_bill_id is null then raise exception 'bill is required' using errcode='22023'; end if;
  if p_paid_on is null or p_paid_on > v_today then raise exception 'valid payment date is required' using errcode='22023'; end if;
  if v_payment_method is null then raise exception 'payment method is required' using errcode='22023'; end if;
  if char_length(v_payment_method)>100 or char_length(coalesce(v_payment_reference,''))>200 or char_length(coalesce(v_payment_note,''))>500 then raise exception 'one or more payment fields are too long' using errcode='22001'; end if;
  select * into v_before from public.finance_vendor_bills where id=p_bill_id for update;
  if v_before.id is null then raise exception 'bill not found' using errcode='P0002'; end if;
  if v_before.status <> 'open' then raise exception 'only open bills can be marked paid' using errcode='22023'; end if;
  if p_paid_on < v_before.issue_date then raise exception 'payment date cannot be before bill issue date' using errcode='22023'; end if;
  v_expense_notes := concat_ws(E'\n',v_before.notes,case when v_before.bill_number is not null then 'Vendor bill: ' || v_before.bill_number else null end,case when v_payment_reference is not null then 'Payment reference: ' || v_payment_reference else null end,v_payment_note);
  v_expense := private.finance_create_expense_impl(p_paid_on,v_before.vendor,v_before.category,v_before.description,v_before.amount,round(v_before.gst_hst_tax+v_before.pst_tax,2),v_before.gst_hst_tax,v_before.pst_tax,v_before.gst_hst_itc_eligible,v_payment_method,coalesce(v_before.bill_number,v_payment_reference),nullif(trim(v_expense_notes),''));
  v_expense_id := (v_expense->>'id')::uuid;
  update public.finance_vendor_bills set status='paid',payment_method=v_payment_method,payment_reference=v_payment_reference,paid_on=p_paid_on,paid_at=now(),paid_by=auth.uid(),expense_id=v_expense_id,updated_at=now() where id=p_bill_id returning * into v_after;
  insert into public.finance_vendor_bill_events(bill_id,event_type,before_snapshot,after_snapshot,created_by) values(p_bill_id,'paid',to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return jsonb_build_object('bill',to_jsonb(v_after),'expense',v_expense);
end; $$;

create or replace function private.finance_void_vendor_bill_impl(p_bill_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_before public.finance_vendor_bills; v_after public.finance_vendor_bills; v_reason text := nullif(trim(coalesce(p_reason,'')), '');
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_bill_id is null then raise exception 'bill is required' using errcode='22023'; end if;
  if v_reason is null then raise exception 'void reason is required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'void reason is too long' using errcode='22001'; end if;
  select * into v_before from public.finance_vendor_bills where id=p_bill_id for update;
  if v_before.id is null then raise exception 'bill not found' using errcode='P0002'; end if;
  if v_before.status <> 'open' then raise exception 'only open bills can be voided' using errcode='22023'; end if;
  update public.finance_vendor_bills set status='voided',voided_at=now(),voided_by=auth.uid(),void_reason=v_reason,updated_at=now() where id=p_bill_id returning * into v_after;
  insert into public.finance_vendor_bill_events(bill_id,event_type,reason,before_snapshot,after_snapshot,created_by) values(p_bill_id,'voided',v_reason,to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_get_vendor_bills_impl(p_from date default null,p_to date default null,p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare v_limit integer := greatest(25,least(1000,coalesce(p_limit,500))); v_today date := (now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  return (
    with filtered as (select b.*,round(b.amount+b.gst_hst_tax+b.pst_tax,2) as total from public.finance_vendor_bills b where (p_from is null or b.due_date>=p_from) and (p_to is null or b.due_date<=p_to)),
    limited as (select * from filtered order by case when status='open' then 0 when status='paid' then 1 else 2 end,due_date asc,created_at desc limit v_limit)
    select jsonb_build_object('generatedAt',now(),'summary',jsonb_build_object('openCount',coalesce((select count(*) from filtered where status='open'),0),'openTotal',coalesce((select sum(total) from filtered where status='open'),0),'overdueCount',coalesce((select count(*) from filtered where status='open' and due_date<v_today),0),'overdueTotal',coalesce((select sum(total) from filtered where status='open' and due_date<v_today),0),'due7Count',coalesce((select count(*) from filtered where status='open' and due_date between v_today and v_today+7),0),'due7Total',coalesce((select sum(total) from filtered where status='open' and due_date between v_today and v_today+7),0),'due30Count',coalesce((select count(*) from filtered where status='open' and due_date between v_today and v_today+30),0),'due30Total',coalesce((select sum(total) from filtered where status='open' and due_date between v_today and v_today+30),0),'paidCount',coalesce((select count(*) from filtered where status='paid'),0),'paidTotal',coalesce((select sum(total) from filtered where status='paid'),0),'voidedCount',coalesce((select count(*) from filtered where status='voided'),0)),'bills',coalesce((select jsonb_agg(to_jsonb(l) order by case when l.status='open' then 0 when l.status='paid' then 1 else 2 end,l.due_date asc,l.created_at desc) from limited l),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select ev.id,ev.bill_id,ev.event_type,ev.reason,ev.created_at from public.finance_vendor_bill_events ev join filtered f on f.id=ev.bill_id order by ev.created_at desc limit least(v_limit*4,2000)) e),'[]'::jsonb))
  );
end; $$;

revoke all on function private.finance_create_vendor_bill_impl(date,date,text,text,text,text,numeric,numeric,numeric,boolean,text) from public,anon;
revoke all on function private.finance_mark_vendor_bill_paid_impl(uuid,date,text,text,text) from public,anon;
revoke all on function private.finance_void_vendor_bill_impl(uuid,text) from public,anon;
revoke all on function private.finance_get_vendor_bills_impl(date,date,integer) from public,anon;
grant execute on function private.finance_create_vendor_bill_impl(date,date,text,text,text,text,numeric,numeric,numeric,boolean,text) to authenticated,service_role;
grant execute on function private.finance_mark_vendor_bill_paid_impl(uuid,date,text,text,text) to authenticated,service_role;
grant execute on function private.finance_void_vendor_bill_impl(uuid,text) to authenticated,service_role;
grant execute on function private.finance_get_vendor_bills_impl(date,date,integer) to authenticated,service_role;

create or replace function public.create_admin_vendor_bill(p_issue_date date,p_due_date date,p_vendor text,p_bill_number text,p_category text,p_description text,p_amount numeric,p_gst_hst_tax numeric default 0,p_pst_tax numeric default 0,p_itc_eligible boolean default false,p_notes text default null)
returns jsonb language sql security invoker set search_path = pg_catalog as $$ select private.finance_create_vendor_bill_impl(p_issue_date,p_due_date,p_vendor,p_bill_number,p_category,p_description,p_amount,p_gst_hst_tax,p_pst_tax,p_itc_eligible,p_notes); $$;
create or replace function public.mark_admin_vendor_bill_paid(p_bill_id uuid,p_paid_on date,p_payment_method text,p_payment_reference text default null,p_payment_note text default null)
returns jsonb language sql security invoker set search_path = pg_catalog as $$ select private.finance_mark_vendor_bill_paid_impl(p_bill_id,p_paid_on,p_payment_method,p_payment_reference,p_payment_note); $$;
create or replace function public.void_admin_vendor_bill(p_bill_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path = pg_catalog as $$ select private.finance_void_vendor_bill_impl(p_bill_id,p_reason); $$;
create or replace function public.get_admin_vendor_bills(p_from date default null,p_to date default null,p_limit integer default 500)
returns jsonb language sql stable security invoker set search_path = pg_catalog as $$ select private.finance_get_vendor_bills_impl(p_from,p_to,p_limit); $$;
revoke all on function public.create_admin_vendor_bill(date,date,text,text,text,text,numeric,numeric,numeric,boolean,text) from public,anon;
revoke all on function public.mark_admin_vendor_bill_paid(uuid,date,text,text,text) from public,anon;
revoke all on function public.void_admin_vendor_bill(uuid,text) from public,anon;
revoke all on function public.get_admin_vendor_bills(date,date,integer) from public,anon;
grant execute on function public.create_admin_vendor_bill(date,date,text,text,text,text,numeric,numeric,numeric,boolean,text) to authenticated,service_role;
grant execute on function public.mark_admin_vendor_bill_paid(uuid,date,text,text,text) to authenticated,service_role;
grant execute on function public.void_admin_vendor_bill(uuid,text) to authenticated,service_role;
grant execute on function public.get_admin_vendor_bills(date,date,integer) to authenticated,service_role;
