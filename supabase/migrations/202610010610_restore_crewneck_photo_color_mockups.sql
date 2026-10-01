-- Restore the Gildan adult crewneck to the real 300-DPI photographic mockups.
--
-- The same-canvas SVG preview introduced on 2026-09-30 relies on URL fragments
-- (#black, #white, etc.) to recolor one SVG. Mobile Safari can keep/reuse the
-- same decoded SVG resource across fragment-only URL changes, so the selected
-- color label changes while the garment image does not. It also makes the
-- product look illustrated instead of photographic.
--
-- Scope is intentionally limited to Custom Studio preview metadata for this
-- one garment. Pricing, variants, sizes, print guides, inventory, checkout,
-- product images, and every other garment remain unchanged.

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
        to_jsonb('https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-gray-front-300dpi.jpg'::text),
        true
      ),
      '{preview,colorMockups}',
      jsonb_build_object(
        'Black', jsonb_build_object(
          'frontUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-black-front-300dpi.jpg',
          'backUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-black-back-300dpi.jpg'
        ),
        'White', jsonb_build_object(
          'frontUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-white-front-300dpi.jpg',
          'backUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-white-back-300dpi.jpg'
        ),
        'Gray', jsonb_build_object(
          'frontUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-gray-front-300dpi.jpg',
          'backUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-gray-back-300dpi.jpg'
        ),
        'Navy', jsonb_build_object(
          'frontUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-navy-front-300dpi.jpg',
          'backUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-navy-back-300dpi.jpg'
        ),
        'Red', jsonb_build_object(
          'frontUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-red-front-300dpi.jpg',
          'backUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-red-back-300dpi.jpg'
        ),
        'Royal', jsonb_build_object(
          'frontUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-royal-front-300dpi.jpg',
          'backUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-royal-back-300dpi.jpg'
        ),
        'Irish Green', jsonb_build_object(
          'frontUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-irish-green-front-300dpi.jpg',
          'backUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-irish-green-back-300dpi.jpg'
        )
      ),
      true
    ),
    updated_at = now()
where slug = 'gildan-adult-crewneck-sweatshirt-custom';
