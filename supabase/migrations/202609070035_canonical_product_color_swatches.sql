-- Keep Custom Studio color swatches consistent with each product's configured color options.
-- This replaces stale swatch keys and fills missing codes without touching preview media or print guides.

with mapped as (
  select
    p.id,
    jsonb_object_agg(
      color_name,
      case lower(trim(color_name))
        when 'black' then '#171717'
        when 'vintage black' then '#292929'
        when 'white' then '#f7f6f1'
        when 'sport grey' then '#b7b8b3'
        when 'sport gray' then '#b7b8b3'
        when 'charcoal' then '#4b4c4e'
        when 'dark heather' then '#414347'
        when 'navy' then '#17243b'
        when 'red' then '#b52332'
        when 'royal' then '#2857a6'
        when 'sand' then '#d5c1a0'
        when 'forest' then '#294a39'
        when 'green' then '#294a39'
        when 'forest green' then '#294a39'
        when 'pink' then '#eeb1c8'
        when 'sky blue' then '#9ecae1'
        when 'light blue' then '#9ecae1'
        when 'full color' then '#dadada'
        else '#8b8b8b'
      end
      order by color_name
    ) as swatches
  from public.products p
  cross join lateral unnest(coalesce(p.colors, '{}'::text[])) as color_name
  where p.custom_designable = true
  group by p.id
)
update public.products p
set
  customization = coalesce(p.customization, '{}'::jsonb) ||
    jsonb_build_object(
      'preview',
      coalesce(p.customization->'preview', '{}'::jsonb) ||
        jsonb_build_object('colorSwatches', mapped.swatches)
    ),
  updated_at = now()
from mapped
where p.id = mapped.id;
