-- Add color-aware front/back mockups for the Gildan adult crewneck only.
-- Gray remains on its existing production mockup. Pricing, variants, inventory,
-- checkout behavior, and all other garments are intentionally unchanged.

update public.products
set customization = jsonb_set(
      jsonb_set(
        coalesce(customization, '{}'::jsonb),
        '{preview}',
        coalesce(customization->'preview', '{}'::jsonb),
        true
      ),
      '{preview,colorMockups}',
      coalesce(customization->'preview'->'colorMockups', '{}'::jsonb)
      || jsonb_build_object(
        'Black', jsonb_build_object(
          'frontUrl', '/images/custom-studio/gildan-crewneck-front-colors.svg#black',
          'backUrl', '/images/custom-studio/gildan-crewneck-back-colors.svg#black'
        ),
        'White', jsonb_build_object(
          'frontUrl', '/images/custom-studio/gildan-crewneck-front-colors.svg#white',
          'backUrl', '/images/custom-studio/gildan-crewneck-back-colors.svg#white'
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
