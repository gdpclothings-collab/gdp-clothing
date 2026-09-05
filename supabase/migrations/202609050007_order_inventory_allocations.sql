-- Order-to-inventory allocation layer.
-- Prevents duplicate stock deductions when Stripe retries webhook events.

create table if not exists public.order_inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(order_item_id)
);

create index if not exists order_inventory_allocations_order_idx
  on public.order_inventory_allocations(order_id);
create index if not exists order_inventory_allocations_variant_idx
  on public.order_inventory_allocations(variant_id);
create index if not exists order_inventory_allocations_location_idx
  on public.order_inventory_allocations(location_id);

alter table public.order_inventory_allocations enable row level security;

create policy order_inventory_allocations_admin_read
on public.order_inventory_allocations
for select
using (public.is_admin());

create or replace function public.apply_paid_order_inventory(p_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item record;
  v_location_id uuid;
  v_available integer;
  v_after integer;
  v_total integer;
  v_allocated integer := 0;
  v_shortages jsonb := '[]'::jsonb;
begin
  for v_item in
    select
      oi.id as order_item_id,
      oi.variant_id,
      oi.quantity,
      oi.name,
      pv.stock,
      p.track_inventory
    from public.order_items oi
    join public.product_variants pv on pv.id = oi.variant_id
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
      and oi.variant_id is not null
      and p.track_inventory = true
  loop
    if exists (
      select 1
      from public.order_inventory_allocations a
      where a.order_item_id = v_item.order_item_id
    ) then
      continue;
    end if;

    select l.id, il.available
    into v_location_id, v_available
    from public.inventory_locations l
    join public.inventory_levels il
      on il.location_id = l.id
     and il.variant_id = v_item.variant_id
    where l.active = true
      and l.fulfills_online = true
      and il.available >= v_item.quantity
    order by l.is_default desc, l.sort_order asc, il.available desc
    limit 1
    for update of il;

    if v_location_id is null then
      v_shortages := v_shortages || jsonb_build_array(
        jsonb_build_object(
          'order_item_id', v_item.order_item_id,
          'variant_id', v_item.variant_id,
          'name', v_item.name,
          'required', v_item.quantity
        )
      );
      continue;
    end if;

    v_after := v_available - v_item.quantity;

    update public.inventory_levels
    set available = v_after,
        updated_at = now()
    where location_id = v_location_id
      and variant_id = v_item.variant_id;

    insert into public.inventory_adjustments(
      location_id,
      variant_id,
      adjustment,
      before_quantity,
      after_quantity,
      reason,
      note,
      actor_user_id
    )
    values (
      v_location_id,
      v_item.variant_id,
      -v_item.quantity,
      v_available,
      v_after,
      'sale',
      'Paid order inventory allocation',
      null
    );

    insert into public.order_inventory_allocations(
      order_id,
      order_item_id,
      variant_id,
      location_id,
      quantity
    )
    values (
      p_order_id,
      v_item.order_item_id,
      v_item.variant_id,
      v_location_id,
      v_item.quantity
    )
    on conflict (order_item_id) do nothing;

    select coalesce(sum(available), 0)
    into v_total
    from public.inventory_levels
    where variant_id = v_item.variant_id;

    update public.product_variants
    set stock = v_total,
        updated_at = now()
    where id = v_item.variant_id;

    v_allocated := v_allocated + 1;
    v_location_id := null;
    v_available := null;
  end loop;

  return jsonb_build_object(
    'allocated_items', v_allocated,
    'shortages', v_shortages
  );
end;
$$;

revoke all on function public.apply_paid_order_inventory(uuid) from public;
revoke all on function public.apply_paid_order_inventory(uuid) from anon;
revoke all on function public.apply_paid_order_inventory(uuid) from authenticated;
grant execute on function public.apply_paid_order_inventory(uuid) to service_role;
