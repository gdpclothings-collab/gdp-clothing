-- Replace the temporary Crewneck vector/color assets with the final photographic
-- 300-DPI front/back mockups stored in the existing product-images bucket.
-- Scope: Gildan adult crewneck only. Pricing, variants, sizes, checkout, inventory,
-- and all other garment records remain unchanged.

update public.products
set images = array[
      'https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-gray-front-300dpi.jpg',
      'https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-gray-back-300dpi.jpg'
    ]::text[],
    customization = jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(customization, '{}'::jsonb),
          '{preview}',
          coalesce(customization->'preview', '{}'::jsonb),
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
      '{preview,cardImageUrl}',
      to_jsonb('https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/custom-studio/crewneck/gildan-crewneck-gray-front-300dpi.jpg'::text),
      true
    ),
    updated_at = now()
where slug = 'gildan-adult-crewneck-sweatshirt-custom';
