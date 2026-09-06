-- GDP Clothing Custom Studio blank garment catalog
-- Uses existing products + product_variants so Studio, inventory and checkout share one source of truth.

with seed(
  name, slug, description, type, category, price, colors, sizes, size_surcharges
) as (
  values
    (
      'Gildan® Short Sleeve Adult T-Shirt',
      'gildan-short-sleeve-adult-custom',
      'Classic adult short-sleeve blank for custom GDP Clothing designs.',
      'T-Shirt',
      'Custom Studio Blanks',
      34.99::numeric,
      array['Black','White','Sport Grey','Navy','Red','Royal']::text[],
      array['S','M','L','XL','2XL','3XL','4XL','5XL']::text[],
      '{"2XL":2,"3XL":3,"4XL":5,"5XL":7}'::jsonb
    ),
    (
      'Gildan® Long Sleeve Crew Neck Adult T-Shirt',
      'gildan-long-sleeve-adult-custom',
      'Adult long-sleeve crew-neck blank for custom GDP Clothing designs.',
      'Long Sleeve',
      'Custom Studio Blanks',
      44.99::numeric,
      array['Black','White','Sport Grey','Navy','Red','Royal']::text[],
      array['S','M','L','XL','2XL','3XL']::text[],
      '{"2XL":2,"3XL":3}'::jsonb
    ),
    (
      'Gildan® Short Sleeve Toddler T-Shirt',
      'gildan-short-sleeve-toddler-custom',
      'Toddler short-sleeve blank for personalized family, birthday and event designs.',
      'Toddler T-Shirt',
      'Custom Studio Blanks',
      29.99::numeric,
      array['Black','White','Sport Grey','Navy','Red','Pink']::text[],
      array['2T','3T','4T','5T']::text[],
      '{}'::jsonb
    ),
    (
      'Gildan® Short Sleeve Youth T-Shirt',
      'gildan-short-sleeve-youth-custom',
      'Youth short-sleeve blank for teams, schools, birthdays and custom designs.',
      'Youth T-Shirt',
      'Custom Studio Blanks',
      31.99::numeric,
      array['Black','White','Sport Grey','Navy','Red','Royal']::text[],
      array['XS','S','M','L','XL']::text[],
      '{}'::jsonb
    ),
    (
      'Gildan® Adult Fleece Hooded Sweatshirt',
      'gildan-adult-fleece-hoodie-custom',
      'Classic adult pullover fleece hoodie blank for custom GDP Clothing designs.',
      'Hoodie',
      'Custom Studio Blanks',
      64.99::numeric,
      array['Black','White','Sport Grey','Navy','Red','Sand']::text[],
      array['S','M','L','XL','2XL','3XL','4XL','5XL']::text[],
      '{"2XL":3,"3XL":5,"4XL":8,"5XL":10}'::jsonb
    )
),
upserted as (
  insert into public.products (
    name, slug, description, type, category, vendor,
    price, colors, sizes, tags,
    track_inventory, sell_when_out_of_stock,
    requires_shipping, taxable, fulfillment_mode,
    status, featured, best_seller, new_arrival,
    custom_designable, customization, theme_template
  )
  select
    s.name,
    s.slug,
    s.description,
    s.type,
    s.category,
    'Gildan',
    s.price,
    s.colors,
    s.sizes,
    array['custom-studio-only','custom-blank','gildan']::text[],
    false,
    true,
    true,
    true,
    'in_house',
    'active',
    false,
    false,
    false,
    true,
    jsonb_build_object(
      'proofRequired', true,
      'includedRevisions', 2,
      'frontBackFee', 10,
      'rushDesignFee', 10,
      'rushProductionFee', 15,
      'garmentTier', 'classic',
      'sizeSurcharges', s.size_surcharges,
      'preview', jsonb_build_object(
        'colorSwatches', jsonb_build_object(
          'Black','#171717',
          'White','#f7f6f1',
          'Sport Grey','#b7b8b3',
          'Navy','#17243b',
          'Red','#b52332',
          'Royal','#2857a6',
          'Pink','#eeb1c8',
          'Sand','#d5c1a0'
        ),
        'colorMockups', '{}'::jsonb,
        'printArea', jsonb_build_object(
          'front', jsonb_build_object('top', case when s.type = 'Hoodie' then 32 else 29 end, 'width', case when s.type = 'Hoodie' then 34 else 36 end, 'height', case when s.type = 'Hoodie' then 36 else 38 end),
          'back', jsonb_build_object('top', case when s.type = 'Hoodie' then 30 else 29 end, 'width', case when s.type = 'Hoodie' then 34 else 36 end, 'height', case when s.type = 'Hoodie' then 38 else 38 end)
        )
      )
    ),
    'custom-studio'
  from seed s
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    type = excluded.type,
    category = excluded.category,
    vendor = excluded.vendor,
    colors = excluded.colors,
    sizes = excluded.sizes,
    tags = excluded.tags,
    track_inventory = excluded.track_inventory,
    sell_when_out_of_stock = excluded.sell_when_out_of_stock,
    custom_designable = excluded.custom_designable,
    status = excluded.status,
    customization = excluded.customization,
    theme_template = excluded.theme_template,
    updated_at = now()
  returning id, slug, price, colors, sizes, customization
),
targets as (
  select u.id, u.slug, u.price, u.colors, u.sizes, u.customization
  from upserted u
),
matrix as (
  select
    t.*,
    color,
    size,
    coalesce((t.customization->'sizeSurcharges'->>size)::numeric, 0) as surcharge
  from targets t
  cross join lateral unnest(t.colors) as color
  cross join lateral unnest(t.sizes) as size
)
insert into public.product_variants (
  product_id, name, sku, stock, price, color, size, active
)
select
  m.id,
  m.color || ' / ' || m.size,
  'GDP-CS-' || upper(substr(md5(m.slug), 1, 6)) || '-' ||
    regexp_replace(upper(m.color), '[^A-Z0-9]+', '', 'g') || '-' ||
    regexp_replace(upper(m.size), '[^A-Z0-9]+', '', 'g'),
  0,
  case when m.surcharge > 0 then m.price + m.surcharge else null end,
  m.color,
  m.size,
  true
from matrix m
on conflict (sku) do update set
  name = excluded.name,
  price = excluded.price,
  color = excluded.color,
  size = excluded.size,
  active = true,
  updated_at = now();
