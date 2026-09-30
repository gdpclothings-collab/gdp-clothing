-- The Gildan Adult Crewneck was added after the recommended apparel print-guide
-- migration, so it did not inherit the canonical crewneck front/back printGuide.
-- Keep the runtime seasonal validator strict and backfill only this stable product.

update public.products
set customization =
  coalesce(customization, '{}'::jsonb)
  || jsonb_build_object(
    'preview',
    coalesce(customization->'preview', '{}'::jsonb)
    || jsonb_build_object(
      'printGuide',
      jsonb_build_object(
        'front', '{"collarIn":2.75,"widthIn":11.25,"heightIn":14,"maxWidthIn":11.25,"maxHeightIn":14,"sizeScalingEnabled":true,"sizeOverrides":{"S":{"widthIn":10.5,"heightIn":13},"M":{"widthIn":11,"heightIn":13.5},"L":{"widthIn":11.25,"heightIn":14},"XL":{"widthIn":11.25,"heightIn":14},"2XL":{"widthIn":11.25,"heightIn":14},"3XL":{"widthIn":11.25,"heightIn":14},"4XL":{"widthIn":11.25,"heightIn":14},"5XL":{"widthIn":11.25,"heightIn":14}}}'::jsonb,
        'back', '{"collarIn":4,"widthIn":12,"heightIn":14,"maxWidthIn":12,"maxHeightIn":14,"sizeScalingEnabled":true,"sizeOverrides":{"S":{"widthIn":11,"heightIn":13},"M":{"widthIn":11.5,"heightIn":13.5},"L":{"widthIn":12,"heightIn":14},"XL":{"widthIn":12,"heightIn":14},"2XL":{"widthIn":12,"heightIn":14},"3XL":{"widthIn":12,"heightIn":14},"4XL":{"widthIn":12,"heightIn":14},"5XL":{"widthIn":12,"heightIn":14}}}'::jsonb
      )
    )
  ),
  updated_at = now()
where slug = 'gildan-adult-crewneck-sweatshirt-custom'
  and custom_designable = true;
