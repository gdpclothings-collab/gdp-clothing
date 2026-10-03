-- Keep checkout inventory_levels and legacy product_variants.stock aligned.
-- inventory_levels remains the checkout authority; direct single-location stock edits
-- are mirrored safely into the sole inventory level for backwards compatibility.

create or replace function public.sync_variant_stock_to_inventory_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_track_inventory boolean;
  v_level_count integer;
  v_total_available integer;
  v_location_id uuid;
begin
  if new.stock is not distinct from old.stock then
    return new;
  end if;

  select p.track_inventory
    into v_track_inventory
  from public.products p
  where p.id = new.product_id;

  if coalesce(v_track_inventory, false) = false then
    return new;
  end if;

  if new.stock is null or new.stock < 0 then
    raise exception 'INVALID_INVENTORY_STOCK';
  end if;

  select count(*), coalesce(sum(il.available), 0)
    into v_level_count, v_total_available
  from public.inventory_levels il
  where il.variant_id = new.id;

  if v_level_count = 0 then
    select l.id
      into v_location_id
    from public.inventory_locations l
    where l.active = true
      and l.fulfills_online = true
    order by l.is_default desc, l.sort_order asc, l.id
    limit 1;

    if v_location_id is null then
      raise exception 'NO_ONLINE_INVENTORY_LOCATION';
    end if;

    insert into public.inventory_levels(location_id, variant_id, available, committed, incoming)
    values (v_location_id, new.id, new.stock, 0, 0)
    on conflict (location_id, variant_id)
    do update set available = excluded.available, updated_at = now();

    return new;
  end if;

  if v_level_count = 1 and v_total_available <> new.stock then
    if exists (
      select 1
      from public.order_inventory_reservations r
      where r.variant_id = new.id
        and r.status = 'active'
        and r.expires_at > now()
    ) or exists (
      select 1
      from public.inventory_levels il
      where il.variant_id = new.id
        and il.committed > 0
    ) then
      raise exception 'INVENTORY_RESERVED_USE_ADJUSTMENT';
    end if;

    update public.inventory_levels
    set available = new.stock,
        updated_at = now()
    where variant_id = new.id;

    return new;
  end if;

  if v_level_count > 1 and v_total_available <> new.stock then
    raise exception 'MULTI_LOCATION_STOCK_USE_INVENTORY_ADJUSTMENT';
  end if;

  return new;
end;
$$;

create or replace function public.seed_inventory_level_for_variant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_track_inventory boolean;
  v_location_id uuid;
begin
  select p.track_inventory
    into v_track_inventory
  from public.products p
  where p.id = new.product_id;

  if coalesce(v_track_inventory, false) = false then
    return new;
  end if;

  if exists (
    select 1 from public.inventory_levels il where il.variant_id = new.id
  ) then
    return new;
  end if;

  select l.id
    into v_location_id
  from public.inventory_locations l
  where l.active = true
    and l.fulfills_online = true
  order by l.is_default desc, l.sort_order asc, l.id
  limit 1;

  if v_location_id is null then
    raise exception 'NO_ONLINE_INVENTORY_LOCATION';
  end if;

  insert into public.inventory_levels(location_id, variant_id, available, committed, incoming)
  values (v_location_id, new.id, greatest(coalesce(new.stock, 0), 0), 0, 0)
  on conflict (location_id, variant_id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_inventory_level_to_variant_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant_id uuid;
  v_track_inventory boolean;
  v_total_available integer;
begin
  v_variant_id := coalesce(new.variant_id, old.variant_id);

  if tg_op = 'UPDATE' and new.available is not distinct from old.available then
    return new;
  end if;

  select p.track_inventory
    into v_track_inventory
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where pv.id = v_variant_id;

  if coalesce(v_track_inventory, false) = false then
    return coalesce(new, old);
  end if;

  select coalesce(sum(il.available), 0)
    into v_total_available
  from public.inventory_levels il
  where il.variant_id = v_variant_id;

  update public.product_variants
  set stock = v_total_available,
      updated_at = now()
  where id = v_variant_id
    and stock is distinct from v_total_available;

  return coalesce(new, old);
end;
$$;

create or replace function public.seed_inventory_levels_when_tracking_enabled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id uuid;
begin
  if new.track_inventory is not true or old.track_inventory is true then
    return new;
  end if;

  select l.id
    into v_location_id
  from public.inventory_locations l
  where l.active = true
    and l.fulfills_online = true
  order by l.is_default desc, l.sort_order asc, l.id
  limit 1;

  if v_location_id is null then
    raise exception 'NO_ONLINE_INVENTORY_LOCATION';
  end if;

  insert into public.inventory_levels(location_id, variant_id, available, committed, incoming)
  select v_location_id, pv.id, greatest(coalesce(pv.stock, 0), 0), 0, 0
  from public.product_variants pv
  where pv.product_id = new.id
    and not exists (
      select 1 from public.inventory_levels il where il.variant_id = pv.id
    )
  on conflict (location_id, variant_id) do nothing;

  return new;
end;
$$;

-- Repair existing tracked variants that have no online inventory row.
do $$
declare
  v_location_id uuid;
begin
  select l.id
    into v_location_id
  from public.inventory_locations l
  where l.active = true
    and l.fulfills_online = true
  order by l.is_default desc, l.sort_order asc, l.id
  limit 1;

  if v_location_id is null then
    raise exception 'NO_ONLINE_INVENTORY_LOCATION';
  end if;

  insert into public.inventory_levels(location_id, variant_id, available, committed, incoming)
  select v_location_id, pv.id, greatest(coalesce(pv.stock, 0), 0), 0, 0
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where p.track_inventory = true
    and not exists (
      select 1 from public.inventory_levels il where il.variant_id = pv.id
    )
  on conflict (location_id, variant_id) do nothing;
end;
$$;

-- Repair legacy single-location drift only when no checkout reservation is active.
update public.inventory_levels il
set available = greatest(coalesce(pv.stock, 0), 0),
    updated_at = now()
from public.product_variants pv
join public.products p on p.id = pv.product_id
where il.variant_id = pv.id
  and p.track_inventory = true
  and (select count(*) from public.inventory_levels x where x.variant_id = pv.id) = 1
  and il.available is distinct from greatest(coalesce(pv.stock, 0), 0)
  and not exists (
    select 1
    from public.order_inventory_reservations r
    where r.variant_id = pv.id
      and r.status = 'active'
      and r.expires_at > now()
  )
  and il.committed = 0;

-- Triggers are installed after the one-time repair to avoid unnecessary nested writes.
drop trigger if exists product_variants_sync_stock_to_inventory on public.product_variants;
create trigger product_variants_sync_stock_to_inventory
before update of stock on public.product_variants
for each row
execute function public.sync_variant_stock_to_inventory_level();

drop trigger if exists product_variants_seed_inventory_level on public.product_variants;
create trigger product_variants_seed_inventory_level
after insert on public.product_variants
for each row
execute function public.seed_inventory_level_for_variant();

drop trigger if exists inventory_levels_sync_variant_stock on public.inventory_levels;
create trigger inventory_levels_sync_variant_stock
after insert or update of available or delete on public.inventory_levels
for each row
execute function public.sync_inventory_level_to_variant_stock();

drop trigger if exists products_seed_inventory_when_tracking_enabled on public.products;
create trigger products_seed_inventory_when_tracking_enabled
after update of track_inventory on public.products
for each row
execute function public.seed_inventory_levels_when_tracking_enabled();
