-- Keep the Gildan adult crewneck photographic product images, but use dedicated
-- transparent, same-canvas UI mockups inside Custom Studio.
--
-- Why: the 300-DPI JPEG sources have different internal whitespace/crops and a
-- baked white background. Using them directly in the interactive garment card
-- and color preview makes the sweatshirt visibly jump in size between colors
-- and shows a white rectangle on the selection card.
--
-- Scope is intentionally limited to preview metadata for this one garment.
-- Pricing, variants, sizes, product images, inventory, checkout, and all other
-- garments remain unchanged.

update public.products
set customization = jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(customization, '{}'::jsonb),
          '{preview}',
          coalesce(customization->'preview', '{}'::jsonb),
          true
        ),
        '{preview,cardImageUrl}',
        to_jsonb('/images/custom-studio/gildan-crewneck-front-colors.svg'::text),
        true
      ),
      '{preview,colorMockups}',
      jsonb_build_object(
        'Black', jsonb_build_object(
          'frontUrl', '/images/custom-studio/gildan-crewneck-front-colors.svg#black',
          'backUrl', '/images/custom-studio/gildan-crewneck-back-colors.svg#black'
        ),
        'White', jsonb_build_object(
          'frontUrl', '/images/custom-studio/gildan-crewneck-front-colors.svg#white',
          'backUrl', '/images/custom-studio/gildan-crewneck-back-colors.svg#white'
        ),
        'Gray', jsonb_build_object(
          'frontUrl', '/images/custom-studio/gildan-crewneck-front-colors.svg',
          'backUrl', '/images/custom-studio/gildan-crewneck-back-colors.svg'
        ),
        'Navy', jsonb_build_object(
          'frontUrl', '/images/custom-studio/gildan-crewneck-front-colors.svg#navy',
          'backUrl', '/images/custom-studio/gildan-crewneck-back-colors.svg#navy'
        ),
        'Red', jsonb_build_object(
          'frontUrl', '/images/custom-studio/gildan-crewneck-front-colors.svg#red',
          'backUrl', '/images/custom-studio/gildan-crewneck-back-colors.svg#red'
        ),
        'Royal', jsonb_build_object(
          'frontUrl', '/images/custom-studio/gildan-crewneck-front-colors.svg#royal',
          'backUrl', '/images/custom-studio/gildan-crewneck-back-colors.svg#royal'
        ),
        'Irish Green', jsonb_build_object(
          'frontUrl', '/images/custom-studio/gildan-crewneck-front-colors.svg#irish-green',
          'backUrl', '/images/custom-studio/gildan-crewneck-back-colors.svg#irish-green'
        )
      ),
      true
    ),
    updated_at = now()
where slug = 'gildan-adult-crewneck-sweatshirt-custom';
