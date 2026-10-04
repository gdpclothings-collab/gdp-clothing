alter function private.finance_get_purchasing_impl(integer) rename to finance_get_purchasing_impl_phase18;

create or replace function private.finance_get_purchasing_impl(p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare
  v_base jsonb;
  v_orders jsonb;
  v_summary jsonb;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  v_base:=private.finance_get_purchasing_impl_phase18(p_limit);
  with adjusted as (
    select po || jsonb_build_object(
      'linked_credit_total',calc.linked_credit_total,
      'applied_credit_total',calc.applied_credit_total,
      'effective_po_total',calc.effective_po_total,
      'net_billed_total',calc.net_billed_total,
      'bill_variance',calc.bill_variance,
      'bill_match_status',calc.bill_match_status,
      'close_readiness',case
        when po->>'status'='closed' then po->>'close_mode'
        when po->>'status'<>'approved' then 'not_applicable'
        when coalesce((po->>'short_line_count')::numeric,0)=0 and coalesce((po->>'linked_bill_count')::integer,0)>0 and abs(calc.bill_variance)<=0.01 then 'matched'
        else 'exception'
      end
    ) as row
    from jsonb_array_elements(coalesce(v_base->'purchaseOrders','[]'::jsonb)) po
    cross join lateral (
      select
        coalesce((select sum(round(c.amount+c.gst_hst_tax+c.pst_tax,2)) from public.finance_vendor_credits c where c.purchase_order_id=(po->>'id')::uuid and c.status<>'voided'),0)::numeric as linked_credit_total,
        coalesce((select sum(round(a.amount+a.gst_hst_tax+a.pst_tax,2)) from public.finance_vendor_credit_applications a join public.finance_vendor_bills b on b.id=a.bill_id where b.purchase_order_id=(po->>'id')::uuid and b.status<>'voided' and a.status='active'),0)::numeric as applied_credit_total
    ) raw
    cross join lateral (
      select round(greatest((po->>'total')::numeric-raw.linked_credit_total,0),2) as effective_po_total,
             round(greatest(coalesce((po->>'billed_total')::numeric,0)-raw.applied_credit_total,0),2) as net_billed_total,
             raw.linked_credit_total,raw.applied_credit_total
    ) vals
    cross join lateral (
      select round(vals.net_billed_total-vals.effective_po_total,2) as bill_variance,
             vals.linked_credit_total,vals.applied_credit_total,vals.effective_po_total,vals.net_billed_total,
             case when coalesce((po->>'linked_bill_count')::integer,0)=0 then 'none' when abs(round(vals.net_billed_total-vals.effective_po_total,2))<=0.01 then 'matched' else 'variance' end as bill_match_status
    ) calc
  )
  select coalesce(jsonb_agg(row),'[]'::jsonb) into v_orders from adjusted;
  v_summary:=coalesce(v_base->'summary','{}'::jsonb) || jsonb_build_object(
    'billVarianceCount',coalesce((select count(*) from jsonb_array_elements(v_orders) x where x->>'status'='approved' and x->>'bill_match_status'='variance'),0),
    'closeReadyCount',coalesce((select count(*) from jsonb_array_elements(v_orders) x where x->>'status'='approved' and x->>'close_readiness'='matched'),0),
    'closeExceptionCount',coalesce((select count(*) from jsonb_array_elements(v_orders) x where x->>'status'='approved' and x->>'close_readiness'='exception'),0)
  );
  return v_base || jsonb_build_object('summary',v_summary,'purchaseOrders',v_orders);
end; $$;

revoke all on function private.finance_get_purchasing_impl(integer) from public,anon;
grant execute on function private.finance_get_purchasing_impl(integer) to authenticated,service_role;

create or replace function private.finance_close_purchase_order_impl(p_po_id uuid,p_allow_exception boolean default false,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_before public.finance_purchase_orders;
  v_after public.finance_purchase_orders;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_item_count integer:=0; v_short_line_count integer:=0; v_ordered_qty numeric:=0; v_received_qty numeric:=0;
  v_bill_count integer:=0; v_billed_total numeric:=0; v_linked_credit_total numeric:=0; v_applied_credit_total numeric:=0;
  v_effective_po_total numeric:=0; v_net_billed_total numeric:=0; v_bill_variance numeric:=0;
  v_receiving_complete boolean:=false; v_bill_matched boolean:=false; v_matched boolean:=false; v_mode text; v_snapshot jsonb;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_po_id is null then raise exception 'purchase order is required' using errcode='22023'; end if;
  if v_reason is not null and char_length(v_reason)>1000 then raise exception 'close reason is too long' using errcode='22001'; end if;
  select * into v_before from public.finance_purchase_orders where id=p_po_id for update;
  if v_before.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
  if v_before.status<>'approved' then raise exception 'only approved purchase orders can be closed' using errcode='22023'; end if;

  with received as (
    select ri.purchase_order_item_id,coalesce(sum(ri.quantity_received),0) qty
    from public.finance_purchase_receipt_items ri join public.finance_purchase_receipts r on r.id=ri.receipt_id and r.status='posted'
    group by ri.purchase_order_item_id
  )
  select count(*),coalesce(sum(i.quantity),0),coalesce(sum(coalesce(r.qty,0)),0),count(*) filter(where coalesce(r.qty,0)<i.quantity)
  into v_item_count,v_ordered_qty,v_received_qty,v_short_line_count
  from public.finance_purchase_order_items i left join received r on r.purchase_order_item_id=i.id where i.purchase_order_id=p_po_id;

  select count(*),coalesce(sum(round(amount+gst_hst_tax+pst_tax,2)),0) into v_bill_count,v_billed_total
  from public.finance_vendor_bills where purchase_order_id=p_po_id and status<>'voided';
  select coalesce(sum(round(amount+gst_hst_tax+pst_tax,2)),0) into v_linked_credit_total
  from public.finance_vendor_credits where purchase_order_id=p_po_id and status<>'voided';
  select coalesce(sum(round(a.amount+a.gst_hst_tax+a.pst_tax,2)),0) into v_applied_credit_total
  from public.finance_vendor_credit_applications a join public.finance_vendor_bills b on b.id=a.bill_id
  where b.purchase_order_id=p_po_id and b.status<>'voided' and a.status='active';

  v_effective_po_total:=round(greatest(v_before.total-v_linked_credit_total,0),2);
  v_net_billed_total:=round(greatest(v_billed_total-v_applied_credit_total,0),2);
  v_bill_variance:=round(v_net_billed_total-v_effective_po_total,2);
  v_receiving_complete:=(v_item_count>0 and v_short_line_count=0);
  v_bill_matched:=(v_bill_count>0 and abs(v_bill_variance)<=0.01);
  v_matched:=v_receiving_complete and v_bill_matched;

  if not v_matched and not coalesce(p_allow_exception,false) then raise exception 'purchase order is not fully reconciled after vendor credits; use exception close with a reason' using errcode='22023'; end if;
  if not v_matched and v_reason is null then raise exception 'exception close reason is required' using errcode='22023'; end if;
  v_mode:=case when v_matched then 'matched' else 'exception' end;

  v_snapshot:=jsonb_build_object(
    'capturedAt',now(),'poNumber',v_before.po_number,'poTotal',v_before.total,
    'linkedCreditTotal',round(v_linked_credit_total,2),'effectivePoTotal',v_effective_po_total,
    'orderedQuantity',v_ordered_qty,'receivedQuantity',v_received_qty,'shortLineCount',v_short_line_count,'receivingComplete',v_receiving_complete,
    'billCount',v_bill_count,'billedTotal',round(v_billed_total,2),'appliedCreditTotal',round(v_applied_credit_total,2),'netBilledTotal',v_net_billed_total,
    'billVariance',v_bill_variance,'billMatched',v_bill_matched,'closeMode',v_mode,
    'credits',coalesce((select jsonb_agg(jsonb_build_object('creditId',c.id,'creditNumber',c.credit_number,'status',c.status,'sourceType',c.source_type,'total',round(c.amount+c.gst_hst_tax+c.pst_tax,2)) order by c.created_at) from public.finance_vendor_credits c where c.purchase_order_id=p_po_id and c.status<>'voided'),'[]'::jsonb),
    'lines',coalesce((with received as (select ri.purchase_order_item_id,coalesce(sum(ri.quantity_received),0) qty from public.finance_purchase_receipt_items ri join public.finance_purchase_receipts r on r.id=ri.receipt_id and r.status='posted' group by ri.purchase_order_item_id) select jsonb_agg(jsonb_build_object('itemId',i.id,'lineNumber',i.line_number,'sku',i.sku,'description',i.description,'orderedQuantity',i.quantity,'receivedQuantity',coalesce(r.qty,0),'remainingQuantity',greatest(i.quantity-coalesce(r.qty,0),0),'inventoryVariantId',i.inventory_variant_id) order by i.line_number) from public.finance_purchase_order_items i left join received r on r.purchase_order_item_id=i.id where i.purchase_order_id=p_po_id),'[]'::jsonb),
    'bills',coalesce((select jsonb_agg(jsonb_build_object('billId',b.id,'billNumber',b.bill_number,'status',b.status,'grossTotal',round(b.amount+b.gst_hst_tax+b.pst_tax,2),'creditApplied',coalesce((select sum(round(a.amount+a.gst_hst_tax+a.pst_tax,2)) from public.finance_vendor_credit_applications a where a.bill_id=b.id and a.status='active'),0),'netTotal',round(greatest(b.amount-coalesce((select sum(a.amount) from public.finance_vendor_credit_applications a where a.bill_id=b.id and a.status='active'),0),0)+greatest(b.gst_hst_tax-coalesce((select sum(a.gst_hst_tax) from public.finance_vendor_credit_applications a where a.bill_id=b.id and a.status='active'),0),0)+greatest(b.pst_tax-coalesce((select sum(a.pst_tax) from public.finance_vendor_credit_applications a where a.bill_id=b.id and a.status='active'),0),0),2),'dueDate',b.due_date) order by b.created_at) from public.finance_vendor_bills b where b.purchase_order_id=p_po_id),'[]'::jsonb)
  );

  update public.finance_purchase_orders set status='closed',closed_at=now(),closed_by=auth.uid(),close_mode=v_mode,close_reason=v_reason,close_snapshot=v_snapshot,updated_at=now() where id=p_po_id returning * into v_after;
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,before_snapshot,after_snapshot,created_by) values(p_po_id,'closed',coalesce(v_reason,v_mode),to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;