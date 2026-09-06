-- GDP Clothing - per-variant product cost overrides
-- Null variant cost inherits products.cost_per_item.

alter table public.product_variants
  add column if not exists cost_per_item numeric(12,2)
  check (cost_per_item is null or cost_per_item >= 0);
