-- Map existing blank-garment product media to the matching Custom Studio color preview.
-- Existing manual color-specific mappings win, so admin overrides are preserved.

with mapping(slug, color, image_index) as (
  values
    ('gildan-short-sleeve-adult-custom', 'Sport Grey', 2),
    ('gildan-short-sleeve-adult-custom', 'Black', 3),
    ('gildan-short-sleeve-adult-custom', 'Navy', 4),
    ('gildan-short-sleeve-adult-custom', 'White', 5),

    ('gildan-short-sleeve-toddler-custom', 'Black', 1),
    ('gildan-short-sleeve-toddler-custom', 'Pink', 2),
    ('gildan-short-sleeve-toddler-custom', 'Red', 3),
    ('gildan-short-sleeve-toddler-custom', 'White', 5),

    ('gildan-short-sleeve-youth-custom', 'Royal', 1),
    ('gildan-short-sleeve-youth-custom', 'Navy', 2),
    ('gildan-short-sleeve-youth-custom', 'Black', 3),
    ('gildan-short-sleeve-youth-custom', 'Sport Grey', 4),
    ('gildan-short-sleeve-youth-custom', 'White', 5),

    ('gildan-adult-fleece-hoodie-custom', 'Black', 1),
    ('gildan-adult-fleece-hoodie-custom', 'Navy', 3),
    ('gildan-adult-fleece-hoodie-custom', 'Sport Grey', 4),
    ('gildan-adult-fleece-hoodie-custom', 'White', 5)
),
mapped as (
  select
    p.id,
    jsonb_object_agg(
      m.color,
      jsonb_build_object('frontUrl', p.images[m.image_index])
    ) filter (
      where p.images is not null
        and array_length(p.images, 1) >= m.image_index
        and p.images[m.image_index] is not null
    ) as color_mockups
  from public.products p
  join mapping m on m.slug = p.slug
  group by p.id
)
update public.products p
set customization = jsonb_set(
  coalesce(p.customization, '{}'::jsonb),
  '{preview,colorMockups}',
  coalesce(mapped.color_mockups, '{}'::jsonb)
    || coalesce(p.customization #> '{preview,colorMockups}', '{}'::jsonb),
  true
),
updated_at = now()
from mapped
where p.id = mapped.id
  and mapped.color_mockups is not null;
