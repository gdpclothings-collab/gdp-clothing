alter table public.finance_purchase_orders
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid,
  add column if not exists close_mode text,
  add column if not exists close_reason text,
  add column if not exists close_snapshot jsonb;

alter table public.finance_purchase_orders drop constraint if exists finance_purchase_orders_status_chk;
alter table public.finance_purchase_orders drop constraint if exists finance_purchase_orders_state_chk;
alter table public.finance_purchase_orders add constraint finance_purchase_orders_status_chk
  check (status in ('draft','approved','closed','cancelled'));
alter table public.finance_purchase_orders add constraint finance_purchase_orders_close_mode_chk
  check (close_mode is null or close_mode in ('matched','exception'));
alter table public.finance_purchase_orders add constraint finance_purchase_orders_close_reason_chk
  check (close_reason is null or char_length(close_reason) <= 1000);
alter table public.finance_purchase_orders add constraint finance_purchase_orders_state_chk check (
  (status='draft' and approved_at is null and approved_by is null and cancelled_at is null and cancelled_by is null and cancel_reason is null and closed_at is null and closed_by is null and close_mode is null and close_reason is null and close_snapshot is null)
  or
  (status='approved' and approved_at is not null and approved_by is not null and cancelled_at is null and cancelled_by is null and cancel_reason is null and closed_at is null and closed_by is null and close_mode is null and close_reason is null and close_snapshot is null)
  or
  (status='closed' and approved_at is not null and approved_by is not null and cancelled_at is null and cancelled_by is null and cancel_reason is null and closed_at is not null and closed_by is not null and close_mode in ('matched','exception') and close_snapshot is not null and (close_mode='matched' or nullif(trim(close_reason),'') is not null))
  or
  (status='cancelled' and cancelled_at is not null and cancelled_by is not null and nullif(trim(cancel_reason),'') is not null and closed_at is null and closed_by is null and close_mode is null and close_reason is null and close_snapshot is null)
);

create index if not exists finance_purchase_orders_closed_at_idx on public.finance_purchase_orders(closed_at desc) where status='closed';

alter table public.finance_purchase_order_events drop constraint if exists finance_purchase_order_events_event_type_check;
alter table public.finance_purchase_order_events add constraint finance_purchase_order_events_event_type_check
  check (event_type in ('created','updated','approved','cancelled','received','receipt_reversed','bill_linked','closed','reopened'));

create or replace function private.finance_close_purchase_order_impl(p_po_id uuid,p_allow_exception boolean default false,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_before public.finance_purchase_orders;
  v_after public.finance_purchase_orders;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_item_count integer:=0;
  v_short_line_count integer:=0;
  v_ordered_qty numeric:=0;
  v_received_qty numeric:=0;
  v_bill_count integer:=0;
  v_billed_total numeric:=0;
  v_bill_variance numeric:=0;
  v_receiving_complete boolean:=false;
  v_bill_matched boolean:=false;
  v_matched boolean:=false;
  v_mode text;
  v_snapshot jsonb;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_po_id is null then raise exception 'purchase order is required' using errcode='22023'; end if;
  if v_reason is not null and char_length(v_reason)>1000 then raise exception 'close reason is too long' using errcode='22001'; end if;

  select * into v_before from public.finance_purchase_orders where id=p_po_id for update;
  if v_before.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
  if v_before.status<>'approved' then raise exception 'only approved purchase orders can be closed' using errcode='22023'; end if;

  with received as (
    select ri.purchase_order_item_id,coalesce(sum(ri.quantity_received),0) as qty
    from public.finance_purchase_receipt_items ri
    join public.finance_purchase_receipts r on r.id=ri.receipt_id and r.status='posted'
    group by ri.purchase_order_item_id
  )
  select count(*),
         coalesce(sum(i.quantity),0),
         coalesce(sum(coalesce(r.qty,0)),0),
         count(*) filter (where coalesce(r.qty,0) < i.quantity)
  into v_item_count,v_ordered_qty,v_received_qty,v_short_line_count
  from public.finance_purchase_order_items i
  left join received r on r.purchase_order_item_id=i.id
  where i.purchase_order_id=p_po_id;

  select count(*),coalesce(sum(round(amount+gst_hst_tax+pst_tax,2)),0)
  into v_bill_count,v_billed_total
  from public.finance_vendor_bills
  where purchase_order_id=p_po_id and status<>'voided';

  v_bill_variance:=round(v_billed_total-v_before.total,2);
  v_receiving_complete:=(v_item_count>0 and v_short_line_count=0);
  v_bill_matched:=(v_bill_count>0 and abs(v_bill_variance)<=0.01);
  v_matched:=v_receiving_complete and v_bill_matched;

  if not v_matched and not coalesce(p_allow_exception,false) then
    raise exception 'purchase order is not fully reconciled; use exception close with a reason' using errcode='22023';
  end if;
  if not v_matched and v_reason is null then
    raise exception 'exception close reason is required' using errcode='22023';
  end if;

  v_mode:=case when v_matched then 'matched' else 'exception' end;
  v_snapshot:=jsonb_build_object(
    'capturedAt',now(),
    'poNumber',v_before.po_number,
    'poTotal',v_before.total,
    'orderedQuantity',v_ordered_qty,
    'receivedQuantity',v_received_qty,
    'shortLineCount',v_short_line_count,
    'receivingComplete',v_receiving_complete,
    'billCount',v_bill_count,
    'billedTotal',round(v_billed_total,2),
    'billVariance',v_bill_variance,
    'billMatched',v_bill_matched,
    'closeMode',v_mode,
    'lines',coalesce((
      with received as (
        select ri.purchase_order_item_id,coalesce(sum(ri.quantity_received),0) as qty
        from public.finance_purchase_receipt_items ri
        join public.finance_purchase_receipts r on r.id=ri.receipt_id and r.status='posted'
        group by ri.purchase_order_item_id
      )
      select jsonb_agg(jsonb_build_object(
        'itemId',i.id,
        'lineNumber',i.line_number,
        'sku',i.sku,
        'description',i.description,
        'orderedQuantity',i.quantity,
        'receivedQuantity',coalesce(r.qty,0),
        'remainingQuantity',greatest(i.quantity-coalesce(r.qty,0),0),
        'inventoryVariantId',i.inventory_variant_id
      ) order by i.line_number)
      from public.finance_purchase_order_items i
      left join received r on r.purchase_order_item_id=i.id
      where i.purchase_order_id=p_po_id
    ),'[]'::jsonb),
    'bills',coalesce((
      select jsonb_agg(jsonb_build_object(
        'billId',b.id,
        'billNumber',b.bill_number,
        'status',b.status,
        'total',round(b.amount+b.gst_hst_tax+b.pst_tax,2),
        'dueDate',b.due_date
      ) order by b.created_at)
      from public.finance_vendor_bills b
      where b.purchase_order_id=p_po_id
    ),'[]'::jsonb)
  );

  update public.finance_purchase_orders
  set status='closed',closed_at=now(),closed_by=auth.uid(),close_mode=v_mode,close_reason=v_reason,close_snapshot=v_snapshot,updated_at=now()
  where id=p_po_id returning * into v_after;

  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,before_snapshot,after_snapshot,created_by)
  values(p_po_id,'closed',coalesce(v_reason,v_mode),to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_reopen_purchase_order_impl(p_po_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_before public.finance_purchase_orders;
  v_after public.finance_purchase_orders;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_po_id is null or v_reason is null then raise exception 'purchase order and reopen reason are required' using errcode='22023'; end if;
  if char_length(v_reason)>1000 then raise exception 'reopen reason is too long' using errcode='22001'; end if;
  select * into v_before from public.finance_purchase_orders where id=p_po_id for update;
  if v_before.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
  if v_before.status<>'closed' then raise exception 'only closed purchase orders can be reopened' using errcode='22023'; end if;
  if not exists(select 1 from public.finance_suppliers where id=v_before.supplier_id and status='active') then
    raise exception 'supplier must be active before reopening the purchase order' using errcode='22023';
  end if;

  update public.finance_purchase_orders
  set status='approved',closed_at=null,closed_by=null,close_mode=null,close_reason=null,close_snapshot=null,updated_at=now()
  where id=p_po_id returning * into v_after;

  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,before_snapshot,after_snapshot,created_by)
  values(p_po_id,'reopened',v_reason,to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
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
    ), po_base as (
      select po.*,s.name as supplier_name,
        coalesce(bt.bill_count,0) as linked_bill_count,
        coalesce(bt.billed_total,0) as billed_total,
        round(coalesce(bt.billed_total,0)-po.total,2) as bill_variance,
        case when coalesce(bt.bill_count,0)=0 then 'none' when abs(po.total-coalesce(bt.billed_total,0))<=0.01 then 'matched' else 'variance' end as bill_match_status,
        coalesce((select sum(ii.quantity) from public.finance_purchase_order_items ii where ii.purchase_order_id=po.id),0) as ordered_quantity,
        coalesce((select sum(coalesce(rt.received_quantity,0)) from public.finance_purchase_order_items ii left join receipt_totals rt on rt.purchase_order_item_id=ii.id where ii.purchase_order_id=po.id),0) as received_quantity,
        coalesce((select count(*) from public.finance_purchase_order_items ii left join receipt_totals rt on rt.purchase_order_item_id=ii.id where ii.purchase_order_id=po.id and coalesce(rt.received_quantity,0)<ii.quantity),0) as short_line_count,
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
    ), po_rows as (
      select pb.*,
        case
          when pb.status='closed' then pb.close_mode
          when pb.status<>'approved' then 'not_applicable'
          when pb.short_line_count=0 and pb.linked_bill_count>0 and abs(pb.bill_variance)<=0.01 then 'matched'
          else 'exception'
        end as close_readiness
      from po_base pb
    ), limited as (
      select * from po_rows order by case status when 'draft' then 0 when 'approved' then 1 when 'closed' then 2 else 3 end,coalesce(expected_date,order_date),created_at desc limit v_limit
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
        'postedReceiptCount',(select count(*) from public.finance_purchase_receipts where status='posted'),
        'closeReadyCount',(select count(*) from po_rows where status='approved' and close_readiness='matched'),
        'closeExceptionCount',(select count(*) from po_rows where status='approved' and close_readiness='exception'),
        'closedCount',(select count(*) from po_rows where status='closed'),
        'closedMatchedCount',(select count(*) from po_rows where status='closed' and close_mode='matched'),
        'closedExceptionCount',(select count(*) from po_rows where status='closed' and close_mode='exception')
      ),
      'suppliers',coalesce((select jsonb_agg(to_jsonb(s) order by case when s.status='active' then 0 else 1 end,lower(s.name)) from public.finance_suppliers s),'[]'::jsonb),
      'purchaseOrders',coalesce((select jsonb_agg(to_jsonb(l) order by case l.status when 'draft' then 0 when 'approved' then 1 when 'closed' then 2 else 3 end,coalesce(l.expected_date,l.order_date),l.created_at desc) from limited l),'[]'::jsonb),
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

revoke all on function private.finance_close_purchase_order_impl(uuid,boolean,text) from public,anon;
revoke all on function private.finance_reopen_purchase_order_impl(uuid,text) from public,anon;
grant execute on function private.finance_close_purchase_order_impl(uuid,boolean,text) to authenticated,service_role;
grant execute on function private.finance_reopen_purchase_order_impl(uuid,text) to authenticated,service_role;

create or replace function public.close_admin_purchase_order(p_po_id uuid,p_allow_exception boolean default false,p_reason text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_close_purchase_order_impl(p_po_id,p_allow_exception,p_reason); $$;
create or replace function public.reopen_admin_purchase_order(p_po_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_reopen_purchase_order_impl(p_po_id,p_reason); $$;

revoke all on function public.close_admin_purchase_order(uuid,boolean,text) from public,anon;
revoke all on function public.reopen_admin_purchase_order(uuid,text) from public,anon;
grant execute on function public.close_admin_purchase_order(uuid,boolean,text) to authenticated,service_role;
grant execute on function public.reopen_admin_purchase_order(uuid,text) to authenticated,service_role;
