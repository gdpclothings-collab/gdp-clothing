-- Safe GDP admin order cleanup.
-- Real paid/refunded/fulfilled orders are intentionally protected from hard deletion.

create or replace function public.admin_delete_test_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_is_admin boolean := false;
begin
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','super_admin'), false)
    into v_is_admin;

  if not v_is_admin then
    raise exception 'Admin access required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if coalesce(v_order.payment_status, '') in ('paid','refunded','partially_refunded')
     or coalesce(v_order.fulfillment_status, '') in ('fulfilled','shipped','out_for_delivery','delivered','picked_up')
     or coalesce(v_order.status, '') in ('completed','delivered','refunded','partially_refunded') then
    raise exception 'Protected commerce record: archive/cancel this order instead of deleting it';
  end if;

  if not (
    coalesce(v_order.payment_mode, '') = 'test'
    or coalesce(v_order.payment_status, '') in ('failed','pending')
    or coalesce(v_order.status, '') in ('payment_failed','pending_payment','cancelled','draft')
  ) then
    raise exception 'Only verified test, failed, pending, cancelled, or draft orders can be deleted';
  end if;

  -- Child rows use order_id and are removed first where present in the commerce schema.
  delete from public.order_activity_events where order_id = p_order_id;
  delete from public.order_inventory_allocations where order_id = p_order_id;
  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;

  return jsonb_build_object('deleted', true, 'order_id', p_order_id, 'order_number', v_order.order_number);
end;
$$;

revoke all on function public.admin_delete_test_order(uuid) from public, anon;
grant execute on function public.admin_delete_test_order(uuid) to authenticated;
