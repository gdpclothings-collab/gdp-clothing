-- Reprice Gildan adult short sleeve Custom Studio blank.
-- Keeps all six core colors at the same price and uses three size price bands.

update public.products
set
  price = 34.99,
  customization = jsonb_set(
    coalesce(customization, '{}'::jsonb),
    '{sizeSurcharges}',
    '{"2XL":3,"3XL":5,"4XL":5,"5XL":5}'::jsonb,
    true
  ),
  updated_at = now()
where slug = 'gildan-short-sleeve-adult-custom';

update public.product_variants
set
  price = case size
    when 'S' then null
    when 'M' then null
    when 'L' then null
    when 'XL' then null
    when '2XL' then 37.99
    when '3XL' then 39.99
    when '4XL' then 39.99
    when '5XL' then 39.99
    else price
  end,
  updated_at = now()
where product_id = (
  select id from public.products
  where slug = 'gildan-short-sleeve-adult-custom'
)
and color in ('Black','White','Sport Grey','Navy','Red','Royal')
and size in ('S','M','L','XL','2XL','3XL','4XL','5XL');
