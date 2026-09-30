-- Use a direct WebP crewneck mockup for iPhone/Safari compatibility.
-- The previous SVG wrapper embedded WebP data and rendered as a broken-image placeholder in Safari.

update public.products
set
  images = array['/images/custom-studio/gildan-crewneck-adult-gray-front-back.webp']::text[],
  customization = jsonb_set(
    coalesce(customization, '{}'::jsonb),
    '{preview,cardImageUrl}',
    to_jsonb('/images/custom-studio/gildan-crewneck-adult-gray-front-back.webp'::text),
    true
  ),
  updated_at = now()
where slug = 'gildan-adult-crewneck-sweatshirt-custom';
