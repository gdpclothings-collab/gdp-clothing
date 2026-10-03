create sequence if not exists public.finance_purchase_order_seq start 1;
revoke all on sequence public.finance_purchase_order_seq from anon, authenticated;
grant all on sequence public.finance_purchase_order_seq to service_role;

create table if not exists public.finance_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  account_number text,
  payment_terms_days integer not null default 0,
  notes text,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid,
  archive_reason text,
  constraint finance_suppliers_terms_chk check (payment_terms_days between 0 and 365),
  constraint finance_suppliers_status_chk check (status in ('active','archived')),
  constraint finance_suppliers_state_chk check (
    (status='active' and archived_at is null and archived_by is null and archive_reason is null)
    or
    (status='archived' and archived_at is not null and archived_by is not null and nullif(trim(archive_reason),'') is not null)
  )
);
create unique index if not exists finance_suppliers_name_unique_idx on public.finance_suppliers(lower(name));
create index if not exists finance_suppliers_status_name_idx on public.finance_suppliers(status,lower(name));

create table if not exists public.finance_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid not null references public.finance_suppliers(id) on delete restrict,
  order_date date not null,
  expected_date date,
  status text not null default 'draft',
  currency text not null default 'CAD',
  subtotal numeric(14,2) not null default 0,
  gst_hst_tax numeric(14,2) not null default 0,
  pst_tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  constraint finance_purchase_orders_dates_chk check (expected_date is null or expected_date >= order_date),
  constraint finance_purchase_orders_status_chk check (status in ('draft','approved','cancelled')),
  constraint finance_purchase_orders_currency_chk check (currency='CAD'),
  constraint finance_purchase_orders_amount_chk check (subtotal >= 0 and gst_hst_tax >= 0 and pst_tax >= 0 and total >= 0 and total = round(subtotal + gst_hst_tax + pst_tax,2)),
  constraint finance_purchase_orders_state_chk check (
    (status='draft' and approved_at is null and approved_by is null and cancelled_at is null and cancelled_by is null and cancel_reason is null)
    or
    (status='approved' and approved_at is not null and approved_by is not null and cancelled_at is null and cancelled_by is null and cancel_reason is null)
    or
    (status='cancelled' and cancelled_at is not null and cancelled_by is not null and nullif(trim(cancel_reason),'') is not null)
  )
);
create index if not exists finance_purchase_orders_status_expected_idx on public.finance_purchase_orders(status,expected_date);
create index if not exists finance_purchase_orders_supplier_idx on public.finance_purchase_orders(supplier_id,created_at desc);

create table if not exists public.finance_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.finance_purchase_orders(id) on delete restrict,
  line_number integer not null,
  sku text,
  description text not null,
  quantity numeric(12,3) not null,
  unit_cost numeric(12,4) not null,
  gst_hst_tax numeric(12,2) not null default 0,
  pst_tax numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint finance_purchase_order_items_line_chk check (line_number > 0),
  constraint finance_purchase_order_items_qty_chk check (quantity > 0),
  constraint finance_purchase_order_items_cost_chk check (unit_cost >= 0 and gst_hst_tax >= 0 and pst_tax >= 0),
  unique(purchase_order_id,line_number)
);
create index if not exists finance_purchase_order_items_po_idx on public.finance_purchase_order_items(purchase_order_id,line_number);

create table if not exists public.finance_purchase_order_events (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.finance_purchase_orders(id) on delete restrict,
  event_type text not null check (event_type in ('created','updated','approved','cancelled')),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists finance_purchase_order_events_po_idx on public.finance_purchase_order_events(purchase_order_id,created_at desc);

alter table public.finance_suppliers enable row level security;
alter table public.finance_purchase_orders enable row level security;
alter table public.finance_purchase_order_items enable row level security;
alter table public.finance_purchase_order_events enable row level security;

revoke all on table public.finance_suppliers, public.finance_purchase_orders, public.finance_purchase_order_items, public.finance_purchase_order_events from anon;
revoke insert, update, delete on table public.finance_suppliers, public.finance_purchase_orders, public.finance_purchase_order_items, public.finance_purchase_order_events from authenticated;
grant select on table public.finance_suppliers, public.finance_purchase_orders, public.finance_purchase_order_items, public.finance_purchase_order_events to authenticated;
grant all on table public.finance_suppliers, public.finance_purchase_orders, public.finance_purchase_order_items, public.finance_purchase_order_events to service_role;

drop policy if exists finance_suppliers_admin_select on public.finance_suppliers;
create policy finance_suppliers_admin_select on public.finance_suppliers for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_purchase_orders_admin_select on public.finance_purchase_orders;
create policy finance_purchase_orders_admin_select on public.finance_purchase_orders for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_purchase_order_items_admin_select on public.finance_purchase_order_items;
create policy finance_purchase_order_items_admin_select on public.finance_purchase_order_items for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_purchase_order_events_admin_select on public.finance_purchase_order_events;
create policy finance_purchase_order_events_admin_select on public.finance_purchase_order_events for select to authenticated using ((select public.is_admin_step_up_authorized()));

create or replace function private.finance_recalc_purchase_order(p_po_id uuid)
returns public.finance_purchase_orders language plpgsql security definer set search_path=pg_catalog as $$
declare v_po public.finance_purchase_orders;
begin
  update public.finance_purchase_orders po
  set subtotal=x.subtotal,gst_hst_tax=x.gst,pst_tax=x.pst,total=round(x.subtotal+x.gst+x.pst,2),updated_at=now()
  from (select coalesce(round(sum(round(i.quantity*i.unit_cost,2)),2),0)::numeric(14,2) subtotal,coalesce(round(sum(i.gst_hst_tax),2),0)::numeric(14,2) gst,coalesce(round(sum(i.pst_tax),2),0)::numeric(14,2) pst from public.finance_purchase_order_items i where i.purchase_order_id=p_po_id) x
  where po.id=p_po_id returning po.* into v_po;
  return v_po;
end; $$;
revoke all on function private.finance_recalc_purchase_order(uuid) from public,anon,authenticated;
grant execute on function private.finance_recalc_purchase_order(uuid) to service_role;

create or replace function private.finance_create_supplier_impl(p_name text,p_contact_name text default null,p_email text default null,p_phone text default null,p_website text default null,p_account_number text default null,p_payment_terms_days integer default 0,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_row public.finance_suppliers; v_name text:=nullif(trim(coalesce(p_name,'')),''); v_contact text:=nullif(trim(coalesce(p_contact_name,'')),''); v_email text:=nullif(lower(trim(coalesce(p_email,''))),''); v_phone text:=nullif(trim(coalesce(p_phone,'')),''); v_website text:=nullif(trim(coalesce(p_website,'')),''); v_account text:=nullif(trim(coalesce(p_account_number,'')),''); v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if v_name is null then raise exception 'supplier name is required' using errcode='22023'; end if;
  if coalesce(p_payment_terms_days,0)<0 or coalesce(p_payment_terms_days,0)>365 then raise exception 'payment terms must be between 0 and 365 days' using errcode='22023'; end if;
  if char_length(v_name)>200 or char_length(coalesce(v_contact,''))>200 or char_length(coalesce(v_email,''))>320 or char_length(coalesce(v_phone,''))>80 or char_length(coalesce(v_website,''))>500 or char_length(coalesce(v_account,''))>160 or char_length(coalesce(v_notes,''))>1500 then raise exception 'one or more supplier fields are too long' using errcode='22001'; end if;
  insert into public.finance_suppliers(name,contact_name,email,phone,website,account_number,payment_terms_days,notes,status,created_by,created_at,updated_at) values(v_name,v_contact,v_email,v_phone,v_website,v_account,coalesce(p_payment_terms_days,0),v_notes,'active',auth.uid(),now(),now()) returning * into v_row;
  return to_jsonb(v_row);
exception when unique_violation then raise exception 'a supplier with this name already exists' using errcode='23505';
end; $$;

create or replace function private.finance_update_supplier_impl(p_supplier_id uuid,p_name text,p_contact_name text default null,p_email text default null,p_phone text default null,p_website text default null,p_account_number text default null,p_payment_terms_days integer default 0,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_row public.finance_suppliers; v_name text:=nullif(trim(coalesce(p_name,'')),''); v_contact text:=nullif(trim(coalesce(p_contact_name,'')),''); v_email text:=nullif(lower(trim(coalesce(p_email,''))),''); v_phone text:=nullif(trim(coalesce(p_phone,'')),''); v_website text:=nullif(trim(coalesce(p_website,'')),''); v_account text:=nullif(trim(coalesce(p_account_number,'')),''); v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_supplier_id is null or v_name is null then raise exception 'supplier and name are required' using errcode='22023'; end if;
  if coalesce(p_payment_terms_days,0)<0 or coalesce(p_payment_terms_days,0)>365 then raise exception 'payment terms must be between 0 and 365 days' using errcode='22023'; end if;
  if char_length(v_name)>200 or char_length(coalesce(v_contact,''))>200 or char_length(coalesce(v_email,''))>320 or char_length(coalesce(v_phone,''))>80 or char_length(coalesce(v_website,''))>500 or char_length(coalesce(v_account,''))>160 or char_length(coalesce(v_notes,''))>1500 then raise exception 'one or more supplier fields are too long' using errcode='22001'; end if;
  update public.finance_suppliers set name=v_name,contact_name=v_contact,email=v_email,phone=v_phone,website=v_website,account_number=v_account,payment_terms_days=coalesce(p_payment_terms_days,0),notes=v_notes,updated_at=now() where id=p_supplier_id and status='active' returning * into v_row;
  if v_row.id is null then raise exception 'active supplier not found' using errcode='P0002'; end if;
  return to_jsonb(v_row);
exception when unique_violation then raise exception 'a supplier with this name already exists' using errcode='23505';
end; $$;

create or replace function private.finance_archive_supplier_impl(p_supplier_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_row public.finance_suppliers; v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_supplier_id is null or v_reason is null then raise exception 'supplier and archive reason are required' using errcode='22023'; end if;
  if exists(select 1 from public.finance_purchase_orders where supplier_id=p_supplier_id and status in ('draft','approved')) then raise exception 'supplier has active purchase orders and cannot be archived' using errcode='22023'; end if;
  update public.finance_suppliers set status='archived',archived_at=now(),archived_by=auth.uid(),archive_reason=v_reason,updated_at=now() where id=p_supplier_id and status='active' returning * into v_row;
  if v_row.id is null then raise exception 'active supplier not found' using errcode='P0002'; end if;
  return to_jsonb(v_row);
end; $$;

create or replace function private.finance_write_purchase_order_items(p_po_id uuid,p_items jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v_item jsonb; v_line integer:=0; v_desc text; v_sku text; v_qty numeric; v_cost numeric; v_gst numeric; v_pst numeric;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'purchase order requires at least one line item' using errcode='22023'; end if;
  if jsonb_array_length(p_items)>100 then raise exception 'purchase order cannot exceed 100 line items' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line:=v_line+1; v_desc:=nullif(trim(coalesce(v_item->>'description','')),''); v_sku:=nullif(trim(coalesce(v_item->>'sku','')),'');
    begin v_qty:=(v_item->>'quantity')::numeric; exception when others then raise exception 'line % quantity is invalid',v_line using errcode='22023'; end;
    begin v_cost:=(v_item->>'unitCost')::numeric; exception when others then raise exception 'line % unit cost is invalid',v_line using errcode='22023'; end;
    begin v_gst:=coalesce(nullif(v_item->>'gstHstTax','')::numeric,0); exception when others then raise exception 'line % GST/HST is invalid',v_line using errcode='22023'; end;
    begin v_pst:=coalesce(nullif(v_item->>'pstTax','')::numeric,0); exception when others then raise exception 'line % PST is invalid',v_line using errcode='22023'; end;
    if v_desc is null or v_qty<=0 or v_cost<0 or v_gst<0 or v_pst<0 then raise exception 'line % has invalid values',v_line using errcode='22023'; end if;
    if char_length(v_desc)>500 or char_length(coalesce(v_sku,''))>160 then raise exception 'line % text is too long',v_line using errcode='22001'; end if;
    insert into public.finance_purchase_order_items(purchase_order_id,line_number,sku,description,quantity,unit_cost,gst_hst_tax,pst_tax) values(p_po_id,v_line,v_sku,v_desc,round(v_qty,3),round(v_cost,4),round(v_gst,2),round(v_pst,2));
  end loop;
end; $$;
revoke all on function private.finance_write_purchase_order_items(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.finance_write_purchase_order_items(uuid,jsonb) to service_role;

create or replace function private.finance_create_purchase_order_impl(p_supplier_id uuid,p_order_date date,p_expected_date date default null,p_notes text default null,p_items jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_po public.finance_purchase_orders; v_supplier public.finance_suppliers; v_notes text:=nullif(trim(coalesce(p_notes,'')),''); v_today date:=(now() at time zone 'America/Regina')::date; v_po_number text;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_supplier_id is null or p_order_date is null then raise exception 'supplier and order date are required' using errcode='22023'; end if;
  if p_order_date>v_today then raise exception 'purchase order date cannot be in the future' using errcode='22023'; end if;
  if p_expected_date is not null and p_expected_date<p_order_date then raise exception 'expected date cannot be before order date' using errcode='22023'; end if;
  if char_length(coalesce(v_notes,''))>1500 then raise exception 'purchase order notes are too long' using errcode='22001'; end if;
  select * into v_supplier from public.finance_suppliers where id=p_supplier_id and status='active' for share;
  if v_supplier.id is null then raise exception 'active supplier not found' using errcode='P0002'; end if;
  v_po_number:='PO-'||to_char(v_today,'YYYYMMDD')||'-'||lpad(nextval('public.finance_purchase_order_seq'::regclass)::text,5,'0');
  insert into public.finance_purchase_orders(po_number,supplier_id,order_date,expected_date,status,currency,notes,created_by,created_at,updated_at) values(v_po_number,p_supplier_id,p_order_date,p_expected_date,'draft','CAD',v_notes,auth.uid(),now(),now()) returning * into v_po;
  perform private.finance_write_purchase_order_items(v_po.id,p_items); v_po:=private.finance_recalc_purchase_order(v_po.id);
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,after_snapshot,created_by) values(v_po.id,'created',to_jsonb(v_po),auth.uid());
  return to_jsonb(v_po);
end; $$;

create or replace function private.finance_update_purchase_order_impl(p_po_id uuid,p_supplier_id uuid,p_order_date date,p_expected_date date default null,p_notes text default null,p_items jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_before public.finance_purchase_orders; v_after public.finance_purchase_orders; v_supplier public.finance_suppliers; v_notes text:=nullif(trim(coalesce(p_notes,'')),''); v_today date:=(now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_po_id is null or p_supplier_id is null or p_order_date is null then raise exception 'purchase order, supplier and order date are required' using errcode='22023'; end if;
  if p_order_date>v_today then raise exception 'purchase order date cannot be in the future' using errcode='22023'; end if;
  if p_expected_date is not null and p_expected_date<p_order_date then raise exception 'expected date cannot be before order date' using errcode='22023'; end if;
  if char_length(coalesce(v_notes,''))>1500 then raise exception 'purchase order notes are too long' using errcode='22001'; end if;
  select * into v_before from public.finance_purchase_orders where id=p_po_id for update;
  if v_before.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
  if v_before.status<>'draft' then raise exception 'only draft purchase orders can be edited' using errcode='22023'; end if;
  select * into v_supplier from public.finance_suppliers where id=p_supplier_id and status='active' for share;
  if v_supplier.id is null then raise exception 'active supplier not found' using errcode='P0002'; end if;
  update public.finance_purchase_orders set supplier_id=p_supplier_id,order_date=p_order_date,expected_date=p_expected_date,notes=v_notes,updated_at=now() where id=p_po_id;
  delete from public.finance_purchase_order_items where purchase_order_id=p_po_id;
  perform private.finance_write_purchase_order_items(p_po_id,p_items); v_after:=private.finance_recalc_purchase_order(p_po_id);
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,before_snapshot,after_snapshot,created_by) values(p_po_id,'updated',to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_approve_purchase_order_impl(p_po_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_before public.finance_purchase_orders; v_after public.finance_purchase_orders;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  select * into v_before from public.finance_purchase_orders where id=p_po_id for update;
  if v_before.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
  if v_before.status<>'draft' then raise exception 'only draft purchase orders can be approved' using errcode='22023'; end if;
  if not exists(select 1 from public.finance_purchase_order_items where purchase_order_id=p_po_id) then raise exception 'purchase order requires at least one item' using errcode='22023'; end if;
  if not exists(select 1 from public.finance_suppliers where id=v_before.supplier_id and status='active') then raise exception 'supplier must be active before approval' using errcode='22023'; end if;
  update public.finance_purchase_orders set status='approved',approved_at=now(),approved_by=auth.uid(),updated_at=now() where id=p_po_id returning * into v_after;
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,before_snapshot,after_snapshot,created_by) values(p_po_id,'approved',to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_cancel_purchase_order_impl(p_po_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_before public.finance_purchase_orders; v_after public.finance_purchase_orders; v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if v_reason is null then raise exception 'cancellation reason is required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'cancellation reason is too long' using errcode='22001'; end if;
  select * into v_before from public.finance_purchase_orders where id=p_po_id for update;
  if v_before.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
  if v_before.status not in ('draft','approved') then raise exception 'purchase order is already cancelled' using errcode='22023'; end if;
  update public.finance_purchase_orders set status='cancelled',approved_at=case when v_before.status='approved' then v_before.approved_at else null end,approved_by=case when v_before.status='approved' then v_before.approved_by else null end,cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=v_reason,updated_at=now() where id=p_po_id returning * into v_after;
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,before_snapshot,after_snapshot,created_by) values(p_po_id,'cancelled',v_reason,to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_get_purchasing_impl(p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_limit integer:=greatest(25,least(1000,coalesce(p_limit,500))); v_today date:=(now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  return (
    with po_rows as (
      select po.*,s.name as supplier_name,coalesce((select jsonb_agg(to_jsonb(i) order by i.line_number) from public.finance_purchase_order_items i where i.purchase_order_id=po.id),'[]'::jsonb) as items
      from public.finance_purchase_orders po join public.finance_suppliers s on s.id=po.supplier_id
    ), limited as (
      select * from po_rows order by case status when 'draft' then 0 when 'approved' then 1 else 2 end,coalesce(expected_date,order_date),created_at desc limit v_limit
    )
    select jsonb_build_object('generatedAt',now(),'summary',jsonb_build_object(
      'activeSuppliers',(select count(*) from public.finance_suppliers where status='active'),
      'draftCount',(select count(*) from public.finance_purchase_orders where status='draft'),
      'draftTotal',coalesce((select sum(total) from public.finance_purchase_orders where status='draft'),0),
      'approvedCount',(select count(*) from public.finance_purchase_orders where status='approved'),
      'approvedTotal',coalesce((select sum(total) from public.finance_purchase_orders where status='approved'),0),
      'expected7Total',coalesce((select sum(total) from public.finance_purchase_orders where status='approved' and expected_date between v_today and v_today+7),0),
      'expected30Total',coalesce((select sum(total) from public.finance_purchase_orders where status='approved' and expected_date between v_today and v_today+30),0),
      'cancelledCount',(select count(*) from public.finance_purchase_orders where status='cancelled')),
      'suppliers',coalesce((select jsonb_agg(to_jsonb(s) order by case when s.status='active' then 0 else 1 end,lower(s.name)) from public.finance_suppliers s),'[]'::jsonb),
      'purchaseOrders',coalesce((select jsonb_agg(to_jsonb(l) order by case l.status when 'draft' then 0 when 'approved' then 1 else 2 end,coalesce(l.expected_date,l.order_date),l.created_at desc) from limited l),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select id,purchase_order_id,event_type,reason,created_at from public.finance_purchase_order_events order by created_at desc limit least(v_limit*4,2000)) e),'[]'::jsonb))
  );
end; $$;

revoke all on function private.finance_create_supplier_impl(text,text,text,text,text,text,integer,text) from public,anon;
revoke all on function private.finance_update_supplier_impl(uuid,text,text,text,text,text,text,integer,text) from public,anon;
revoke all on function private.finance_archive_supplier_impl(uuid,text) from public,anon;
revoke all on function private.finance_create_purchase_order_impl(uuid,date,date,text,jsonb) from public,anon;
revoke all on function private.finance_update_purchase_order_impl(uuid,uuid,date,date,text,jsonb) from public,anon;
revoke all on function private.finance_approve_purchase_order_impl(uuid) from public,anon;
revoke all on function private.finance_cancel_purchase_order_impl(uuid,text) from public,anon;
revoke all on function private.finance_get_purchasing_impl(integer) from public,anon;
grant execute on function private.finance_create_supplier_impl(text,text,text,text,text,text,integer,text) to authenticated,service_role;
grant execute on function private.finance_update_supplier_impl(uuid,text,text,text,text,text,text,integer,text) to authenticated,service_role;
grant execute on function private.finance_archive_supplier_impl(uuid,text) to authenticated,service_role;
grant execute on function private.finance_create_purchase_order_impl(uuid,date,date,text,jsonb) to authenticated,service_role;
grant execute on function private.finance_update_purchase_order_impl(uuid,uuid,date,date,text,jsonb) to authenticated,service_role;
grant execute on function private.finance_approve_purchase_order_impl(uuid) to authenticated,service_role;
grant execute on function private.finance_cancel_purchase_order_impl(uuid,text) to authenticated,service_role;
grant execute on function private.finance_get_purchasing_impl(integer) to authenticated,service_role;

create or replace function public.create_admin_supplier(p_name text,p_contact_name text default null,p_email text default null,p_phone text default null,p_website text default null,p_account_number text default null,p_payment_terms_days integer default 0,p_notes text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_create_supplier_impl(p_name,p_contact_name,p_email,p_phone,p_website,p_account_number,p_payment_terms_days,p_notes); $$;
create or replace function public.update_admin_supplier(p_supplier_id uuid,p_name text,p_contact_name text default null,p_email text default null,p_phone text default null,p_website text default null,p_account_number text default null,p_payment_terms_days integer default 0,p_notes text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_update_supplier_impl(p_supplier_id,p_name,p_contact_name,p_email,p_phone,p_website,p_account_number,p_payment_terms_days,p_notes); $$;
create or replace function public.archive_admin_supplier(p_supplier_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_archive_supplier_impl(p_supplier_id,p_reason); $$;
create or replace function public.create_admin_purchase_order(p_supplier_id uuid,p_order_date date,p_expected_date date default null,p_notes text default null,p_items jsonb default '[]'::jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_create_purchase_order_impl(p_supplier_id,p_order_date,p_expected_date,p_notes,p_items); $$;
create or replace function public.update_admin_purchase_order(p_po_id uuid,p_supplier_id uuid,p_order_date date,p_expected_date date default null,p_notes text default null,p_items jsonb default '[]'::jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_update_purchase_order_impl(p_po_id,p_supplier_id,p_order_date,p_expected_date,p_notes,p_items); $$;
create or replace function public.approve_admin_purchase_order(p_po_id uuid)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_approve_purchase_order_impl(p_po_id); $$;
create or replace function public.cancel_admin_purchase_order(p_po_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_cancel_purchase_order_impl(p_po_id,p_reason); $$;
create or replace function public.get_admin_purchasing(p_limit integer default 500)
returns jsonb language sql stable security invoker set search_path=pg_catalog as $$ select private.finance_get_purchasing_impl(p_limit); $$;

revoke all on function public.create_admin_supplier(text,text,text,text,text,text,integer,text) from public,anon;
revoke all on function public.update_admin_supplier(uuid,text,text,text,text,text,text,integer,text) from public,anon;
revoke all on function public.archive_admin_supplier(uuid,text) from public,anon;
revoke all on function public.create_admin_purchase_order(uuid,date,date,text,jsonb) from public,anon;
revoke all on function public.update_admin_purchase_order(uuid,uuid,date,date,text,jsonb) from public,anon;
revoke all on function public.approve_admin_purchase_order(uuid) from public,anon;
revoke all on function public.cancel_admin_purchase_order(uuid,text) from public,anon;
revoke all on function public.get_admin_purchasing(integer) from public,anon;
grant execute on function public.create_admin_supplier(text,text,text,text,text,text,integer,text) to authenticated,service_role;
grant execute on function public.update_admin_supplier(uuid,text,text,text,text,text,text,integer,text) to authenticated,service_role;
grant execute on function public.archive_admin_supplier(uuid,text) to authenticated,service_role;
grant execute on function public.create_admin_purchase_order(uuid,date,date,text,jsonb) to authenticated,service_role;
grant execute on function public.update_admin_purchase_order(uuid,uuid,date,date,text,jsonb) to authenticated,service_role;
grant execute on function public.approve_admin_purchase_order(uuid) to authenticated,service_role;
grant execute on function public.cancel_admin_purchase_order(uuid,text) to authenticated,service_role;
grant execute on function public.get_admin_purchasing(integer) to authenticated,service_role;
