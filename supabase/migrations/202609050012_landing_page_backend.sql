begin;

alter table public.store_settings
  add column if not exists homepage jsonb not null default '{}'::jsonb;

update public.store_settings
set homepage = jsonb_build_object(
  'hero', jsonb_build_object(
    'imageUrl', '/images/gdp-hero-approved.webp',
    'brandLine', 'GDP CLOTHING',
    'headline', 'MORE THAN CLOTHING',
    'subheadline', 'IT''S A LIFESTYLE',
    'sideCopy', 'WEAR YOUR STORY',
    'ctaLabel', 'SHOP NOW',
    'ctaUrl', '/shop'
  ),
  'trustBar', jsonb_build_array(
    jsonb_build_object('title','Fast & reliable shipping','text','Across Canada','icon','truck'),
    jsonb_build_object('title','Premium quality','text','Built to last','icon','shield'),
    jsonb_build_object('title','Custom designs','text','Bring your ideas to life','icon','shirt'),
    jsonb_build_object('title','Support local','text','Small business. Big dreams.','icon','heart')
  ),
  'categories', jsonb_build_array(
    jsonb_build_object('title','Tees','subtitle','Everyday Essentials','imageUrl','/images/gdp-sold-family.webp','url','/shop?category=T-Shirt'),
    jsonb_build_object('title','Hoodies','subtitle','Stay Warm, Stay Real','imageUrl','/images/gdp-hero-approved.webp','url','/shop?category=Hoodie'),
    jsonb_build_object('title','Custom Tees','subtitle','Your Design, Our Print','imageUrl','/images/gdp-process.svg','url','/custom-studio'),
    jsonb_build_object('title','Collections','subtitle','Explore All','imageUrl','/images/gdp-sold-categories.webp','url','/shop')
  ),
  'bestSellers', jsonb_build_object(
    'title','Best Sellers',
    'subtitle','Fan favorites. Real style. Everyday wear.',
    'ctaLabel','View All Products',
    'ctaUrl','/shop',
    'limit',5
  ),
  'promos', jsonb_build_array(
    jsonb_build_object('title','Custom Tees','subtitle','Turn your ideas into reality.','buttonLabel','Start Your Design','imageUrl','/images/gdp-process.svg','url','/custom-studio'),
    jsonb_build_object('title','Our Story','subtitle','Built by the culture, for the culture.','buttonLabel','Learn More','imageUrl','/images/gdp-sold-family.webp','url','/pages/about'),
    jsonb_build_object('title','Quality. Bigger Moves.','subtitle','It''s in the details.','buttonLabel','Shop Now','imageUrl','/images/gdp-sold-categories.webp','url','/shop')
  )
)
where id = 1
  and (homepage is null or homepage = '{}'::jsonb);

commit;
