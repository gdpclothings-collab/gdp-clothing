-- Record verified T-Shirt Ideal primary size support without changing sellable variants.
-- These arrays are sourcing/reference metadata only; they do not activate inventory,
-- add storefront variants, or change customer pricing.

update public.store_settings
set apparel_pricing = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(apparel_pricing, '{}'::jsonb),
          '{sourcing,garments,adultTshirt,primarySupportedSizes}',
          '["XS","S","M","L","XL","2XL","3XL","4XL"]'::jsonb,
          true
        ),
        '{sourcing,garments,toddlerTshirt,primarySupportedSizes}',
        '["2T","3T","4T","5T","6T"]'::jsonb,
        true
      ),
      '{sourcing,garments,longSleeve,primarySupportedSizes}',
      '["S","M","L","XL","2XL","3XL","4XL","5XL"]'::jsonb,
      true
    ),
    '{sourcing,garments,crewneck,primarySupportedSizes}',
    '["S","M","L","XL","2XL","3XL","4XL","5XL"]'::jsonb,
    true
  ),
  '{sourcing,garments,hoodie,primarySupportedSizes}',
  '["S","M","L","XL","2XL","3XL","4XL","5XL"]'::jsonb,
  true
),
updated_at = now()
where id = 1;

with primary_sizes(slug, sizes) as (
  values
    ('gildan-short-sleeve-adult-custom', '["XS","S","M","L","XL","2XL","3XL","4XL"]'::jsonb),
    ('gildan-short-sleeve-toddler-custom', '["2T","3T","4T","5T","6T"]'::jsonb),
    ('gildan-long-sleeve-adult-custom', '["S","M","L","XL","2XL","3XL","4XL","5XL"]'::jsonb),
    ('gildan-adult-crewneck-sweatshirt-custom', '["S","M","L","XL","2XL","3XL","4XL","5XL"]'::jsonb),
    ('gildan-adult-fleece-hoodie-custom', '["S","M","L","XL","2XL","3XL","4XL","5XL"]'::jsonb)
)
update public.products p
set customization = coalesce(p.customization, '{}'::jsonb)
  || jsonb_build_object(
    'supplierSourcing',
    coalesce(p.customization->'supplierSourcing', '{}'::jsonb)
      || jsonb_build_object(
        'primarySupportedSizes', s.sizes,
        'primarySizeSupportObservedAt', '2026-10-01',
        'primarySizeSupportPolicy', 'supplier_supported_not_stock'
      )
  ),
updated_at = now()
from primary_sizes s
where p.slug = s.slug;

-- Youth already has verified primarySupportedSizes from PR #333 and is intentionally unchanged.
