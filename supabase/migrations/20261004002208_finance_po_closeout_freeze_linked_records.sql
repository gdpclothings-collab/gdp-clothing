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
  v_po_status text;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_receipt_id is null or v_reason is null then raise exception 'receipt and reversal reason are required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'reversal reason is too long' using errcode='22001'; end if;
  select * into v_receipt from public.finance_purchase_receipts where id=p_receipt_id for update;
  if v_receipt.id is null then raise exception 'receipt not found' using errcode='P0002'; end if;
  if v_receipt.status<>'posted' then raise exception 'only posted receipts can be reversed' using errcode='22023'; end if;
  select po_number,status into v_po_number,v_po_status from public.finance_purchase_orders where id=v_receipt.purchase_order_id for update;
  if v_po_status='closed' then raise exception 'reopen the closed purchase order before reversing a receipt' using errcode='22023'; end if;

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

create or replace function private.finance_void_vendor_bill_impl(p_bill_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_before public.finance_vendor_bills;
  v_after public.finance_vendor_bills;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_po_status text;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_bill_id is null then raise exception 'bill is required' using errcode='22023'; end if;
  if v_reason is null then raise exception 'void reason is required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'void reason is too long' using errcode='22001'; end if;

  select * into v_before from public.finance_vendor_bills where id=p_bill_id for update;
  if v_before.id is null then raise exception 'bill not found' using errcode='P0002'; end if;
  if v_before.status<>'open' then raise exception 'only open bills can be voided' using errcode='22023'; end if;
  if v_before.purchase_order_id is not null then
    select status into v_po_status from public.finance_purchase_orders where id=v_before.purchase_order_id for update;
    if v_po_status='closed' then raise exception 'reopen the closed purchase order before voiding its linked bill' using errcode='22023'; end if;
  end if;

  update public.finance_vendor_bills
  set status='voided',voided_at=now(),voided_by=auth.uid(),void_reason=v_reason,updated_at=now()
  where id=p_bill_id returning * into v_after;

  insert into public.finance_vendor_bill_events(bill_id,event_type,reason,before_snapshot,after_snapshot,created_by)
  values(p_bill_id,'voided',v_reason,to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;
