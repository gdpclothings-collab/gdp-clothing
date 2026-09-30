-- Attach the generated crewneck front/back mockup to the Custom Studio garment card.
-- Only the garment-selection thumbnail changes. Pricing, variants, inventory,
-- checkout behavior, and color-reactive Studio previews remain unchanged.

update public.products
set customization = jsonb_set(
      jsonb_set(
        coalesce(customization, '{}'::jsonb),
        '{preview}',
        coalesce(customization->'preview', '{}'::jsonb),
        true
      ),
      '{preview,cardImageUrl}',
      to_jsonb('/images/custom-studio/gildan-crewneck-adult-gray-front-back.svg'::text),
      true
    ),
    updated_at = now()
where slug = 'gildan-adult-crewneck-sweatshirt-custom';
