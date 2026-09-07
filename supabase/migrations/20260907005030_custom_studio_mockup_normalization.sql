-- GDP Clothing Custom Studio front/back mockup normalization.
-- Keeps existing per-product overrides while standardizing garment preview geometry.

update public.products p
set
  customization =
    coalesce(p.customization, '{}'::jsonb)
    || jsonb_build_object(
      'preview',
      coalesce(p.customization->'preview', '{}'::jsonb)
      || jsonb_build_object(
        'canvas',
        jsonb_build_object('width', 1000, 'height', 1200)
          || coalesce(p.customization #> '{preview,canvas}', '{}'::jsonb),
        'normalization',
        jsonb_build_object(
          'front',
          jsonb_build_object('scale', 1, 'offsetX', 0, 'offsetY', 0)
            || coalesce(p.customization #> '{preview,normalization,front}', '{}'::jsonb),
          'back',
          jsonb_build_object('scale', 1, 'offsetX', 0, 'offsetY', 0)
            || coalesce(p.customization #> '{preview,normalization,back}', '{}'::jsonb)
        )
        || coalesce(p.customization #> '{preview,normalization}', '{}'::jsonb)
      )
    ),
  updated_at = now()
where p.custom_designable = true
  and lower(coalesce(p.name, '') || ' ' || coalesce(p.type, '')) ~
    '(shirt|tee|hoodie|sweatshirt|crewneck|crew neck|sweater|bodysuit|onesie|toddler|youth|kids|baby|long sleeve)';
