-- GDP Clothing calibrated front-print production guides.
-- Stored in products.customization.preview.printGuide.front so Custom Studio and Admin share one source of truth.
-- Existing product-level overrides win over these defaults.

with garment_guides as (
  select
    p.id,
    case
      when lower(coalesce(p.name, '') || ' ' || coalesce(p.type, '')) ~ '(baby|bodysuit|onesie)' then
        jsonb_build_object(
          'collarIn', 1.25,
          'widthIn', 5.5,
          'heightIn', 6.5,
          'maxWidthIn', 6,
          'maxHeightIn', 7,
          'sizeScalingEnabled', true,
          'sizeOverrides', jsonb_build_object(
            '0-3M', jsonb_build_object('widthIn', 4.5, 'heightIn', 5.5),
            '3-6M', jsonb_build_object('widthIn', 5, 'heightIn', 6),
            '6-12M', jsonb_build_object('widthIn', 5.5, 'heightIn', 6.5),
            '12-18M', jsonb_build_object('widthIn', 6, 'heightIn', 7)
          )
        )
      when lower(coalesce(p.name, '') || ' ' || coalesce(p.type, '')) like '%toddler%' then
        jsonb_build_object(
          'collarIn', 1.75,
          'widthIn', 7,
          'heightIn', 8,
          'maxWidthIn', 7.5,
          'maxHeightIn', 9,
          'sizeScalingEnabled', true,
          'sizeOverrides', jsonb_build_object(
            '2T', jsonb_build_object('widthIn', 6, 'heightIn', 7),
            '3T', jsonb_build_object('widthIn', 6.5, 'heightIn', 7.5),
            '4T', jsonb_build_object('widthIn', 7, 'heightIn', 8),
            '5T', jsonb_build_object('widthIn', 7.5, 'heightIn', 8.5)
          )
        )
      when lower(coalesce(p.name, '') || ' ' || coalesce(p.type, '')) ~ '(youth|kids)' then
        jsonb_build_object(
          'collarIn', 2.25,
          'widthIn', 9,
          'heightIn', 11,
          'maxWidthIn', 10,
          'maxHeightIn', 12,
          'sizeScalingEnabled', true,
          'sizeOverrides', jsonb_build_object(
            'XS', jsonb_build_object('widthIn', 7.5, 'heightIn', 9.5),
            'S', jsonb_build_object('widthIn', 8.5, 'heightIn', 10.5),
            'M', jsonb_build_object('widthIn', 9, 'heightIn', 11),
            'L', jsonb_build_object('widthIn', 9.5, 'heightIn', 11.5),
            'XL', jsonb_build_object('widthIn', 10, 'heightIn', 12)
          )
        )
      when lower(coalesce(p.name, '') || ' ' || coalesce(p.type, '')) like '%hoodie%' then
        jsonb_build_object(
          'collarIn', 3.5,
          'widthIn', 11,
          'heightIn', 12.5,
          'maxWidthIn', 12,
          'maxHeightIn', 14,
          'sizeScalingEnabled', true,
          'sizeOverrides', jsonb_build_object(
            'S', jsonb_build_object('widthIn', 10, 'heightIn', 11.5),
            'M', jsonb_build_object('widthIn', 10.5, 'heightIn', 12),
            'L', jsonb_build_object('widthIn', 11, 'heightIn', 12.5),
            'XL', jsonb_build_object('widthIn', 11.5, 'heightIn', 13),
            '2XL', jsonb_build_object('widthIn', 11.5, 'heightIn', 13),
            '3XL', jsonb_build_object('widthIn', 11.5, 'heightIn', 13),
            '4XL', jsonb_build_object('widthIn', 11.5, 'heightIn', 13),
            '5XL', jsonb_build_object('widthIn', 11.5, 'heightIn', 13)
          )
        )
      when lower(coalesce(p.name, '') || ' ' || coalesce(p.type, '')) ~ '(crewneck|crew neck|sweatshirt|sweater)'
        and lower(coalesce(p.name, '') || ' ' || coalesce(p.type, '')) !~ '(t-shirt|t shirt|tee|long sleeve)' then
        jsonb_build_object(
          'collarIn', 2.75,
          'widthIn', 11.5,
          'heightIn', 14,
          'maxWidthIn', 12,
          'maxHeightIn', 15,
          'sizeScalingEnabled', true,
          'sizeOverrides', jsonb_build_object(
            'S', jsonb_build_object('widthIn', 10.5, 'heightIn', 13),
            'M', jsonb_build_object('widthIn', 11, 'heightIn', 13.5),
            'L', jsonb_build_object('widthIn', 11.5, 'heightIn', 14),
            'XL', jsonb_build_object('widthIn', 12, 'heightIn', 15),
            '2XL', jsonb_build_object('widthIn', 12, 'heightIn', 15),
            '3XL', jsonb_build_object('widthIn', 12, 'heightIn', 15)
          )
        )
      else
        jsonb_build_object(
          'collarIn', 2.75,
          'widthIn', 11.5,
          'heightIn', 14.5,
          'maxWidthIn', 12,
          'maxHeightIn', 16,
          'sizeScalingEnabled', true,
          'sizeOverrides', jsonb_build_object(
            'XS', jsonb_build_object('widthIn', 10, 'heightIn', 13),
            'S', jsonb_build_object('widthIn', 10.5, 'heightIn', 13.5),
            'M', jsonb_build_object('widthIn', 11, 'heightIn', 14),
            'L', jsonb_build_object('widthIn', 11.5, 'heightIn', 14.5),
            'XL', jsonb_build_object('widthIn', 12, 'heightIn', 15),
            '2XL', jsonb_build_object('widthIn', 12, 'heightIn', 15),
            '3XL', jsonb_build_object('widthIn', 12, 'heightIn', 15),
            '4XL', jsonb_build_object('widthIn', 12, 'heightIn', 15),
            '5XL', jsonb_build_object('widthIn', 12, 'heightIn', 15)
          )
        )
    end as guide
  from public.products p
  where p.custom_designable = true
    and lower(coalesce(p.name, '') || ' ' || coalesce(p.type, '')) ~
      '(shirt|tee|hoodie|sweatshirt|crewneck|crew neck|sweater|bodysuit|onesie|toddler|youth|kids|baby|long sleeve)'
)
update public.products p
set
  customization =
    coalesce(p.customization, '{}'::jsonb)
    || jsonb_build_object(
      'preview',
      coalesce(p.customization->'preview', '{}'::jsonb)
      || jsonb_build_object(
        'printGuide',
        coalesce(p.customization #> '{preview,printGuide}', '{}'::jsonb)
        || jsonb_build_object(
          'front',
          garment_guides.guide
          || coalesce(p.customization #> '{preview,printGuide,front}', '{}'::jsonb)
        )
      )
    ),
  updated_at = now()
from garment_guides
where p.id = garment_guides.id;
