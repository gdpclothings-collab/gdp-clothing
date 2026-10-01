-- Record verified T-Shirt Ideal primary garment references and base wholesale costs.
-- Prices were observed on 2026-10-01 and are explicitly "starting at" CAD values,
-- so they are internal sourcing references only and must not automatically alter retail pricing.

update public.store_settings
set apparel_pricing = jsonb_set(
  coalesce(apparel_pricing, '{}'::jsonb),
  '{sourcing,garments}',
  coalesce(apparel_pricing #> '{sourcing,garments}', '{}'::jsonb) || jsonb_build_object(
    'adultTshirt', coalesce(apparel_pricing #> '{sourcing,garments,adultTshirt}', '{}'::jsonb) || jsonb_build_object(
      'wholesaleCost', 3.89,
      'wholesaleCostCurrency', 'CAD',
      'wholesaleCostBasis', 'starting_at',
      'wholesaleObservedAt', '2026-10-01',
      'primaryBrand', 'Gildan',
      'primaryStyle', '64000',
      'primaryProductName', 'Gildan 64000 Softstyle T-Shirt'
    ),
    'youthTshirt', coalesce(apparel_pricing #> '{sourcing,garments,youthTshirt}', '{}'::jsonb) || jsonb_build_object(
      'wholesaleCost', 3.57,
      'wholesaleCostCurrency', 'CAD',
      'wholesaleCostBasis', 'starting_at',
      'wholesaleObservedAt', '2026-10-01',
      'primaryBrand', 'M&O',
      'primaryStyle', '4850',
      'primaryProductName', 'M&O 4850 Gold Soft Touch Youth T-Shirt'
    ),
    'toddlerTshirt', coalesce(apparel_pricing #> '{sourcing,garments,toddlerTshirt}', '{}'::jsonb) || jsonb_build_object(
      'wholesaleCost', 3.62,
      'wholesaleCostCurrency', 'CAD',
      'wholesaleCostBasis', 'starting_at',
      'wholesaleObservedAt', '2026-10-01',
      'primaryBrand', 'Gildan',
      'primaryStyle', '5100P',
      'primaryProductName', 'Gildan 5100P Heavy Cotton Toddler T-Shirt'
    ),
    'longSleeve', coalesce(apparel_pricing #> '{sourcing,garments,longSleeve}', '{}'::jsonb) || jsonb_build_object(
      'wholesaleCost', 8.44,
      'wholesaleCostCurrency', 'CAD',
      'wholesaleCostBasis', 'starting_at',
      'wholesaleObservedAt', '2026-10-01',
      'primaryBrand', 'Gildan',
      'primaryStyle', '2400',
      'primaryProductName', 'Gildan 2400 Ultra Cotton Long Sleeve T-Shirt'
    ),
    'crewneck', coalesce(apparel_pricing #> '{sourcing,garments,crewneck}', '{}'::jsonb) || jsonb_build_object(
      'wholesaleCost', 11.78,
      'wholesaleCostCurrency', 'CAD',
      'wholesaleCostBasis', 'starting_at',
      'wholesaleObservedAt', '2026-10-01',
      'primaryBrand', 'Gildan',
      'primaryStyle', '18000',
      'primaryProductName', 'Gildan 18000 Heavy Blend Crewneck Sweatshirt'
    ),
    'hoodie', coalesce(apparel_pricing #> '{sourcing,garments,hoodie}', '{}'::jsonb) || jsonb_build_object(
      'wholesaleCost', 13.49,
      'wholesaleCostCurrency', 'CAD',
      'wholesaleCostBasis', 'starting_at',
      'wholesaleObservedAt', '2026-10-01',
      'primaryBrand', 'Gildan',
      'primaryStyle', '18500',
      'primaryProductName', 'Gildan 18500 Heavy Blend Hooded Sweatshirt'
    )
  ),
  true
),
updated_at = now()
where id = 1;
