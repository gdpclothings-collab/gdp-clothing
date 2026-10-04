begin;

create sequence if not exists public.finance_customer_invoice_seq start 1;
revoke all on sequence public.finance_customer_invoice_seq from public, anon, authenticated;
grant all on sequence public.finance_customer_invoice_seq to service_role;

create table if not exists public.finance_customer_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  issue_date date not null,
  due_date date not null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  reference text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0 and discount <= subtotal),
  shipping numeric(12,2) not null default 0 check (shipping >= 0),
  gst_hst_tax numeric(12,2) not null default 0 check (gst_hst_tax >= 0),
  pst_tax numeric(12,2) not null default 0 check (pst_tax >= 0),
  cogs numeric(12,2) not null default 0 check (cogs >= 0),
  total numeric(12,2) generated always as (round((subtotal - discount + shipping + gst_hst_tax + pst_tax)::numeric, 2)) stored,
  currency text not null default 'CAD' check (currency = 'CAD'),
  tax_jurisdiction text not null default 'CA-SK',
  status text not null default 'draft' check (status in ('draft','open','partially_paid','paid','void')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  issued_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  constraint finance_customer_invoices_dates_chk check (due_date >= issue_date),
  constraint finance_customer_invoices_number_len check (char_length(invoice_number) <= 80),
  constraint finance_customer_invoices_customer_len check (char_length(customer_name) between 1 and 200),
  constraint finance_customer_invoices_email_len check (customer_email is null or char_length(customer_email) <= 254),
  constraint finance_customer_invoices_phone_len check (customer_phone is null or char_length(customer_phone) <= 80),
  constraint finance_customer_invoices_reference_len check (reference is null or char_length(reference) <= 120),
  constraint finance_customer_invoices_notes_len check (notes is null or char_length(notes) <= 1500),
  constraint finance_customer_invoices_void_reason_len check (void_reason is null or char_length(void_reason) <= 500),
  constraint finance_customer_invoices_state_chk check (
    (status = 'draft' and issued_at is null and paid_at is null and voided_at is null and void_reason is null)
    or (status in ('open','partially_paid') and issued_at is not null and paid_at is null and voided_at is null and void_reason is null)
    or (status = 'paid' and issued_at is not null and paid_at is not null and voided_at is null and void_reason is null)
    or (status = 'void' and paid_at is null and voided_at is not null and nullif(trim(void_reason),'') is not null)
  )
);

create table if not exists public.finance_customer_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.finance_customer_invoices(id) on delete restrict,
  paid_on date not null,
  payment_method text not null check (payment_method in ('cash','e_transfer','debit','credit_card','cheque','other')),
  amount numeric(12,2) not null check (amount > 0),
  payment_reference text,
  payment_note text,
  subtotal_component numeric(12,2) not null default 0,
  discount_component numeric(12,2) not null default 0,
  shipping_component numeric(12,2) not null default 0,
  gst_hst_tax_component numeric(12,2) not null default 0,
  pst_tax_component numeric(12,2) not null default 0,
  cogs_component numeric(12,2) not null default 0,
  manual_sale_id uuid unique references public.finance_manual_sales(id) on delete restrict,
  status text not null default 'active' check (status in ('active','reversed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reverse_reason text,
  constraint finance_customer_invoice_payments_reference_len check (payment_reference is null or char_length(payment_reference) <= 120),
  constraint finance_customer_invoice_payments_note_len check (payment_note is null or char_length(payment_note) <= 1000),
  constraint finance_customer_invoice_payments_reverse_reason_len check (reverse_reason is null or char_length(reverse_reason) <= 500),
  constraint finance_customer_invoice_payments_components_chk check (
    subtotal_component >= 0 and discount_component >= 0 and shipping_component >= 0 and gst_hst_tax_component >= 0 and pst_tax_component >= 0 and cogs_component >= 0
  ),
  constraint finance_customer_invoice_payments_state_chk check (
    (status='active' and reversed_at is null and reversed_by is null and reverse_reason is null)
    or (status='reversed' and reversed_at is not null and nullif(trim(reverse_reason),'') is not null)
  )
);

alter table public.finance_manual_sales add column if not exists source_type text not null default 'manual';
alter table public.finance_manual_sales add column if not exists receivable_payment_id uuid;
alter table public.finance_manual_sales drop constraint if exists finance_manual_sales_source_type_chk;
alter table public.finance_manual_sales add constraint finance_manual_sales_source_type_chk check (source_type in ('manual','receivable_payment'));
alter table public.finance_manual_sales drop constraint if exists finance_manual_sales_receivable_source_chk;
alter table public.finance_manual_sales add constraint finance_manual_sales_receivable_source_chk check (
  (source_type='manual' and receivable_payment_id is null) or (source_type='receivable_payment' and receivable_payment_id is not null)
);
alter table public.finance_manual_sales drop constraint if exists finance_manual_sales_receivable_payment_fk;
alter table public.finance_manual_sales add constraint finance_manual_sales_receivable_payment_fk foreign key (receivable_payment_id) references public.finance_customer_invoice_payments(id) on delete restrict;
create unique index if not exists finance_manual_sales_receivable_payment_uq on public.finance_manual_sales(receivable_payment_id) where receivable_payment_id is not null;

create table if not exists public.finance_customer_invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.finance_customer_invoices(id) on delete restrict,
  event_type text not null check (event_type in ('created','updated','issued','payment_recorded','payment_reversed','voided')),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finance_customer_invoice_events_reason_len check (reason is null or char_length(reason) <= 500)
);

create index if not exists finance_customer_invoices_status_due_idx on public.finance_customer_invoices(status,due_date,created_at desc);
create index if not exists finance_customer_invoices_customer_idx on public.finance_customer_invoices(lower(customer_name),created_at desc);
create index if not exists finance_customer_invoices_created_by_idx on public.finance_customer_invoices(created_by);
create index if not exists finance_customer_invoices_issued_by_idx on public.finance_customer_invoices(issued_by);
create index if not exists finance_customer_invoices_voided_by_idx on public.finance_customer_invoices(voided_by);
create index if not exists finance_customer_invoice_payments_invoice_idx on public.finance_customer_invoice_payments(invoice_id,status,paid_on,created_at);
create index if not exists finance_customer_invoice_payments_created_by_idx on public.finance_customer_invoice_payments(created_by);
create index if not exists finance_customer_invoice_payments_reversed_by_idx on public.finance_customer_invoice_payments(reversed_by);
create index if not exists finance_customer_invoice_events_invoice_idx on public.finance_customer_invoice_events(invoice_id,created_at desc);
create index if not exists finance_customer_invoice_events_created_by_idx on public.finance_customer_invoice_events(created_by);

alter table public.finance_customer_invoices enable row level security;
alter table public.finance_customer_invoice_payments enable row level security;
alter table public.finance_customer_invoice_events enable row level security;

revoke all on table public.finance_customer_invoices, public.finance_customer_invoice_payments, public.finance_customer_invoice_events from public, anon;
revoke insert, update, delete on table public.finance_customer_invoices, public.finance_customer_invoice_payments, public.finance_customer_invoice_events from authenticated;
grant select on table public.finance_customer_invoices, public.finance_customer_invoice_payments, public.finance_customer_invoice_events to authenticated;
grant all on table public.finance_customer_invoices, public.finance_customer_invoice_payments, public.finance_customer_invoice_events to service_role;

drop policy if exists finance_customer_invoices_admin_select on public.finance_customer_invoices;
create policy finance_customer_invoices_admin_select on public.finance_customer_invoices for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_customer_invoice_payments_admin_select on public.finance_customer_invoice_payments;
create policy finance_customer_invoice_payments_admin_select on public.finance_customer_invoice_payments for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_customer_invoice_events_admin_select on public.finance_customer_invoice_events;
create policy finance_customer_invoice_events_admin_select on public.finance_customer_invoice_events for select to authenticated using ((select public.is_admin_step_up_authorized()));

create or replace function private.finance_create_customer_invoice_impl(
  p_issue_date date,p_due_date date,p_customer_name text,p_customer_email text default null,p_customer_phone text default null,p_reference text default null,
  p_subtotal numeric default 0,p_discount numeric default 0,p_shipping numeric default 0,p_gst_hst_tax numeric default 0,p_pst_tax numeric default 0,p_cogs numeric default 0,p_notes text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_row public.finance_customer_invoices;
  v_today date:=(now() at time zone 'America/Regina')::date;
  v_number text;
  v_customer text:=nullif(trim(coalesce(p_customer_name,'')),'');
  v_email text:=nullif(trim(coalesce(p_customer_email,'')),'');
  v_phone text:=nullif(trim(coalesce(p_customer_phone,'')),'');
  v_reference text:=nullif(trim(coalesce(p_reference,'')),'');
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_subtotal numeric:=round(coalesce(p_subtotal,0),2);
  v_discount numeric:=round(coalesce(p_discount,0),2);
  v_shipping numeric:=round(coalesce(p_shipping,0),2);
  v_gst numeric:=round(coalesce(p_gst_hst_tax,0),2);
  v_pst numeric:=round(coalesce(p_pst_tax,0),2);
  v_cogs numeric:=round(coalesce(p_cogs,0),2);
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_issue_date is null or p_due_date is null or p_issue_date>v_today or p_due_date<p_issue_date then raise exception 'valid invoice issue and due dates are required' using errcode='22023'; end if;
  if v_customer is null then raise exception 'customer name is required' using errcode='22023'; end if;
  if v_subtotal<0 or v_discount<0 or v_discount>v_subtotal or v_shipping<0 or v_gst<0 or v_pst<0 or v_cogs<0 then raise exception 'invoice amounts are invalid' using errcode='22023'; end if;
  if round(v_subtotal-v_discount+v_shipping+v_gst+v_pst,2)<=0 then raise exception 'invoice total must be greater than zero' using errcode='22023'; end if;
  if char_length(v_customer)>200 or char_length(coalesce(v_email,''))>254 or char_length(coalesce(v_phone,''))>80 or char_length(coalesce(v_reference,''))>120 or char_length(coalesce(v_notes,''))>1500 then raise exception 'one or more invoice fields are too long' using errcode='22001'; end if;
  v_number:='INV-'||to_char(v_today,'YYYYMMDD')||'-'||lpad(nextval('public.finance_customer_invoice_seq'::regclass)::text,5,'0');
  insert into public.finance_customer_invoices(invoice_number,issue_date,due_date,customer_name,customer_email,customer_phone,reference,subtotal,discount,shipping,gst_hst_tax,pst_tax,cogs,notes,status,created_by,created_at,updated_at)
  values(v_number,p_issue_date,p_due_date,v_customer,v_email,v_phone,v_reference,v_subtotal,v_discount,v_shipping,v_gst,v_pst,v_cogs,v_notes,'draft',auth.uid(),now(),now()) returning * into v_row;
  insert into public.finance_customer_invoice_events(invoice_id,event_type,after_snapshot,created_by) values(v_row.id,'created',to_jsonb(v_row),auth.uid());
  return to_jsonb(v_row);
end; $$;

create or replace function private.finance_update_customer_invoice_impl(
  p_invoice_id uuid,p_issue_date date,p_due_date date,p_customer_name text,p_customer_email text default null,p_customer_phone text default null,p_reference text default null,
  p_subtotal numeric default 0,p_discount numeric default 0,p_shipping numeric default 0,p_gst_hst_tax numeric default 0,p_pst_tax numeric default 0,p_cogs numeric default 0,p_notes text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_before public.finance_customer_invoices; v_after public.finance_customer_invoices;
  v_today date:=(now() at time zone 'America/Regina')::date;
  v_customer text:=nullif(trim(coalesce(p_customer_name,'')),'');
  v_email text:=nullif(trim(coalesce(p_customer_email,'')),''); v_phone text:=nullif(trim(coalesce(p_customer_phone,'')),''); v_reference text:=nullif(trim(coalesce(p_reference,'')),''); v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_subtotal numeric:=round(coalesce(p_subtotal,0),2); v_discount numeric:=round(coalesce(p_discount,0),2); v_shipping numeric:=round(coalesce(p_shipping,0),2); v_gst numeric:=round(coalesce(p_gst_hst_tax,0),2); v_pst numeric:=round(coalesce(p_pst_tax,0),2); v_cogs numeric:=round(coalesce(p_cogs,0),2);
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  select * into v_before from public.finance_customer_invoices where id=p_invoice_id for update;
  if v_before.id is null then raise exception 'customer invoice not found' using errcode='P0002'; end if;
  if v_before.status<>'draft' then raise exception 'only draft invoices can be edited' using errcode='22023'; end if;
  if p_issue_date is null or p_due_date is null or p_issue_date>v_today or p_due_date<p_issue_date or v_customer is null then raise exception 'valid invoice details are required' using errcode='22023'; end if;
  if v_subtotal<0 or v_discount<0 or v_discount>v_subtotal or v_shipping<0 or v_gst<0 or v_pst<0 or v_cogs<0 or round(v_subtotal-v_discount+v_shipping+v_gst+v_pst,2)<=0 then raise exception 'invoice amounts are invalid' using errcode='22023'; end if;
  if char_length(v_customer)>200 or char_length(coalesce(v_email,''))>254 or char_length(coalesce(v_phone,''))>80 or char_length(coalesce(v_reference,''))>120 or char_length(coalesce(v_notes,''))>1500 then raise exception 'one or more invoice fields are too long' using errcode='22001'; end if;
  update public.finance_customer_invoices set issue_date=p_issue_date,due_date=p_due_date,customer_name=v_customer,customer_email=v_email,customer_phone=v_phone,reference=v_reference,subtotal=v_subtotal,discount=v_discount,shipping=v_shipping,gst_hst_tax=v_gst,pst_tax=v_pst,cogs=v_cogs,notes=v_notes,updated_at=now() where id=p_invoice_id returning * into v_after;
  insert into public.finance_customer_invoice_events(invoice_id,event_type,before_snapshot,after_snapshot,created_by) values(p_invoice_id,'updated',to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_issue_customer_invoice_impl(p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_before public.finance_customer_invoices; v_after public.finance_customer_invoices;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  select * into v_before from public.finance_customer_invoices where id=p_invoice_id for update;
  if v_before.id is null then raise exception 'customer invoice not found' using errcode='P0002'; end if;
  if v_before.status<>'draft' then raise exception 'only draft invoices can be issued' using errcode='22023'; end if;
  update public.finance_customer_invoices set status='open',issued_at=now(),issued_by=auth.uid(),updated_at=now() where id=p_invoice_id returning * into v_after;
  insert into public.finance_customer_invoice_events(invoice_id,event_type,before_snapshot,after_snapshot,created_by) values(p_invoice_id,'issued',to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_record_customer_invoice_payment_impl(p_invoice_id uuid,p_paid_on date,p_payment_method text,p_amount numeric,p_payment_reference text default null,p_payment_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_invoice public.finance_customer_invoices; v_after public.finance_customer_invoices; v_payment public.finance_customer_invoice_payments; v_sale public.finance_manual_sales;
  v_today date:=(now() at time zone 'America/Regina')::date;
  v_method text:=lower(trim(coalesce(p_payment_method,''))); v_reference text:=nullif(trim(coalesce(p_payment_reference,'')),''); v_note text:=nullif(trim(coalesce(p_payment_note,'')),'');
  v_amount numeric:=round(coalesce(p_amount,0),2); v_paid numeric:=0; v_remaining numeric;
  v_prev_sub numeric:=0; v_prev_discount numeric:=0; v_prev_shipping numeric:=0; v_prev_gst numeric:=0; v_prev_pst numeric:=0; v_prev_cogs numeric:=0;
  v_rem_sub numeric; v_rem_discount numeric; v_rem_shipping numeric; v_rem_gst numeric; v_rem_pst numeric; v_rem_cogs numeric;
  v_sub numeric; v_discount numeric; v_shipping numeric; v_gst numeric; v_pst numeric; v_cogs numeric; v_ratio numeric; v_calc numeric; v_delta numeric;
  v_payment_id uuid:=gen_random_uuid();
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_invoice_id is null or p_paid_on is null or v_amount<=0 then raise exception 'invoice, payment date and positive amount are required' using errcode='22023'; end if;
  if v_method not in ('cash','e_transfer','debit','credit_card','cheque','other') then raise exception 'invalid payment method' using errcode='22023'; end if;
  if p_paid_on>v_today then raise exception 'payment date cannot be in the future' using errcode='22023'; end if;
  if char_length(coalesce(v_reference,''))>120 or char_length(coalesce(v_note,''))>1000 then raise exception 'payment reference or note is too long' using errcode='22001'; end if;
  select * into v_invoice from public.finance_customer_invoices where id=p_invoice_id for update;
  if v_invoice.id is null then raise exception 'customer invoice not found' using errcode='P0002'; end if;
  if v_invoice.status not in ('open','partially_paid') then raise exception 'payments can only be recorded against an issued outstanding invoice' using errcode='22023'; end if;
  if p_paid_on<v_invoice.issue_date then raise exception 'payment date cannot be before invoice issue date' using errcode='22023'; end if;
  select coalesce(sum(amount),0),coalesce(sum(subtotal_component),0),coalesce(sum(discount_component),0),coalesce(sum(shipping_component),0),coalesce(sum(gst_hst_tax_component),0),coalesce(sum(pst_tax_component),0),coalesce(sum(cogs_component),0)
    into v_paid,v_prev_sub,v_prev_discount,v_prev_shipping,v_prev_gst,v_prev_pst,v_prev_cogs
    from public.finance_customer_invoice_payments where invoice_id=p_invoice_id and status='active';
  v_remaining:=round(v_invoice.total-v_paid,2);
  if v_remaining<=0 then raise exception 'invoice is already fully paid' using errcode='22023'; end if;
  if v_amount>v_remaining then raise exception 'payment exceeds the remaining invoice balance' using errcode='22023'; end if;
  v_rem_sub:=round(v_invoice.subtotal-v_prev_sub,2); v_rem_discount:=round(v_invoice.discount-v_prev_discount,2); v_rem_shipping:=round(v_invoice.shipping-v_prev_shipping,2); v_rem_gst:=round(v_invoice.gst_hst_tax-v_prev_gst,2); v_rem_pst:=round(v_invoice.pst_tax-v_prev_pst,2); v_rem_cogs:=round(v_invoice.cogs-v_prev_cogs,2);
  if abs(v_amount-v_remaining)<=0.01 then
    v_sub:=v_rem_sub; v_discount:=v_rem_discount; v_shipping:=v_rem_shipping; v_gst:=v_rem_gst; v_pst:=v_rem_pst; v_cogs:=v_rem_cogs;
  else
    v_ratio:=v_amount/v_remaining;
    v_sub:=round(v_rem_sub*v_ratio,2); v_discount:=round(v_rem_discount*v_ratio,2); v_shipping:=round(v_rem_shipping*v_ratio,2); v_gst:=round(v_rem_gst*v_ratio,2); v_pst:=round(v_rem_pst*v_ratio,2); v_cogs:=round(v_rem_cogs*v_ratio,2);
    v_calc:=round(v_sub-v_discount+v_shipping+v_gst+v_pst,2);
    v_delta:=round(v_amount-v_calc,2);
    v_sub:=round(v_sub+v_delta,2);
    if v_sub<0 then raise exception 'payment allocation could not be balanced safely' using errcode='22023'; end if;
  end if;
  insert into public.finance_customer_invoice_payments(id,invoice_id,paid_on,payment_method,amount,payment_reference,payment_note,subtotal_component,discount_component,shipping_component,gst_hst_tax_component,pst_tax_component,cogs_component,status,created_by,created_at)
  values(v_payment_id,p_invoice_id,p_paid_on,v_method,v_amount,v_reference,v_note,v_sub,v_discount,v_shipping,v_gst,v_pst,v_cogs,'active',auth.uid(),now()) returning * into v_payment;
  insert into public.finance_manual_sales(occurred_at,customer_name,reference,payment_method,subtotal,discount,shipping,gst_hst_tax,pst_tax,cogs,notes,status,created_by,source_type,receivable_payment_id)
  values((p_paid_on::timestamp at time zone 'America/Regina'),v_invoice.customer_name,v_invoice.invoice_number||coalesce(' · '||v_reference,''),v_method,v_sub,v_discount,v_shipping,v_gst,v_pst,v_cogs,coalesce(v_note,'Customer invoice payment'),'paid',auth.uid(),'receivable_payment',v_payment_id) returning * into v_sale;
  update public.finance_customer_invoice_payments set manual_sale_id=v_sale.id where id=v_payment_id returning * into v_payment;
  if round(v_remaining-v_amount,2)<=0.01 then
    update public.finance_customer_invoices set status='paid',paid_at=now(),updated_at=now() where id=p_invoice_id returning * into v_after;
  else
    update public.finance_customer_invoices set status='partially_paid',paid_at=null,updated_at=now() where id=p_invoice_id returning * into v_after;
  end if;
  insert into public.finance_customer_invoice_events(invoice_id,event_type,after_snapshot,created_by) values(p_invoice_id,'payment_recorded',jsonb_build_object('payment',to_jsonb(v_payment),'invoice',to_jsonb(v_after),'manualSaleId',v_sale.id),auth.uid());
  return jsonb_build_object('payment',to_jsonb(v_payment),'invoice',to_jsonb(v_after),'manualSale',to_jsonb(v_sale));
end; $$;

create or replace function private.finance_reverse_customer_invoice_payment_impl(p_payment_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_payment public.finance_customer_invoice_payments; v_after_payment public.finance_customer_invoice_payments; v_invoice public.finance_customer_invoices; v_after public.finance_customer_invoices; v_sale public.finance_manual_sales;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),''); v_active_total numeric:=0;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_payment_id is null or v_reason is null then raise exception 'payment and reversal reason are required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'reversal reason is too long' using errcode='22001'; end if;
  select * into v_payment from public.finance_customer_invoice_payments where id=p_payment_id for update;
  if v_payment.id is null then raise exception 'invoice payment not found' using errcode='P0002'; end if;
  if v_payment.status<>'active' then raise exception 'only an active invoice payment can be reversed' using errcode='22023'; end if;
  select * into v_invoice from public.finance_customer_invoices where id=v_payment.invoice_id for update;
  if v_invoice.status='void' then raise exception 'void invoice payment state is invalid' using errcode='22023'; end if;
  if v_payment.manual_sale_id is not null then
    select * into v_sale from public.finance_manual_sales where id=v_payment.manual_sale_id for update;
    if v_sale.id is null then raise exception 'linked Finance sale is missing' using errcode='P0002'; end if;
    if v_sale.status='paid' then update public.finance_manual_sales set status='void',voided_at=now(),voided_by=auth.uid(),void_reason='AR payment reversed: '||v_reason where id=v_sale.id; end if;
  end if;
  update public.finance_customer_invoice_payments set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reverse_reason=v_reason where id=p_payment_id returning * into v_after_payment;
  select coalesce(sum(amount),0) into v_active_total from public.finance_customer_invoice_payments where invoice_id=v_invoice.id and status='active';
  update public.finance_customer_invoices set status=case when v_active_total<=0.01 then 'open' else 'partially_paid' end,paid_at=null,updated_at=now() where id=v_invoice.id returning * into v_after;
  insert into public.finance_customer_invoice_events(invoice_id,event_type,reason,before_snapshot,after_snapshot,created_by) values(v_invoice.id,'payment_reversed',v_reason,to_jsonb(v_payment),jsonb_build_object('payment',to_jsonb(v_after_payment),'invoice',to_jsonb(v_after)),auth.uid());
  return jsonb_build_object('payment',to_jsonb(v_after_payment),'invoice',to_jsonb(v_after));
end; $$;

create or replace function private.finance_void_customer_invoice_impl(p_invoice_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_before public.finance_customer_invoices; v_after public.finance_customer_invoices; v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_invoice_id is null or v_reason is null then raise exception 'invoice and void reason are required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'void reason is too long' using errcode='22001'; end if;
  select * into v_before from public.finance_customer_invoices where id=p_invoice_id for update;
  if v_before.id is null then raise exception 'customer invoice not found' using errcode='P0002'; end if;
  if v_before.status not in ('draft','open') then raise exception 'reverse active payments before voiding this invoice' using errcode='22023'; end if;
  if exists(select 1 from public.finance_customer_invoice_payments where invoice_id=p_invoice_id and status='active') then raise exception 'reverse active payments before voiding this invoice' using errcode='22023'; end if;
  update public.finance_customer_invoices set status='void',paid_at=null,voided_at=now(),voided_by=auth.uid(),void_reason=v_reason,updated_at=now() where id=p_invoice_id returning * into v_after;
  insert into public.finance_customer_invoice_events(invoice_id,event_type,reason,before_snapshot,after_snapshot,created_by) values(p_invoice_id,'voided',v_reason,to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_get_customer_receivables_impl(p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_limit integer:=greatest(25,least(1000,coalesce(p_limit,500))); v_today date:=(now() at time zone 'America/Regina')::date; v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  with payment_totals as (
    select invoice_id,coalesce(sum(amount) filter(where status='active'),0) paid_total from public.finance_customer_invoice_payments group by invoice_id
  ), rows as (
    select i.*,coalesce(pt.paid_total,0) paid_total,round(i.total-coalesce(pt.paid_total,0),2) balance_due,
      coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_on desc,p.created_at desc) from public.finance_customer_invoice_payments p where p.invoice_id=i.id),'[]'::jsonb) payments
    from public.finance_customer_invoices i left join payment_totals pt on pt.invoice_id=i.id
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'summary',jsonb_build_object(
      'draftCount',(select count(*) from rows where status='draft'),
      'outstandingCount',(select count(*) from rows where status in ('open','partially_paid')),
      'outstandingTotal',coalesce((select sum(balance_due) from rows where status in ('open','partially_paid')),0),
      'overdueCount',(select count(*) from rows where status in ('open','partially_paid') and due_date<v_today),
      'overdueTotal',coalesce((select sum(balance_due) from rows where status in ('open','partially_paid') and due_date<v_today),0),
      'due30Total',coalesce((select sum(balance_due) from rows where status in ('open','partially_paid') and due_date between v_today and v_today+30),0),
      'paidCount',(select count(*) from rows where status='paid'),
      'paidTotal',coalesce((select sum(total) from rows where status='paid'),0)
    ),
    'invoices',coalesce((select jsonb_agg(to_jsonb(x) order by case x.status when 'partially_paid' then 0 when 'open' then 1 when 'draft' then 2 when 'paid' then 3 else 4 end,x.due_date,x.created_at desc) from (select * from rows order by created_at desc limit v_limit) x),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select id,invoice_id,event_type,reason,created_at from public.finance_customer_invoice_events order by created_at desc limit 300) e),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

revoke all on function private.finance_create_customer_invoice_impl(date,date,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) from public,anon;
revoke all on function private.finance_update_customer_invoice_impl(uuid,date,date,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) from public,anon;
revoke all on function private.finance_issue_customer_invoice_impl(uuid) from public,anon;
revoke all on function private.finance_record_customer_invoice_payment_impl(uuid,date,text,numeric,text,text) from public,anon;
revoke all on function private.finance_reverse_customer_invoice_payment_impl(uuid,text) from public,anon;
revoke all on function private.finance_void_customer_invoice_impl(uuid,text) from public,anon;
revoke all on function private.finance_get_customer_receivables_impl(integer) from public,anon;
grant execute on function private.finance_create_customer_invoice_impl(date,date,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) to authenticated,service_role;
grant execute on function private.finance_update_customer_invoice_impl(uuid,date,date,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) to authenticated,service_role;
grant execute on function private.finance_issue_customer_invoice_impl(uuid) to authenticated,service_role;
grant execute on function private.finance_record_customer_invoice_payment_impl(uuid,date,text,numeric,text,text) to authenticated,service_role;
grant execute on function private.finance_reverse_customer_invoice_payment_impl(uuid,text) to authenticated,service_role;
grant execute on function private.finance_void_customer_invoice_impl(uuid,text) to authenticated,service_role;
grant execute on function private.finance_get_customer_receivables_impl(integer) to authenticated,service_role;

create or replace function public.create_admin_customer_invoice(p_issue_date date,p_due_date date,p_customer_name text,p_customer_email text default null,p_customer_phone text default null,p_reference text default null,p_subtotal numeric default 0,p_discount numeric default 0,p_shipping numeric default 0,p_gst_hst_tax numeric default 0,p_pst_tax numeric default 0,p_cogs numeric default 0,p_notes text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_create_customer_invoice_impl(p_issue_date,p_due_date,p_customer_name,p_customer_email,p_customer_phone,p_reference,p_subtotal,p_discount,p_shipping,p_gst_hst_tax,p_pst_tax,p_cogs,p_notes); $$;
create or replace function public.update_admin_customer_invoice(p_invoice_id uuid,p_issue_date date,p_due_date date,p_customer_name text,p_customer_email text default null,p_customer_phone text default null,p_reference text default null,p_subtotal numeric default 0,p_discount numeric default 0,p_shipping numeric default 0,p_gst_hst_tax numeric default 0,p_pst_tax numeric default 0,p_cogs numeric default 0,p_notes text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_update_customer_invoice_impl(p_invoice_id,p_issue_date,p_due_date,p_customer_name,p_customer_email,p_customer_phone,p_reference,p_subtotal,p_discount,p_shipping,p_gst_hst_tax,p_pst_tax,p_cogs,p_notes); $$;
create or replace function public.issue_admin_customer_invoice(p_invoice_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_issue_customer_invoice_impl(p_invoice_id); $$;
create or replace function public.record_admin_customer_invoice_payment(p_invoice_id uuid,p_paid_on date,p_payment_method text,p_amount numeric,p_payment_reference text default null,p_payment_note text default null) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_record_customer_invoice_payment_impl(p_invoice_id,p_paid_on,p_payment_method,p_amount,p_payment_reference,p_payment_note); $$;
create or replace function public.reverse_admin_customer_invoice_payment(p_payment_id uuid,p_reason text) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_reverse_customer_invoice_payment_impl(p_payment_id,p_reason); $$;
create or replace function public.void_admin_customer_invoice(p_invoice_id uuid,p_reason text) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_void_customer_invoice_impl(p_invoice_id,p_reason); $$;
create or replace function public.get_admin_customer_receivables(p_limit integer default 500) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$ select private.finance_get_customer_receivables_impl(p_limit); $$;

revoke all on function public.create_admin_customer_invoice(date,date,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) from public,anon;
revoke all on function public.update_admin_customer_invoice(uuid,date,date,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) from public,anon;
revoke all on function public.issue_admin_customer_invoice(uuid) from public,anon;
revoke all on function public.record_admin_customer_invoice_payment(uuid,date,text,numeric,text,text) from public,anon;
revoke all on function public.reverse_admin_customer_invoice_payment(uuid,text) from public,anon;
revoke all on function public.void_admin_customer_invoice(uuid,text) from public,anon;
revoke all on function public.get_admin_customer_receivables(integer) from public,anon;
grant execute on function public.create_admin_customer_invoice(date,date,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) to authenticated,service_role;
grant execute on function public.update_admin_customer_invoice(uuid,date,date,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) to authenticated,service_role;
grant execute on function public.issue_admin_customer_invoice(uuid) to authenticated,service_role;
grant execute on function public.record_admin_customer_invoice_payment(uuid,date,text,numeric,text,text) to authenticated,service_role;
grant execute on function public.reverse_admin_customer_invoice_payment(uuid,text) to authenticated,service_role;
grant execute on function public.void_admin_customer_invoice(uuid,text) to authenticated,service_role;
grant execute on function public.get_admin_customer_receivables(integer) to authenticated,service_role;

create or replace function public.void_admin_manual_sale(p_sale_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_reason text:=nullif(trim(coalesce(p_reason,'')),''); v_row public.finance_manual_sales;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if v_reason is null then raise exception 'void reason is required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'void reason is too long' using errcode='22001'; end if;
  select * into v_row from public.finance_manual_sales where id=p_sale_id for update;
  if v_row.id is null then raise exception 'manual sale not found' using errcode='P0002'; end if;
  if v_row.status='void' then raise exception 'manual sale is already void' using errcode='22023'; end if;
  if coalesce(v_row.source_type,'manual')='receivable_payment' then raise exception 'reverse this payment from Accounts Receivable instead of voiding its linked Finance sale' using errcode='22023'; end if;
  update public.finance_manual_sales set status='void',voided_at=now(),voided_by=auth.uid(),void_reason=v_reason where id=p_sale_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;
revoke all on function public.void_admin_manual_sale(uuid,text) from public,anon;
grant execute on function public.void_admin_manual_sale(uuid,text) to authenticated,service_role;

commit;
