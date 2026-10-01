-- Keep product-level supplier sourcing metadata aligned with the verified
-- T-Shirt Ideal primary blank references recorded in store_settings.
-- This is internal sourcing metadata only: retail prices, variants, stock,
-- images, print guides, checkout, shipping and Stripe behavior are unchanged.

with primary_sources(slug, primary_brand, primary_style, primary_product_name, primary_starting_cost) as (
  values
    ('gildan-short-sleeve-adult-custom', 'Gildan', '64000', 'Gildan 64000 Softstyle T-Shirt', 3.89::numeric),
    ('gildan-short-sleeve-toddler-custom', 'Gildan', '5100P', 'Gildan 5100P Heavy Cotton Toddler T-Shirt', 3.62::numeric),
    ('gildan-long-sleeve-adult-custom', 'Gildan', '2400', 'Gildan 2400 Ultra Cotton Long Sleeve T-Shirt', 8.44::numeric),
    ('gildan-adult-crewneck-sweatshirt-custom', 'Gildan', '18000', 'Gildan 18000 Heavy Blend Crewneck Sweatshirt', 11.78::numeric),
    ('gildan-adult-fleece-hoodie-custom', 'Gildan', '18500', 'Gildan 18500 Heavy Blend Hooded Sweatshirt', 13.49::numeric)
)
update public.products p
set
  customization = coalesce(p.customization, '{}'::jsonb)
    || jsonb_build_object(
      'supplierSourcing',
      coalesce(p.customization->'supplierSourcing', '{}'::jsonb)
        || jsonb_build_object(
          'primarySupplier', 'T-Shirt Ideal',
          'primaryBrand', s.primary_brand,
          'primaryStyle', s.primary_style,
          'primaryProductName', s.primary_product_name,
          'primaryStartingCost', s.primary_starting_cost,
          'primaryCostCurrency', 'CAD',
          'primaryCostBasis', 'starting_at',
          'primaryObservedAt', '2026-10-01',
          'useFallbackRetailAsBasePrice', false
        )
    ),
  updated_at = now()
from primary_sources s
where p.slug = s.slug;

-- Youth is intentionally excluded here because PR #333 already aligned the
-- product-level primary metadata to M&O 4850 and added fallback substitution approval.
