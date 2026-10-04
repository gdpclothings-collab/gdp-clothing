create or replace function private.finance_post_purchase_return_impl(
  p_receipt_id uuid,
  p_return_date date,
  p_reason text,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_receipt public.finance_purchase_receipts;
  v_po public.finance_purchase_orders;
  v_supplier public.finance_suppliers;
  v_return public.finance_purchase_returns;
  v_credit public.finance_vendor_credits;
  v_item jsonb;
  v_receipt_item public.finance_purchase_receipt_items;
  v_po_item public.finance_purchase_order_items;
  v_receipt_item_id uuid;
  v_qty numeric;
  v_already numeric;
  v_available numeric;
  v_before integer;
  v_after integer;
  v_adjustment_id uuid;
  v_return_number text;
  v_credit_number text;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_today date:=(now() at time zone 'America/Regina')::date;
  v_total_amount numeric:=0;
  v_total_gst numeric:=0;
  v_total_pst numeric:=0;
  v_line_amount numeric;
  v_line_gst numeric;
  v_line_pst numeric;
  v_has_stock boolean:=false;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_receipt_id is null or p_return_date is null or v_reason is null then raise exception 'receipt, return date and reason are required' using errcode='22023'; end if;
  if p_return_date>v_today then raise exception 'return date cannot be in the future' using errcode='22023'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'select at least one received line to return' using errcode='22023'; end if;
  if jsonb_array_length(p_items)>100 then raise exception 'purchase return cannot exceed 100 lines' using errcode='22023'; end if;
  if char_length(v_reason)>500 or char_length(coalesce(v_notes,''))>1000 then raise exception 'return reason or notes are too long' using errcode='22001'; end if;

  select * into v_receipt from public.finance_purchase_receipts where id=p_receipt_id for update;
  if v_receipt.id is null then raise exception 'purchase receipt not found' using errcode='P0002'; end if;
  if v_receipt.status<>'posted' then raise exception 'only posted purchase receipts can be returned' using errcode='22023'; end if;
  if p_return_date<v_receipt.received_date then raise exception 'return date cannot be before received date' using errcode='22023'; end if;
  select * into v_po from public.finance_purchase_orders where id=v_receipt.purchase_order_id for update;
  if v_po.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
  if v_po.status<>'approved' then raise exception 'reopen the purchase order before posting a purchase return' using errcode='22023'; end if;
  select * into v_supplier from public.finance_suppliers where id=v_po.supplier_id;
  if v_supplier.id is null then raise exception 'supplier not found' using errcode='P0002'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin v_receipt_item_id:=(v_item->>'purchaseReceiptItemId')::uuid; exception when others then raise exception 'return line receipt item is invalid' using errcode='22023'; end;
    begin v_qty:=(v_item->>'quantityReturned')::numeric; exception when others then raise exception 'return line quantity is invalid' using errcode='22023'; end;
    if v_qty<=0 then raise exception 'return quantities must be greater than zero' using errcode='22023'; end if;
    select * into v_receipt_item from public.finance_purchase_receipt_items where id=v_receipt_item_id and receipt_id=p_receipt_id for update;
    if v_receipt_item.id is null then raise exception 'return line is not part of this purchase receipt' using errcode='22023'; end if;
    select * into v_po_item from public.finance_purchase_order_items where id=v_receipt_item.purchase_order_item_id for update;
    if v_po_item.id is null then raise exception 'purchase order line not found' using errcode='P0002'; end if;
    select coalesce(sum(pri.quantity_returned),0) into v_already
    from public.finance_purchase_return_items pri join public.finance_purchase_returns pr on pr.id=pri.return_id
    where pri.purchase_receipt_item_id=v_receipt_item.id and pr.status='posted';
    v_available:=round(v_receipt_item.quantity_received-v_already,3);
    if v_qty>v_available then raise exception 'return quantity exceeds remaining received quantity for line %',v_po_item.line_number using errcode='22023'; end if;
    if v_po_item.inventory_variant_id is not null then
      v_has_stock:=true;
      if v_receipt.location_id is null then raise exception 'original receipt has no inventory location for stock-linked return' using errcode='22023'; end if;
      if v_qty<>trunc(v_qty) then raise exception 'stock-linked return quantities must be whole numbers' using errcode='22023'; end if;
      select available into v_before from public.inventory_levels where location_id=v_receipt.location_id and variant_id=v_po_item.inventory_variant_id for update;
      if coalesce(v_before,0)<v_qty then raise exception 'not enough stock remains at the receiving location to return line %',v_po_item.line_number using errcode='22023'; end if;
    end if;
    v_line_amount:=round(v_po_item.unit_cost*v_qty,2);
    v_line_gst:=round(case when v_po_item.quantity>0 then v_po_item.gst_hst_tax*(v_qty/v_po_item.quantity) else 0 end,2);
    v_line_pst:=round(case when v_po_item.quantity>0 then v_po_item.pst_tax*(v_qty/v_po_item.quantity) else 0 end,2);
    v_total_amount:=v_total_amount+v_line_amount;
    v_total_gst:=v_total_gst+v_line_gst;
    v_total_pst:=v_total_pst+v_line_pst;
  end loop;

  v_total_amount:=round(v_total_amount,2); v_total_gst:=round(v_total_gst,2); v_total_pst:=round(v_total_pst,2);
  if round(v_total_amount+v_total_gst+v_total_pst,2)<=0 then raise exception 'purchase return has no credit value' using errcode='22023'; end if;

  v_return_number:='RTV-'||to_char(v_today,'YYYYMMDD')||'-'||lpad(nextval('public.finance_purchase_return_seq'::regclass)::text,5,'0');
  v_credit_number:='VC-'||to_char(v_today,'YYYYMMDD')||'-'||lpad(nextval('public.finance_vendor_credit_seq'::regclass)::text,5,'0');

  insert into public.finance_vendor_credits(credit_number,issue_date,vendor,supplier_id,purchase_order_id,source_type,description,amount,gst_hst_tax,pst_tax,currency,status,notes,created_by,created_at,updated_at)
  values(v_credit_number,p_return_date,v_supplier.name,v_supplier.id,v_po.id,'purchase_return','Purchase return '||v_return_number,v_total_amount,v_total_gst,v_total_pst,'CAD','open',v_notes,auth.uid(),now(),now()) returning * into v_credit;

  insert into public.finance_purchase_returns(return_number,purchase_order_id,receipt_id,vendor_credit_id,return_date,location_id,reason,notes,status,created_by,created_at)
  values(v_return_number,v_po.id,v_receipt.id,v_credit.id,p_return_date,case when v_has_stock then v_receipt.location_id else null end,v_reason,v_notes,'posted',auth.uid(),now()) returning * into v_return;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_receipt_item_id:=(v_item->>'purchaseReceiptItemId')::uuid;
    v_qty:=(v_item->>'quantityReturned')::numeric;
    select * into v_receipt_item from public.finance_purchase_receipt_items where id=v_receipt_item_id and receipt_id=p_receipt_id for update;
    select * into v_po_item from public.finance_purchase_order_items where id=v_receipt_item.purchase_order_item_id for update;
    v_line_amount:=round(v_po_item.unit_cost*v_qty,2);
    v_line_gst:=round(case when v_po_item.quantity>0 then v_po_item.gst_hst_tax*(v_qty/v_po_item.quantity) else 0 end,2);
    v_line_pst:=round(case when v_po_item.quantity>0 then v_po_item.pst_tax*(v_qty/v_po_item.quantity) else 0 end,2);
    v_adjustment_id:=null; v_before:=null; v_after:=null;
    if v_po_item.inventory_variant_id is not null then
      select available into v_before from public.inventory_levels where location_id=v_receipt.location_id and variant_id=v_po_item.inventory_variant_id for update;
      v_after:=v_before-v_qty::integer;
      update public.inventory_levels set available=v_after,updated_at=now() where location_id=v_receipt.location_id and variant_id=v_po_item.inventory_variant_id;
      insert into public.inventory_adjustments(location_id,variant_id,adjustment,before_quantity,after_quantity,reason,note,actor_user_id)
      values(v_receipt.location_id,v_po_item.inventory_variant_id,-v_qty::integer,v_before,v_after,'purchase_return','PO '||v_po.po_number||' · '||v_return_number,auth.uid()) returning id into v_adjustment_id;
      update public.product_variants pv set stock=(select coalesce(sum(il.available),0) from public.inventory_levels il where il.variant_id=pv.id),updated_at=now() where pv.id=v_po_item.inventory_variant_id;
    end if;
    insert into public.finance_purchase_return_items(return_id,purchase_receipt_item_id,purchase_order_item_id,quantity_returned,credit_amount,credit_gst_hst_tax,credit_pst_tax,inventory_adjustment_id,before_available,after_available)
    values(v_return.id,v_receipt_item.id,v_po_item.id,round(v_qty,3),v_line_amount,v_line_gst,v_line_pst,v_adjustment_id,v_before,v_after);
  end loop;

  insert into public.finance_vendor_credit_events(credit_id,event_type,after_snapshot,created_by) values(v_credit.id,'created',jsonb_build_object('credit',to_jsonb(v_credit),'purchaseReturnId',v_return.id,'returnNumber',v_return_number),auth.uid());
  insert into public.finance_purchase_return_events(return_id,event_type,reason,after_snapshot,created_by) values(v_return.id,'posted',v_reason,to_jsonb(v_return),auth.uid());
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,after_snapshot,created_by) values(v_po.id,'purchase_returned',v_return_number,jsonb_build_object('returnId',v_return.id,'returnNumber',v_return_number,'creditId',v_credit.id,'creditNumber',v_credit_number,'creditTotal',round(v_total_amount+v_total_gst+v_total_pst,2)),auth.uid());
  return jsonb_build_object('return',to_jsonb(v_return),'credit',to_jsonb(v_credit));
end; $$;

create or replace function private.finance_reverse_purchase_return_impl(p_return_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_return public.finance_purchase_returns;
  v_before_return public.finance_purchase_returns;
  v_credit public.finance_vendor_credits;
  v_line record;
  v_po public.finance_purchase_orders;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_before integer;
  v_after integer;
  v_adjustment_id uuid;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_return_id is null or v_reason is null then raise exception 'purchase return and reversal reason are required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'reversal reason is too long' using errcode='22001'; end if;
  select * into v_return from public.finance_purchase_returns where id=p_return_id for update;
  if v_return.id is null then raise exception 'purchase return not found' using errcode='P0002'; end if;
  if v_return.status<>'posted' then raise exception 'only posted purchase returns can be reversed' using errcode='22023'; end if;
  v_before_return:=v_return;
  select * into v_po from public.finance_purchase_orders where id=v_return.purchase_order_id for update;
  if v_po.status<>'approved' then raise exception 'reopen the purchase order before reversing its purchase return' using errcode='22023'; end if;
  select * into v_credit from public.finance_vendor_credits where id=v_return.vendor_credit_id for update;
  if v_credit.status<>'open' or exists(select 1 from public.finance_vendor_credit_applications where credit_id=v_credit.id and status='active') then raise exception 'reverse all vendor credit applications before reversing this purchase return' using errcode='22023'; end if;

  for v_line in
    select pri.*,poi.inventory_variant_id
    from public.finance_purchase_return_items pri join public.finance_purchase_order_items poi on poi.id=pri.purchase_order_item_id
    where pri.return_id=v_return.id order by poi.line_number
  loop
    if v_line.inventory_variant_id is not null then
      select available into v_before from public.inventory_levels where location_id=v_return.location_id and variant_id=v_line.inventory_variant_id for update;
      v_before:=coalesce(v_before,0); v_after:=v_before+v_line.quantity_returned::integer;
      insert into public.inventory_levels(location_id,variant_id,available) values(v_return.location_id,v_line.inventory_variant_id,v_after)
      on conflict(location_id,variant_id) do update set available=excluded.available,updated_at=now();
      insert into public.inventory_adjustments(location_id,variant_id,adjustment,before_quantity,after_quantity,reason,note,actor_user_id)
      values(v_return.location_id,v_line.inventory_variant_id,v_line.quantity_returned::integer,v_before,v_after,'purchase_return_reversal','PO '||v_po.po_number||' · '||v_return.return_number||' · '||v_reason,auth.uid()) returning id into v_adjustment_id;
      update public.finance_purchase_return_items set reversal_adjustment_id=v_adjustment_id where id=v_line.id;
      update public.product_variants pv set stock=(select coalesce(sum(il.available),0) from public.inventory_levels il where il.variant_id=pv.id),updated_at=now() where pv.id=v_line.inventory_variant_id;
    end if;
  end loop;

  update public.finance_purchase_returns set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reverse_reason=v_reason where id=v_return.id returning * into v_return;
  update public.finance_vendor_credits set status='voided',voided_at=now(),voided_by=auth.uid(),void_reason='Purchase return reversed: '||v_reason,updated_at=now() where id=v_credit.id returning * into v_credit;
  insert into public.finance_purchase_return_events(return_id,event_type,reason,before_snapshot,after_snapshot,created_by) values(v_return.id,'reversed',v_reason,to_jsonb(v_before_return),to_jsonb(v_return),auth.uid());
  insert into public.finance_vendor_credit_events(credit_id,event_type,reason,after_snapshot,created_by) values(v_credit.id,'voided','Purchase return reversed: '||v_reason,to_jsonb(v_credit),auth.uid());
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,after_snapshot,created_by) values(v_po.id,'purchase_return_reversed',v_reason,jsonb_build_object('returnId',v_return.id,'returnNumber',v_return.return_number,'creditId',v_credit.id),auth.uid());
  return jsonb_build_object('return',to_jsonb(v_return),'credit',to_jsonb(v_credit));
end; $$;

revoke all on function private.finance_post_purchase_return_impl(uuid,date,text,text,jsonb) from public,anon;
revoke all on function private.finance_reverse_purchase_return_impl(uuid,text) from public,anon;
grant execute on function private.finance_post_purchase_return_impl(uuid,date,text,text,jsonb) to authenticated,service_role;
grant execute on function private.finance_reverse_purchase_return_impl(uuid,text) to authenticated,service_role;

create or replace function public.post_admin_purchase_return(p_receipt_id uuid,p_return_date date,p_reason text,p_notes text default null,p_items jsonb default '[]'::jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_post_purchase_return_impl(p_receipt_id,p_return_date,p_reason,p_notes,p_items); $$;
create or replace function public.reverse_admin_purchase_return(p_return_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_reverse_purchase_return_impl(p_return_id,p_reason); $$;

revoke all on function public.post_admin_purchase_return(uuid,date,text,text,jsonb) from public,anon;
revoke all on function public.reverse_admin_purchase_return(uuid,text) from public,anon;
grant execute on function public.post_admin_purchase_return(uuid,date,text,text,jsonb) to authenticated,service_role;
grant execute on function public.reverse_admin_purchase_return(uuid,text) to authenticated,service_role;