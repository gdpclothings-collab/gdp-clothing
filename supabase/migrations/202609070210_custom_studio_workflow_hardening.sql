-- GDP Clothing Custom Studio end-to-end workflow hardening
-- Inventory reservations and coupon reservations are consumed only after payment.

begin;

with main_location as (
  select id
  from public.inventory_locations
  where active = true
    and fulfills_online = true
  order by is_default desc, sort_order asc, id
  limit 1
),
studio_variants as (
  select pv.id as variant_id, greatest(0, coalesce(pv.stock, 0)) as stock
  from public.products p
  join public.product_variants pv on pv.product_id = p.id
  where p.status = 'active'
    and p.custom_designable = true
    and pv.active = true
    and exists (
      select 1
      from unnest(coalesce(p.tags, '{}'::text[])) tag
      where lower(tag) = 'custom-studio-only'
    )
)
insert into public.inventory_levels(location_id, variant_id, available, committed, incoming)
select ml.id, sv.variant_id, sv.stock, 0, 0
from main_location ml
cross join studio_variants sv
on conflict (location_id, variant_id) do nothing;

update public.products p
set track_inventory = true,
    sell_when_out_of_stock = false,
    updated_at = now()
where p.status = 'active'
  and p.custom_designable = true
  and exists (
    select 1
    from unnest(coalesce(p.tags, '{}'::text[])) tag
    where lower(tag) = 'custom-studio-only'
  );

update public.products
set customization = jsonb_set(
      coalesce(customization, '{}'::jsonb),
      '{preview}',
      (
        coalesce(customization->'preview', '{}'::jsonb)
        - 'frontMockupUrl'
        - 'backMockupUrl'
      ) || jsonb_build_object('colorMockups', '{}'::jsonb),
      true
    ),
    updated_at = now()
where slug = 'gildan-long-sleeve-adult-custom';

create or replace function public.release_expired_checkout_reservations()
returns integer
language plpgsql
set search_path = public
as $function$
declare
  v_order_id uuid;
  v_count integer := 0;
begin
  for v_order_id in
    select distinct x.order_id
    from (
      select order_id
      from public.order_inventory_reservations
      where status = 'active' and expires_at <= now()
      union
      select order_id
      from public.order_coupon_reservations
      where status = 'active' and expires_at <= now()
    ) x
  loop
    perform public.release_order_inventory_reservations(v_order_id, 'expired');
    perform public.release_order_coupon_reservation(v_order_id, 'expired');

    update public.orders
    set payment_status = 'failed',
        status = 'payment_failed',
        fulfillment_status = 'unfulfilled',
        updated_at = now()
    where id = v_order_id
      and payment_status = 'pending';

    v_count := v_count + 1;
  end loop;

  delete from public.checkout_rate_limits
  where updated_at < now() - interval '24 hours';

  return v_count;
end;
$function$;

commit;
