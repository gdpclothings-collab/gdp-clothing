alter table public.finance_purchase_order_items
  add column if not exists inventory_variant_id uuid references public.product_variants(id) on delete restrict;
create index if not exists finance_purchase_order_items_inventory_variant_idx on public.finance_purchase_order_items(inventory_variant_id) where inventory_variant_id is not null;

alter table public.finance_vendor_bills
  add column if not exists purchase_order_id uuid references public.finance_purchase_orders(id) on delete restrict,
  add column if not exists supplier_id uuid references public.finance_suppliers(id) on delete restrict;
create index if not exists finance_vendor_bills_purchase_order_idx on public.finance_vendor_bills(purchase_order_id) where purchase_order_id is not null;
create index if not exists finance_vendor_bills_supplier_idx on public.finance_vendor_bills(supplier_id) where supplier_id is not null;

alter table public.finance_purchase_order_events drop constraint if exists finance_purchase_order_events_event_type_check;
alter table public.finance_purchase_order_events add constraint finance_purchase_order_events_event_type_check check (event_type in ('created','updated','approved','cancelled','received','receipt_reversed','bill_linked'));
alter table public.finance_vendor_bill_events drop constraint if exists finance_vendor_bill_events_event_type_check;
alter table public.finance_vendor_bill_events add constraint finance_vendor_bill_events_event_type_check check (event_type in ('created','paid','voided','po_linked'));

create sequence if not exists public.finance_purchase_receipt_seq start 1;
revoke all on sequence public.finance_purchase_receipt_seq from public, anon, authenticated;
grant all on sequence public.finance_purchase_receipt_seq to service_role;

create table if not exists public.finance_purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  purchase_order_id uuid not null references public.finance_purchase_orders(id) on delete restrict,
  received_date date not null,
  location_id uuid references public.inventory_locations(id) on delete restrict,
  notes text,
  status text not null default 'posted',
  created_by uuid,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reverse_reason text,
  constraint finance_purchase_receipts_status_chk check (status in ('posted','reversed')),
  constraint finance_purchase_receipts_state_chk check (
    (status='posted' and reversed_at is null and reversed_by is null and reverse_reason is null)
    or
    (status='reversed' and reversed_at is not null and reversed_by is not null and nullif(trim(reverse_reason),'') is not null)
  )
);
create index if not exists finance_purchase_receipts_po_date_idx on public.finance_purchase_receipts(purchase_order_id,received_date desc,created_at desc);
create index if not exists finance_purchase_receipts_status_idx on public.finance_purchase_receipts(status,received_date desc);

create table if not exists public.finance_purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.finance_purchase_receipts(id) on delete restrict,
  purchase_order_item_id uuid not null references public.finance_purchase_order_items(id) on delete restrict,
  quantity_received numeric(12,3) not null,
  inventory_adjustment_id uuid references public.inventory_adjustments(id) on delete restrict,
  reversal_adjustment_id uuid references public.inventory_adjustments(id) on delete restrict,
  before_available integer,
  after_available integer,
  created_at timestamptz not null default now(),
  constraint finance_purchase_receipt_items_qty_chk check (quantity_received > 0),
  constraint finance_purchase_receipt_items_inventory_shape_chk check (
    (inventory_adjustment_id is null and before_available is null and after_available is null)
    or
    (inventory_adjustment_id is not null and before_available is not null and after_available is not null and after_available >= before_available)
  ),
  unique(receipt_id,purchase_order_item_id)
);
create index if not exists finance_purchase_receipt_items_po_item_idx on public.finance_purchase_receipt_items(purchase_order_item_id);

alter table public.finance_purchase_receipts enable row level security;
alter table public.finance_purchase_receipt_items enable row level security;
revoke all on table public.finance_purchase_receipts, public.finance_purchase_receipt_items from anon;
revoke insert, update, delete on table public.finance_purchase_receipts, public.finance_purchase_receipt_items from authenticated;
grant select on table public.finance_purchase_receipts, public.finance_purchase_receipt_items to authenticated;
grant all on table public.finance_purchase_receipts, public.finance_purchase_receipt_items to service_role;

drop policy if exists finance_purchase_receipts_admin_select on public.finance_purchase_receipts;
create policy finance_purchase_receipts_admin_select on public.finance_purchase_receipts for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_purchase_receipt_items_admin_select on public.finance_purchase_receipt_items;
create policy finance_purchase_receipt_items_admin_select on public.finance_purchase_receipt_items for select to authenticated using ((select public.is_admin_step_up_authorized()));

create or replace function private.finance_write_purchase_order_items(p_po_id uuid,p_items jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_item jsonb;
  v_line integer:=0;
  v_desc text;
  v_sku text;
  v_qty numeric;
  v_cost numeric;
  v_gst numeric;
  v_pst numeric;
  v_variant_id uuid;
  v_variant_sku text;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'purchase order requires at least one line item' using errcode='22023'; end if;
  if jsonb_array_length(p_items)>100 then raise exception 'purchase order cannot exceed 100 line items' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line:=v_line+1;
    v_desc:=nullif(trim(coalesce(v_item->>'description','')),'');
    v_sku:=nullif(trim(coalesce(v_item->>'sku','')),'');
    v_variant_id:=null;
    v_variant_sku:=null;
    begin v_qty:=(v_item->>'quantity')::numeric; exception when others then raise exception 'line % quantity is invalid',v_line using errcode='22023'; end;
    begin v_cost:=(v_item->>'unitCost')::numeric; exception when others then raise exception 'line % unit cost is invalid',v_line using errcode='22023'; end;
    begin v_gst:=coalesce(nullif(v_item->>'gstHstTax','')::numeric,0); exception when others then raise exception 'line % GST/HST is invalid',v_line using errcode='22023'; end;
    begin v_pst:=coalesce(nullif(v_item->>'pstTax','')::numeric,0); exception when others then raise exception 'line % PST is invalid',v_line using errcode='22023'; end;
    if nullif(v_item->>'inventoryVariantId','') is not null then
      begin v_variant_id:=(v_item->>'inventoryVariantId')::uuid; exception when others then raise exception 'line % inventory variant is invalid',v_line using errcode='22023'; end;
      select sku into v_variant_sku from public.product_variants where id=v_variant_id and active is true;
      if v_variant_sku is null then raise exception 'line % inventory variant is not active',v_line using errcode='22023'; end if;
      if v_qty<>trunc(v_qty) then raise exception 'line % stock-linked quantity must be a whole number',v_line using errcode='22023'; end if;
      v_sku:=v_variant_sku;
    end if;
    if v_desc is null or v_qty<=0 or v_cost<0 or v_gst<0 or v_pst<0 then raise exception 'line % has invalid values',v_line using errcode='22023'; end if;
    if char_length(v_desc)>500 or char_length(coalesce(v_sku,''))>160 then raise exception 'line % text is too long',v_line using errcode='22001'; end if;
    insert into public.finance_purchase_order_items(purchase_order_id,line_number,sku,description,quantity,unit_cost,gst_hst_tax,pst_tax,inventory_variant_id)
    values(p_po_id,v_line,v_sku,v_desc,round(v_qty,3),round(v_cost,4),round(v_gst,2),round(v_pst,2),v_variant_id);
  end loop;
end; $$;
revoke all on function private.finance_write_purchase_order_items(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.finance_write_purchase_order_items(uuid,jsonb) to service_role;

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
  if exists(select 1 from public.finance_purchase_receipts where purchase_order_id=p_po_id and status='posted') then raise exception 'purchase order has posted receiving and cannot be cancelled' using errcode='22023'; end if;
  if exists(select 1 from public.finance_vendor_bills where purchase_order_id=p_po_id and status in ('open','paid')) then raise exception 'purchase order has a linked vendor bill and cannot be cancelled' using errcode='22023'; end if;
  update public.finance_purchase_orders set status='cancelled',approved_at=case when v_before.status='approved' then v_before.approved_at else null end,approved_by=case when v_before.status='approved' then v_before.approved_by else null end,cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=v_reason,updated_at=now() where id=p_po_id returning * into v_after;
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,before_snapshot,after_snapshot,created_by) values(p_po_id,'cancelled',v_reason,to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_post_purchase_receipt_impl(p_po_id uuid,p_received_date date,p_location_id uuid default null,p_notes text default null,p_items jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_po public.finance_purchase_orders;
  v_receipt public.finance_purchase_receipts;
  v_item jsonb;
  v_po_item public.finance_purchase_order_items;
  v_item_id uuid;
  v_qty numeric;
  v_received numeric;
  v_before integer;
  v_after integer;
  v_adjustment_id uuid;
  v_today date:=(now() at time zone 'America/Regina')::date;
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_receipt_number text;
  v_has_stock boolean:=false;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_po_id is null or p_received_date is null then raise exception 'purchase order and received date are required' using errcode='22023'; end if;
  if p_received_date>v_today then raise exception 'received date cannot be in the future' using errcode='22023'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'select at least one line to receive' using errcode='22023'; end if;
  if jsonb_array_length(p_items)>100 then raise exception 'receipt cannot exceed 100 lines' using errcode='22023'; end if;
  if char_length(coalesce(v_notes,''))>1500 then raise exception 'receipt notes are too long' using errcode='22001'; end if;
  select * into v_po from public.finance_purchase_orders where id=p_po_id for update;
  if v_po.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
  if v_po.status<>'approved' then raise exception 'only approved purchase orders can be received' using errcode='22023'; end if;
  if p_received_date<v_po.order_date then raise exception 'received date cannot be before purchase order date' using errcode='22023'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin v_item_id:=(v_item->>'purchaseOrderItemId')::uuid; exception when others then raise exception 'receipt line purchase order item is invalid' using errcode='22023'; end;
    begin v_qty:=(v_item->>'quantityReceived')::numeric; exception when others then raise exception 'receipt line quantity is invalid' using errcode='22023'; end;
    if v_qty<=0 then raise exception 'receipt quantities must be greater than zero' using errcode='22023'; end if;
    select * into v_po_item from public.finance_purchase_order_items where id=v_item_id and purchase_order_id=p_po_id for update;
    if v_po_item.id is null then raise exception 'receipt line is not part of this purchase order' using errcode='22023'; end if;
    select coalesce(sum(ri.quantity_received),0) into v_received
    from public.finance_purchase_receipt_items ri join public.finance_purchase_receipts r on r.id=ri.receipt_id
    where ri.purchase_order_item_id=v_item_id and r.status='posted';
    if v_received+v_qty>v_po_item.quantity then raise exception 'receipt quantity exceeds remaining quantity for line %',v_po_item.line_number using errcode='22023'; end if;
    if v_po_item.inventory_variant_id is not null then
      v_has_stock:=true;
      if v_qty<>trunc(v_qty) then raise exception 'stock-linked receipt quantities must be whole numbers' using errcode='22023'; end if;
    end if;
  end loop;

  if v_has_stock then
    if p_location_id is null then raise exception 'inventory location is required for stock-linked receiving' using errcode='22023'; end if;
    if not exists(select 1 from public.inventory_locations where id=p_location_id and active is true) then raise exception 'active inventory location not found' using errcode='22023'; end if;
  end if;

  v_receipt_number:='RCV-'||to_char(v_today,'YYYYMMDD')||'-'||lpad(nextval('public.finance_purchase_receipt_seq'::regclass)::text,5,'0');
  insert into public.finance_purchase_receipts(receipt_number,purchase_order_id,received_date,location_id,notes,status,created_by,created_at)
  values(v_receipt_number,p_po_id,p_received_date,case when v_has_stock then p_location_id else null end,v_notes,'posted',auth.uid(),now()) returning * into v_receipt;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_id:=(v_item->>'purchaseOrderItemId')::uuid;
    v_qty:=(v_item->>'quantityReceived')::numeric;
    select * into v_po_item from public.finance_purchase_order_items where id=v_item_id and purchase_order_id=p_po_id for update;
    v_adjustment_id:=null; v_before:=null; v_after:=null;
    if v_po_item.inventory_variant_id is not null then
      select available into v_before from public.inventory_levels where location_id=p_location_id and variant_id=v_po_item.inventory_variant_id for update;
      v_before:=coalesce(v_before,0);
      v_after:=v_before+v_qty::integer;
      insert into public.inventory_levels(location_id,variant_id,available)
      values(p_location_id,v_po_item.inventory_variant_id,v_after)
      on conflict(location_id,variant_id) do update set available=excluded.available,updated_at=now();
      insert into public.inventory_adjustments(location_id,variant_id,adjustment,before_quantity,after_quantity,reason,note,actor_user_id)
      values(p_location_id,v_po_item.inventory_variant_id,v_qty::integer,v_before,v_after,'purchase_receipt','PO '||v_po.po_number||' · '||v_receipt_number,auth.uid()) returning id into v_adjustment_id;
      update public.product_variants pv set stock=(select coalesce(sum(il.available),0) from public.inventory_levels il where il.variant_id=pv.id),updated_at=now() where pv.id=v_po_item.inventory_variant_id;
    end if;
    insert into public.finance_purchase_receipt_items(receipt_id,purchase_order_item_id,quantity_received,inventory_adjustment_id,before_available,after_available)
    values(v_receipt.id,v_item_id,round(v_qty,3),v_adjustment_id,v_before,v_after);
  end loop;

  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,after_snapshot,created_by)
  values(p_po_id,'received',v_receipt_number,jsonb_build_object('receiptId',v_receipt.id,'receiptNumber',v_receipt_number,'receivedDate',p_received_date,'locationId',v_receipt.location_id),auth.uid());
  return to_jsonb(v_receipt);
end; $$;

create or replace function private.finance_reverse_purchase_receipt_impl(p_receipt_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_receipt public.finance_purchase_receipts;
  v_after public.finance_purchase_receipts;
  v_line record;
  v_before integer;
  v_after_qty integer;
  v_adjustment_id uuid;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_po_number text;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_receipt_id is null or v_reason is null then raise exception 'receipt and reversal reason are required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'reversal reason is too long' using errcode='22001'; end if;
  select * into v_receipt from public.finance_purchase_receipts where id=p_receipt_id for update;
  if v_receipt.id is null then raise exception 'receipt not found' using errcode='P0002'; end if;
  if v_receipt.status<>'posted' then raise exception 'only posted receipts can be reversed' using errcode='22023'; end if;
  select po_number into v_po_number from public.finance_purchase_orders where id=v_receipt.purchase_order_id;

  for v_line in
    select ri.*,poi.inventory_variant_id
    from public.finance_purchase_receipt_items ri join public.finance_purchase_order_items poi on poi.id=ri.purchase_order_item_id
    where ri.receipt_id=p_receipt_id order by poi.line_number
  loop
    if v_line.inventory_variant_id is not null then
      select available into v_before from public.inventory_levels where location_id=v_receipt.location_id and variant_id=v_line.inventory_variant_id for update;
      if v_before is null or v_before<v_line.quantity_received then raise exception 'receipt cannot be reversed because linked stock has already been consumed or moved' using errcode='22023'; end if;
      v_after_qty:=v_before-v_line.quantity_received::integer;
      update public.inventory_levels set available=v_after_qty,updated_at=now() where location_id=v_receipt.location_id and variant_id=v_line.inventory_variant_id;
      insert into public.inventory_adjustments(location_id,variant_id,adjustment,before_quantity,after_quantity,reason,note,actor_user_id)
      values(v_receipt.location_id,v_line.inventory_variant_id,-v_line.quantity_received::integer,v_before,v_after_qty,'purchase_receipt_reversal','PO '||v_po_number||' · '||v_receipt.receipt_number||' · '||v_reason,auth.uid()) returning id into v_adjustment_id;
      update public.finance_purchase_receipt_items set reversal_adjustment_id=v_adjustment_id where id=v_line.id;
      update public.product_variants pv set stock=(select coalesce(sum(il.available),0) from public.inventory_levels il where il.variant_id=pv.id),updated_at=now() where pv.id=v_line.inventory_variant_id;
    end if;
  end loop;

  update public.finance_purchase_receipts set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reverse_reason=v_reason where id=p_receipt_id returning * into v_after;
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,after_snapshot,created_by)
  values(v_receipt.purchase_order_id,'receipt_reversed',v_reason,jsonb_build_object('receiptId',p_receipt_id,'receiptNumber',v_receipt.receipt_number),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_create_vendor_bill_from_po_impl(p_po_id uuid,p_issue_date date,p_due_date date,p_bill_number text,p_category text,p_description text,p_amount numeric,p_gst_hst_tax numeric default 0,p_pst_tax numeric default 0,p_itc_eligible boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_po public.finance_purchase_orders;
  v_supplier public.finance_suppliers;
  v_created jsonb;
  v_bill public.finance_vendor_bills;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  select * into v_po from public.finance_purchase_orders where id=p_po_id for share;
  if v_po.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
  if v_po.status<>'approved' then raise exception 'only approved purchase orders can be linked to vendor bills' using errcode='22023'; end if;
  select * into v_supplier from public.finance_suppliers where id=v_po.supplier_id;
  if v_supplier.id is null then raise exception 'supplier not found' using errcode='P0002'; end if;
  if p_issue_date<v_po.order_date then raise exception 'bill issue date cannot be before purchase order date' using errcode='22023'; end if;
  v_created:=private.finance_create_vendor_bill_impl(p_issue_date,p_due_date,v_supplier.name,p_bill_number,p_category,p_description,p_amount,p_gst_hst_tax,p_pst_tax,p_itc_eligible,p_notes);
  update public.finance_vendor_bills set purchase_order_id=p_po_id,supplier_id=v_supplier.id,updated_at=now() where id=(v_created->>'id')::uuid returning * into v_bill;
  insert into public.finance_vendor_bill_events(bill_id,event_type,after_snapshot,created_by) values(v_bill.id,'po_linked',to_jsonb(v_bill),auth.uid());
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,after_snapshot,created_by) values(p_po_id,'bill_linked',coalesce(v_bill.bill_number,v_bill.id::text),jsonb_build_object('billId',v_bill.id,'billNumber',v_bill.bill_number,'billTotal',round(v_bill.amount+v_bill.gst_hst_tax+v_bill.pst_tax,2)),auth.uid());
  return to_jsonb(v_bill);
end; $$;

create or replace function private.finance_get_vendor_bills_impl(p_from date default null,p_to date default null,p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_limit integer:=greatest(25,least(1000,coalesce(p_limit,500))); v_today date:=(now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  return (
    with filtered as (
      select b.*,round(b.amount+b.gst_hst_tax+b.pst_tax,2) as total,po.po_number as purchase_order_number
      from public.finance_vendor_bills b left join public.finance_purchase_orders po on po.id=b.purchase_order_id
      where (p_from is null or b.due_date>=p_from) and (p_to is null or b.due_date<=p_to)
    ), limited as (
      select * from filtered order by case when status='open' then 0 when status='paid' then 1 else 2 end,due_date asc,created_at desc limit v_limit
    )
    select jsonb_build_object(
      'generatedAt',now(),
      'summary',jsonb_build_object(
        'openCount',coalesce((select count(*) from filtered where status='open'),0),
        'openTotal',coalesce((select sum(total) from filtered where status='open'),0),
        'overdueCount',coalesce((select count(*) from filtered where status='open' and due_date<v_today),0),
        'overdueTotal',coalesce((select sum(total) from filtered where status='open' and due_date<v_today),0),
        'due7Count',coalesce((select count(*) from filtered where status='open' and due_date between v_today and v_today+7),0),
        'due7Total',coalesce((select sum(total) from filtered where status='open' and due_date between v_today and v_today+7),0),
        'due30Count',coalesce((select count(*) from filtered where status='open' and due_date between v_today and v_today+30),0),
        'due30Total',coalesce((select sum(total) from filtered where status='open' and due_date between v_today and v_today+30),0),
        'paidCount',coalesce((select count(*) from filtered where status='paid'),0),
        'paidTotal',coalesce((select sum(total) from filtered where status='paid'),0),
        'voidedCount',coalesce((select count(*) from filtered where status='voided'),0),
        'poLinkedCount',coalesce((select count(*) from filtered where purchase_order_id is not null and status<>'voided'),0)
      ),
      'bills',coalesce((select jsonb_agg(to_jsonb(l) order by case when l.status='open' then 0 when l.status='paid' then 1 else 2 end,l.due_date asc,l.created_at desc) from limited l),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select ev.id,ev.bill_id,ev.event_type,ev.reason,ev.created_at from public.finance_vendor_bill_events ev join filtered f on f.id=ev.bill_id order by ev.created_at desc limit least(v_limit*4,2000)) e),'[]'::jsonb)
    )
  );
end; $$;

create or replace function private.finance_get_purchasing_impl(p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_limit integer:=greatest(25,least(1000,coalesce(p_limit,500))); v_today date:=(now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  return (
    with receipt_totals as (
      select ri.purchase_order_item_id,sum(ri.quantity_received) as received_quantity
      from public.finance_purchase_receipt_items ri join public.finance_purchase_receipts r on r.id=ri.receipt_id and r.status='posted'
      group by ri.purchase_order_item_id
    ), bill_totals as (
      select purchase_order_id,count(*) as bill_count,coalesce(sum(round(amount+gst_hst_tax+pst_tax,2)),0) as billed_total
      from public.finance_vendor_bills where purchase_order_id is not null and status<>'voided' group by purchase_order_id
    ), po_rows as (
      select po.*,s.name as supplier_name,
        coalesce(bt.bill_count,0) as linked_bill_count,
        coalesce(bt.billed_total,0) as billed_total,
        case when coalesce(bt.bill_count,0)=0 then 'none' when abs(po.total-coalesce(bt.billed_total,0))<=0.01 then 'matched' else 'variance' end as bill_match_status,
        case
          when not exists(select 1 from public.finance_purchase_order_items ii where ii.purchase_order_id=po.id) then 'none'
          when coalesce((select sum(coalesce(rt.received_quantity,0)) from public.finance_purchase_order_items ii left join receipt_totals rt on rt.purchase_order_item_id=ii.id where ii.purchase_order_id=po.id),0)=0 then 'not_received'
          when not exists(select 1 from public.finance_purchase_order_items ii left join receipt_totals rt on rt.purchase_order_item_id=ii.id where ii.purchase_order_id=po.id and coalesce(rt.received_quantity,0)<ii.quantity) then 'received'
          else 'partial'
        end as receiving_status,
        coalesce((select jsonb_agg(to_jsonb(ii) || jsonb_build_object(
          'received_quantity',coalesce(rt.received_quantity,0),
          'remaining_quantity',greatest(ii.quantity-coalesce(rt.received_quantity,0),0),
          'inventory_variant',case when pv.id is null then null else jsonb_build_object('id',pv.id,'sku',pv.sku,'name',pv.name,'color',pv.color,'size',pv.size,'stock',pv.stock) end
        ) order by ii.line_number)
        from public.finance_purchase_order_items ii
        left join receipt_totals rt on rt.purchase_order_item_id=ii.id
        left join public.product_variants pv on pv.id=ii.inventory_variant_id
        where ii.purchase_order_id=po.id),'[]'::jsonb) as items,
        coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'bill_number',b.bill_number,'status',b.status,'total',round(b.amount+b.gst_hst_tax+b.pst_tax,2),'due_date',b.due_date) order by b.created_at desc) from public.finance_vendor_bills b where b.purchase_order_id=po.id),'[]'::jsonb) as linked_bills
      from public.finance_purchase_orders po join public.finance_suppliers s on s.id=po.supplier_id left join bill_totals bt on bt.purchase_order_id=po.id
    ), limited as (
      select * from po_rows order by case status when 'draft' then 0 when 'approved' then 1 else 2 end,coalesce(expected_date,order_date),created_at desc limit v_limit
    )
    select jsonb_build_object(
      'generatedAt',now(),
      'summary',jsonb_build_object(
        'activeSuppliers',(select count(*) from public.finance_suppliers where status='active'),
        'draftCount',(select count(*) from public.finance_purchase_orders where status='draft'),
        'draftTotal',coalesce((select sum(total) from public.finance_purchase_orders where status='draft'),0),
        'approvedCount',(select count(*) from public.finance_purchase_orders where status='approved'),
        'approvedTotal',coalesce((select sum(total) from public.finance_purchase_orders where status='approved'),0),
        'expected7Total',coalesce((select sum(total) from public.finance_purchase_orders where status='approved' and expected_date between v_today and v_today+7),0),
        'expected30Total',coalesce((select sum(total) from public.finance_purchase_orders where status='approved' and expected_date between v_today and v_today+30),0),
        'cancelledCount',(select count(*) from public.finance_purchase_orders where status='cancelled'),
        'partialReceiveCount',(select count(*) from po_rows where status='approved' and receiving_status='partial'),
        'receivedCount',(select count(*) from po_rows where status='approved' and receiving_status='received'),
        'billVarianceCount',(select count(*) from po_rows where status='approved' and bill_match_status='variance'),
        'postedReceiptCount',(select count(*) from public.finance_purchase_receipts where status='posted')
      ),
      'suppliers',coalesce((select jsonb_agg(to_jsonb(s) order by case when s.status='active' then 0 else 1 end,lower(s.name)) from public.finance_suppliers s),'[]'::jsonb),
      'purchaseOrders',coalesce((select jsonb_agg(to_jsonb(l) order by case l.status when 'draft' then 0 when 'approved' then 1 else 2 end,coalesce(l.expected_date,l.order_date),l.created_at desc) from limited l),'[]'::jsonb),
      'receipts',coalesce((select jsonb_agg(to_jsonb(rw) order by rw.received_date desc,rw.created_at desc) from (
        select r.*,po.po_number,s.name as supplier_name,loc.name as location_name,
          coalesce((select jsonb_agg(to_jsonb(ri) || jsonb_build_object('line_number',poi.line_number,'sku',poi.sku,'description',poi.description,'inventory_variant_id',poi.inventory_variant_id) order by poi.line_number) from public.finance_purchase_receipt_items ri join public.finance_purchase_order_items poi on poi.id=ri.purchase_order_item_id where ri.receipt_id=r.id),'[]'::jsonb) as items
        from public.finance_purchase_receipts r join public.finance_purchase_orders po on po.id=r.purchase_order_id join public.finance_suppliers s on s.id=po.supplier_id left join public.inventory_locations loc on loc.id=r.location_id
        order by r.received_date desc,r.created_at desc limit v_limit
      ) rw),'[]'::jsonb),
      'inventoryVariants',coalesce((select jsonb_agg(jsonb_build_object('id',pv.id,'sku',pv.sku,'name',pv.name,'color',pv.color,'size',pv.size,'stock',pv.stock) order by coalesce(pv.sku,''),pv.name) from public.product_variants pv where pv.active is true),'[]'::jsonb),
      'locations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'code',l.code,'name',l.name,'is_default',l.is_default) order by l.sort_order,l.name) from public.inventory_locations l where l.active is true),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select id,purchase_order_id,event_type,reason,created_at from public.finance_purchase_order_events order by created_at desc limit least(v_limit*4,2000)) e),'[]'::jsonb)
    )
  );
end; $$;

revoke all on function private.finance_post_purchase_receipt_impl(uuid,date,uuid,text,jsonb) from public,anon;
revoke all on function private.finance_reverse_purchase_receipt_impl(uuid,text) from public,anon;
revoke all on function private.finance_create_vendor_bill_from_po_impl(uuid,date,date,text,text,text,numeric,numeric,numeric,boolean,text) from public,anon;
grant execute on function private.finance_post_purchase_receipt_impl(uuid,date,uuid,text,jsonb) to authenticated,service_role;
grant execute on function private.finance_reverse_purchase_receipt_impl(uuid,text) to authenticated,service_role;
grant execute on function private.finance_create_vendor_bill_from_po_impl(uuid,date,date,text,text,text,numeric,numeric,numeric,boolean,text) to authenticated,service_role;

create or replace function public.post_admin_purchase_receipt(p_po_id uuid,p_received_date date,p_location_id uuid default null,p_notes text default null,p_items jsonb default '[]'::jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_post_purchase_receipt_impl(p_po_id,p_received_date,p_location_id,p_notes,p_items); $$;
create or replace function public.reverse_admin_purchase_receipt(p_receipt_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_reverse_purchase_receipt_impl(p_receipt_id,p_reason); $$;
create or replace function public.create_admin_vendor_bill_from_purchase_order(p_po_id uuid,p_issue_date date,p_due_date date,p_bill_number text,p_category text,p_description text,p_amount numeric,p_gst_hst_tax numeric default 0,p_pst_tax numeric default 0,p_itc_eligible boolean default false,p_notes text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_create_vendor_bill_from_po_impl(p_po_id,p_issue_date,p_due_date,p_bill_number,p_category,p_description,p_amount,p_gst_hst_tax,p_pst_tax,p_itc_eligible,p_notes); $$;

revoke all on function public.post_admin_purchase_receipt(uuid,date,uuid,text,jsonb) from public,anon;
revoke all on function public.reverse_admin_purchase_receipt(uuid,text) from public,anon;
revoke all on function public.create_admin_vendor_bill_from_purchase_order(uuid,date,date,text,text,text,numeric,numeric,numeric,boolean,text) from public,anon;
grant execute on function public.post_admin_purchase_receipt(uuid,date,uuid,text,jsonb) to authenticated,service_role;
grant execute on function public.reverse_admin_purchase_receipt(uuid,text) to authenticated,service_role;
grant execute on function public.create_admin_vendor_bill_from_purchase_order(uuid,date,date,text,text,text,numeric,numeric,numeric,boolean,text) to authenticated,service_role;
