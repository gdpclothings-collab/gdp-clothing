-- Expand the GDP master catalog with Michaels-supported variants while preserving
-- existing wholesale colors, sizes, inventory quantities and active states.

with additions(slug, add_colors, add_sizes) as (
  values
    (
      'gildan-short-sleeve-adult-custom',
      array['Safety Pink','Daisy','Lime','Purple','Heather Military Green','Heather Purple','Irish Green','Navy Heather','Tangerine','Sand','Light Pink','Sage','Dusty Rose','Violet','Light Blue']::text[],
      array[]::text[]
    ),
    (
      'gildan-long-sleeve-adult-custom',
      array['Red','Royal','Irish Green']::text[],
      array[]::text[]
    ),
    (
      'gildan-short-sleeve-toddler-custom',
      array['Royal','Daisy','Sport Grey','Light Pink']::text[],
      array[]::text[]
    ),
    (
      'gildan-short-sleeve-youth-custom',
      array['Red','Irish Green','Safety Pink','Purple','Maroon','Daisy','Sage','Light Blue','Tangerine','Sand','Light Pink']::text[],
      array['XS']::text[]
    ),
    (
      'gildan-adult-crewneck-sweatshirt-custom',
      array[]::text[],
      array[]::text[]
    ),
    (
      'gildan-adult-fleece-hoodie-custom',
      array[]::text[],
      array[]::text[]
    )
),
updated as (
  update public.products p
  set
    colors = coalesce(p.colors, array[]::text[]) || array(
      select c
      from unnest(a.add_colors) as c
      where not (lower(c) = any(array(select lower(existing) from unnest(coalesce(p.colors, array[]::text[])) as existing)))
    ),
    sizes = coalesce(p.sizes, array[]::text[]) || array(
      select s
      from unnest(a.add_sizes) as s
      where not (lower(s) = any(array(select lower(existing) from unnest(coalesce(p.sizes, array[]::text[])) as existing)))
    ),
    updated_at = now()
  from additions a
  where p.slug = a.slug
  returning p.id, p.slug, p.price, p.colors, p.sizes, p.customization
),
missing_matrix as (
  select
    u.id,
    u.slug,
    u.price,
    color,
    size,
    coalesce((u.customization->'sizeSurcharges'->>size)::numeric, 0) as surcharge
  from updated u
  cross join lateral unnest(u.colors) as color
  cross join lateral unnest(u.sizes) as size
  where not exists (
    select 1
    from public.product_variants pv
    where pv.product_id = u.id
      and lower(coalesce(pv.color, '')) = lower(color)
      and lower(coalesce(pv.size, '')) = lower(size)
  )
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
from missing_matrix m
on conflict (sku) do nothing;
