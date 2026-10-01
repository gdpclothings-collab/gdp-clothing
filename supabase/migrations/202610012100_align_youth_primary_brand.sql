-- Align the Youth Short Sleeve Tee with its verified primary T-Shirt Ideal blank.
-- Keep the existing product slug for compatibility, but stop presenting Gildan as the
-- primary brand when the verified primary style is M&O 4850. Michaels/Gildan remains
-- the emergency fallback and therefore requires substitution approval.

update public.store_settings
set apparel_pricing = jsonb_set(
  coalesce(apparel_pricing, '{}'::jsonb),
  '{sourcing,garments,youthTshirt}',
  coalesce(apparel_pricing #> '{sourcing,garments,youthTshirt}', '{}'::jsonb) || jsonb_build_object(
    'label', 'Youth Short Sleeve T-Shirt',
    'primaryBrand', 'M&O',
    'primaryStyle', '4850',
    'primaryProductName', 'M&O 4850 Gold Soft Touch Youth T-Shirt',
    'wholesaleCost', 3.57,
    'wholesaleCostCurrency', 'CAD',
    'wholesaleCostBasis', 'starting_at',
    'wholesaleObservedAt', '2026-10-01',
    'primarySupportedSizes', jsonb_build_array('XS','S','M','L','XL'),
    'requiresSubstitutionApproval', true
  ),
  true
),
updated_at = now()
where id = 1;

update public.products
set
  vendor = 'M&O',
  description = 'A classic-fit youth short-sleeve blank for school, team, birthday and custom DTF designs. The primary T-Shirt Ideal blank is M&O 4850; a Gildan blank may be used only as an approved emergency fallback.',
  customization = coalesce(customization, '{}'::jsonb)
    || jsonb_build_object(
      'garmentDetails', jsonb_build_array(
        'Youth classic fit',
        'Rib-knit crew neck',
        'Most solid colours are cotton; selected greys, heathers and safety colours use cotton/polyester blends',
        'Tear-away label on the primary M&O 4850 blank'
      ),
      'supplierSourcing', coalesce(customization->'supplierSourcing', '{}'::jsonb)
        || jsonb_build_object(
          'primarySupplier', 'T-Shirt Ideal',
          'primaryBrand', 'M&O',
          'primaryStyle', '4850',
          'primaryProductName', 'M&O 4850 Gold Soft Touch Youth T-Shirt',
          'primaryStartingCost', 3.57,
          'primaryCostCurrency', 'CAD',
          'primaryCostBasis', 'starting_at',
          'primaryObservedAt', '2026-10-01',
          'primarySupportedSizes', jsonb_build_array('XS','S','M','L','XL'),
          'fallbackSupplier', 'Michaels',
          'fallbackBrand', 'Gildan',
          'requiresSubstitutionApproval', true,
          'useFallbackRetailAsBasePrice', false
        )
    ),
  updated_at = now()
where slug = 'gildan-short-sleeve-youth-custom';

-- Existing product slug, pricing, images, variants, inventory, print geometry,
-- cart/checkout state and Stripe behavior are intentionally unchanged.
