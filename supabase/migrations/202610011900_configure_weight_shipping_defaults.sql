-- Record the production weight-shipping configuration introduced after PR #329.
-- This migration is intentionally idempotent and price-neutral.
-- It never overwrites a measured product weight and does not change the $150 free-shipping threshold.

with target_profile as (
  select id
  from public.shipping_profiles
  where name = 'Canada Standard'
    and product_scope = 'all'
    and active = true
  order by priority asc, created_at asc
  limit 1
), bands(name, min_g, max_g) as (
  values
    ('Standard Shipping — Light (0–499 g)'::text, 0::numeric, 499::numeric),
    ('Standard Shipping — Medium (500–999 g)', 500::numeric, 999::numeric),
    ('Standard Shipping — Heavy (1000–1999 g)', 1000::numeric, 1999::numeric),
    ('Standard Shipping — Extra Heavy (2000 g+)', 2000::numeric, null::numeric)
)
insert into public.shipping_rates (
  profile_id,
  name,
  method_code,
  price,
  min_order,
  max_order,
  min_delivery_days,
  max_delivery_days,
  active,
  conditions,
  country_codes,
  province_codes,
  postal_patterns,
  min_weight_grams,
  max_weight_grams,
  rate_source,
  priority
)
select
  p.id,
  b.name,
  'standard',
  12.99,
  0,
  149.99,
  3,
  7,
  true,
  jsonb_build_object(
    'source', 'GDP weight-based shipping configuration',
    'pricing_mode', 'price-neutral'
  ),
  array['CA']::text[],
  '{}'::text[],
  '{}'::text[],
  b.min_g,
  b.max_g,
  'manual',
  90
from target_profile p
cross join bands b
where not exists (
  select 1
  from public.shipping_rates r
  where r.profile_id = p.id
    and r.name = b.name
);

-- Reference weights are populated only for confidently matched Gildan styles.
-- They are useful for the price-neutral band selection above, but should be replaced
-- with scale-measured values before GDP introduces differentiated weight pricing.
with verified(slug, grams, source_note) as (
  values
    ('gildan-short-sleeve-adult-custom'::text, 251::numeric, 'Gildan 5000 / retailer-listed item weight 8.85 oz; verify on scale before differentiated pricing'),
    ('gildan-long-sleeve-adult-custom', 278::numeric, 'Gildan 5400 / retailer-listed item weight 9.799 oz; verify on scale before differentiated pricing'),
    ('gildan-adult-fleece-hoodie-custom', 648::numeric, 'Gildan 18500 / retailer-listed item weight 22.861 oz; verify on scale before differentiated pricing'),
    ('gildan-adult-crewneck-sweatshirt-custom', 530::numeric, 'Gildan 18000 / retailer-listed item weight 18.699 oz; verify on scale before differentiated pricing'),
    ('gildan-short-sleeve-toddler-custom', 86::numeric, 'Gildan 5100P / retailer-listed item weight 0.19 lb; verify on scale before differentiated pricing')
)
update public.products p
set
  weight = v.grams,
  weight_unit = 'g',
  metafields = coalesce(p.metafields, '{}'::jsonb) || jsonb_build_object(
    'shipping_weight_source', v.source_note,
    'shipping_weight_status', 'reference_verified_pending_scale_check'
  ),
  updated_at = now()
from verified v
where p.slug = v.slug
  and p.requires_shipping = true
  and p.status = 'active'
  and p.weight is null;
