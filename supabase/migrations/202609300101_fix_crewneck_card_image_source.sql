-- Ensure the Custom Studio garment gallery uses the crewneck mockup.
-- CustomStudioV2 currently renders product.images[0] for garment cards.

update public.products
set
  images = array['/images/custom-studio/gildan-crewneck-adult-gray-front-back.svg']::text[],
  customization = jsonb_set(
    coalesce(customization, '{}'::jsonb),
    '{preview,cardImageUrl}',
    to_jsonb('/images/custom-studio/gildan-crewneck-adult-gray-front-back.svg'::text),
    true
  ),
  updated_at = now()
where slug = 'gildan-adult-crewneck-sweatshirt-custom';
