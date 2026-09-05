-- Atomic inventory transfer lifecycle for GDP multi-location inventory.

create or replace function public.admin_transition_inventory_transfer(
  p_transfer_id uuid,
  p_next_status text
)
returns public.inventory_transfers
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_transfer public.inventory_transfers;
  v_item record;
  v_source_available integer;
  v_before integer;
  v_after integer;
  v_received integer;
  v_total integer;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;

  select * into v_transfer
  from public.inventory_transfers
  where id = p_transfer_id
  for update;

  if not found then raise exception 'transfer not found'; end if;

  if p_next_status = 'ready' then
    if v_transfer.status <> 'draft' then raise exception 'only draft transfers can be marked ready'; end if;
    update public.inventory_transfers set status = 'ready'
    where id = p_transfer_id returning * into v_transfer;
    return v_transfer;
  end if;

  if p_next_status = 'cancelled' then
    if v_transfer.status not in ('draft','ready') then
      raise exception 'only draft or ready transfers can be cancelled safely';
    end if;
    update public.inventory_transfers set status = 'cancelled'
    where id = p_transfer_id returning * into v_transfer;
    return v_transfer;
  end if;

  if p_next_status = 'in_transit' then
    if v_transfer.status not in ('draft','ready') then
      raise exception 'transfer must be draft or ready before shipping';
    end if;

    for v_item in
      select * from public.inventory_transfer_items
      where transfer_id = p_transfer_id order by created_at
    loop
      select available into v_source_available
      from public.inventory_levels
      where location_id = v_transfer.from_location_id
        and variant_id = v_item.variant_id
      for update;

      v_source_available := coalesce(v_source_available, 0);
      if v_source_available < v_item.quantity then
        raise exception 'insufficient inventory for variant %', v_item.variant_id;
      end if;

      v_before := v_source_available;
      v_after := v_before - v_item.quantity;

      update public.inventory_levels
      set available = v_after
      where location_id = v_transfer.from_location_id
        and variant_id = v_item.variant_id;

      insert into public.inventory_adjustments(
        location_id, variant_id, adjustment, before_quantity, after_quantity,
        reason, note, actor_user_id
      ) values (
        v_transfer.from_location_id, v_item.variant_id, -v_item.quantity,
        v_before, v_after, 'transfer_out',
        'Inventory transfer ' || v_transfer.transfer_number, auth.uid()
      );

      insert into public.inventory_levels(location_id, variant_id, available, committed, incoming)
      values (v_transfer.to_location_id, v_item.variant_id, 0, 0, v_item.quantity)
      on conflict (location_id, variant_id)
      do update set
        incoming = public.inventory_levels.incoming + excluded.incoming,
        updated_at = now();

      select coalesce(sum(available), 0) into v_total
      from public.inventory_levels where variant_id = v_item.variant_id;

      update public.product_variants
      set stock = v_total, updated_at = now()
      where id = v_item.variant_id;
    end loop;

    update public.inventory_transfers
    set status = 'in_transit', shipped_at = now()
    where id = p_transfer_id returning * into v_transfer;
    return v_transfer;
  end if;

  if p_next_status = 'received' then
    if v_transfer.status <> 'in_transit' then
      raise exception 'only in-transit transfers can be received';
    end if;

    for v_item in
      select * from public.inventory_transfer_items
      where transfer_id = p_transfer_id order by created_at
    loop
      v_received := case
        when v_item.received_quantity > 0 then least(v_item.received_quantity, v_item.quantity)
        else v_item.quantity
      end;

      insert into public.inventory_levels(location_id, variant_id, available, committed, incoming)
      values (v_transfer.to_location_id, v_item.variant_id, v_received, 0, 0)
      on conflict (location_id, variant_id)
      do update set
        available = public.inventory_levels.available + v_received,
        incoming = greatest(0, public.inventory_levels.incoming - v_item.quantity),
        updated_at = now();

      select available - v_received into v_before
      from public.inventory_levels
      where location_id = v_transfer.to_location_id
        and variant_id = v_item.variant_id;

      v_before := greatest(0, coalesce(v_before, 0));
      v_after := v_before + v_received;

      insert into public.inventory_adjustments(
        location_id, variant_id, adjustment, before_quantity, after_quantity,
        reason, note, actor_user_id
      ) values (
        v_transfer.to_location_id, v_item.variant_id, v_received,
        v_before, v_after, 'transfer_in',
        'Inventory transfer ' || v_transfer.transfer_number, auth.uid()
      );

      update public.inventory_transfer_items
      set received_quantity = v_received
      where id = v_item.id;

      select coalesce(sum(available), 0) into v_total
      from public.inventory_levels where variant_id = v_item.variant_id;

      update public.product_variants
      set stock = v_total, updated_at = now()
      where id = v_item.variant_id;
    end loop;

    update public.inventory_transfers
    set status = 'received', received_at = now()
    where id = p_transfer_id returning * into v_transfer;
    return v_transfer;
  end if;

  raise exception 'unsupported transfer transition';
end;
$$;

revoke all on function public.admin_transition_inventory_transfer(uuid, text) from public;
revoke all on function public.admin_transition_inventory_transfer(uuid, text) from anon;
grant execute on function public.admin_transition_inventory_transfer(uuid, text) to authenticated;
