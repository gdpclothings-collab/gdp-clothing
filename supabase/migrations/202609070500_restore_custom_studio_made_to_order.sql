-- Custom Studio blanks are made-to-order. Their generated variant rows intentionally
-- start at zero stock, so inventory tracking must remain off until real blank stock
-- is loaded by an administrator. Checkout still validates that the chosen variant
-- exists and is active.

begin;

update public.products p
set track_inventory = false,
    sell_when_out_of_stock = true,
    updated_at = now()
where p.status = 'active'
  and p.custom_designable = true
  and exists (
    select 1
    from unnest(coalesce(p.tags, '{}'::text[])) tag
    where lower(tag) = 'custom-studio-only'
  )
  and not exists (
    select 1
    from public.product_variants pv
    where pv.product_id = p.id
      and pv.active = true
      and coalesce(pv.stock, 0) > 0
  );

commit;
