-- Add the Gildan adult crewneck sweatshirt blank to GDP Clothing Custom Studio.
-- The Michaels item shown by the owner is kept only as a sourcing reference;
-- customer pricing remains controlled by GDP Clothing's existing crewneck pricing settings.

with upserted as (
  insert into public.products (
    name,
    slug,
    description,
    type,
    category,
    vendor,
    price,
    colors,
    sizes,
    tags,
    track_inventory,
    sell_when_out_of_stock,
    requires_shipping,
    taxable,
    fulfillment_mode,
    status,
    featured,
    best_seller,
    new_arrival,
    custom_designable,
    customization,
    theme_template
  )
  values (
    'Gildan® Crewneck Adult Sweatshirt',
    'gildan-adult-crewneck-sweatshirt-custom',
    'Classic adult fleece crewneck sweatshirt with a soft 50/50 cotton-polyester blend for custom GDP Clothing designs.',
    'Crewneck Sweatshirt',
    'Custom Studio Blanks',
    'Gildan',
    59.99::numeric,
    array['Black','White','Gray','Navy','Red','Royal','Irish Green']::text[],
    array['S','M','L','XL']::text[],
    array['custom-studio-only','custom-blank','gildan','crewneck','sweatshirt']::text[],
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
      'sizeSurcharges', '{}'::jsonb,
      'supplierReference', jsonb_build_object(
        'retailer', 'Michaels Canada',
        'referenceItem', '10619430',
        'referenceColor', 'Red',
        'referenceSize', 'XL'
      ),
      'preview', jsonb_build_object(
        'colorSwatches', jsonb_build_object(
          'Black', '#171717',
          'White', '#f7f6f1',
          'Gray', '#b7b8b3',
          'Navy', '#17243b',
          'Red', '#b52332',
          'Royal', '#2857a6',
          'Irish Green', '#438f50'
        ),
        'colorMockups', '{}'::jsonb,
        'printArea', jsonb_build_object(
          'front', jsonb_build_object('top', 30, 'width', 36, 'height', 38),
          'back', jsonb_build_object('top', 30, 'width', 36, 'height', 38)
        )
      )
    ),
    'custom-studio'
  )
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
    requires_shipping = excluded.requires_shipping,
    taxable = excluded.taxable,
    fulfillment_mode = excluded.fulfillment_mode,
    status = excluded.status,
    custom_designable = excluded.custom_designable,
    customization = excluded.customization,
    theme_template = excluded.theme_template,
    updated_at = now()
  returning id, slug, price, colors, sizes, customization
),
matrix as (
  select
    u.id,
    u.slug,
    u.price,
    color,
    size,
    coalesce((u.customization->'sizeSurcharges'->>size)::numeric, 0) as surcharge
  from upserted u
  cross join lateral unnest(u.colors) as color
  cross join lateral unnest(u.sizes) as size
)
insert into public.product_variants (
  product_id,
  name,
  sku,
  stock,
  price,
  color,
  size,
  active
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
