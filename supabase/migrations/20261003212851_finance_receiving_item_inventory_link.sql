create or replace function private.finance_link_po_item_variant_impl(p_purchase_order_item_id uuid,p_inventory_variant_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_item public.finance_purchase_order_items;
  v_po public.finance_purchase_orders;
  v_variant_sku text;
  v_after public.finance_purchase_order_items;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_purchase_order_item_id is null then raise exception 'purchase order item is required' using errcode='22023'; end if;
  select * into v_item from public.finance_purchase_order_items where id=p_purchase_order_item_id for update;
  if v_item.id is null then raise exception 'purchase order item not found' using errcode='P0002'; end if;
  select * into v_po from public.finance_purchase_orders where id=v_item.purchase_order_id for update;
  if v_po.status<>'approved' then raise exception 'inventory links can only be changed on approved purchase orders' using errcode='22023'; end if;
  if exists(select 1 from public.finance_purchase_receipt_items ri join public.finance_purchase_receipts r on r.id=ri.receipt_id where ri.purchase_order_item_id=v_item.id and r.status='posted') then raise exception 'inventory link cannot change after receiving has been posted' using errcode='22023'; end if;
  if p_inventory_variant_id is not null then
    if v_item.quantity<>trunc(v_item.quantity) then raise exception 'stock-linked purchase order quantity must be a whole number' using errcode='22023'; end if;
    select sku into v_variant_sku from public.product_variants where id=p_inventory_variant_id and active is true;
    if v_variant_sku is null then raise exception 'active inventory variant not found' using errcode='P0002'; end if;
  end if;
  update public.finance_purchase_order_items
  set inventory_variant_id=p_inventory_variant_id,
      sku=case when p_inventory_variant_id is not null then v_variant_sku else sku end
  where id=v_item.id returning * into v_after;
  insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,before_snapshot,after_snapshot,created_by)
  values(v_item.purchase_order_id,'updated','inventory_link',to_jsonb(v_item),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;
revoke all on function private.finance_link_po_item_variant_impl(uuid,uuid) from public,anon;
grant execute on function private.finance_link_po_item_variant_impl(uuid,uuid) to authenticated,service_role;

create or replace function public.link_admin_purchase_order_item_inventory_variant(p_purchase_order_item_id uuid,p_inventory_variant_id uuid default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_link_po_item_variant_impl(p_purchase_order_item_id,p_inventory_variant_id); $$;
revoke all on function public.link_admin_purchase_order_item_inventory_variant(uuid,uuid) from public,anon;
grant execute on function public.link_admin_purchase_order_item_inventory_variant(uuid,uuid) to authenticated,service_role;
