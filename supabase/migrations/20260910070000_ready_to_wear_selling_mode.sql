-- Canonical product purchase flow for GDP Clothing.
-- Backfills existing products without changing their current customer-facing intent.

begin;

alter table public.products
  add column if not exists selling_mode text;

update public.products
set selling_mode = case
  when slug = 'dtf-gang-sheet'
    or theme_template = 'dtf-gang-sheet'
    or coalesce((metafields ->> 'dtf_gang_sheet')::boolean, false) = true
    then 'service'
  when custom_designable = true then 'custom'
  else 'ready_to_wear'
end
where selling_mode is null
   or selling_mode not in ('ready_to_wear', 'custom', 'service');

alter table public.products
  alter column selling_mode set default 'ready_to_wear',
  alter column selling_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_selling_mode_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_selling_mode_check
      check (selling_mode in ('ready_to_wear', 'custom', 'service'));
  end if;
end
$$;

create index if not exists products_status_selling_mode_idx
  on public.products(status, selling_mode);

comment on column public.products.selling_mode is
  'Authoritative purchase flow: ready_to_wear = direct variant Add to Bag, custom = Custom Studio, service = dedicated service builder.';

-- Defense in depth: order rows cannot relabel a custom-only product as a normal
-- ready-to-wear purchase (or vice versa). Checkout still performs its own
-- inventory and pricing checks before these rows are inserted.
create or replace function public.validate_order_item_selling_mode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_mode text;
  product_status text;
  product_channels text[];
  variant_product_id uuid;
begin
  if new.product_id is null then
    return new;
  end if;

  select p.selling_mode, p.status, p.sales_channels
    into product_mode, product_status, product_channels
  from public.products p
  where p.id = new.product_id;

  if product_mode is null then
    raise exception 'Order item product is unavailable.';
  end if;

  if product_status <> 'active' then
    raise exception 'Order item product is not active.';
  end if;

  if product_channels is not null
     and cardinality(product_channels) > 0
     and not ('online_store' = any(product_channels)) then
    raise exception 'Order item product is not enabled for the online store.';
  end if;

  if product_mode = 'ready_to_wear' then
    if new.is_custom = true or new.custom_design_id is not null then
      raise exception 'Ready-to-wear products cannot be submitted as custom items.';
    end if;

    if new.variant_id is null then
      raise exception 'Ready-to-wear products require a selected variant.';
    end if;

    select pv.product_id into variant_product_id
    from public.product_variants pv
    where pv.id = new.variant_id
      and pv.active = true;

    if variant_product_id is distinct from new.product_id then
      raise exception 'Selected ready-to-wear variant is unavailable.';
    end if;
  elsif product_mode = 'custom' then
    if new.is_custom <> true or new.custom_design_id is null then
      raise exception 'Custom products must be ordered through Custom Studio.';
    end if;
  elsif product_mode = 'service' then
    if new.is_custom = true then
      raise exception 'Service products cannot use the Custom Studio order path.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_validate_selling_mode on public.order_items;
create trigger order_items_validate_selling_mode
before insert or update of product_id, variant_id, custom_design_id, is_custom
on public.order_items
for each row execute function public.validate_order_item_selling_mode();

commit;
