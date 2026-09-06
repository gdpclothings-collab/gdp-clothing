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
    jsonb_build_object(
      'title','Tees','subtitle','Everyday Essentials',
      'imageUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654170383-8404147c-89f0-4e11-81df-d6f2e6d88757-Signature-GDP-Heavyweight-Tee.png',
      'url','/shop?category=T-Shirt'
    ),
    jsonb_build_object(
      'title','Hoodies','subtitle','Stay Warm, Stay Real',
      'imageUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654034184-2a8649a5-74a3-4ea2-a6a7-ad82954a6ac9-Vintage-Bootleg-Hoodie.png',
      'url','/shop?category=Hoodie'
    ),
    jsonb_build_object(
      'title','Custom Tees','subtitle','Your Design, Our Print',
      'imageUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654153667-c7277015-4e8c-43af-b5a1-5acca1027658-DTF-Gang-Sheet.png',
      'url','/custom-studio'
    ),
    jsonb_build_object(
      'title','Collections','subtitle','Explore All',
      'imageUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654214518-e8f25549-f292-4bd7-80d9-e9a45d00e1b6-Custom-Couples-Hoodie-Set.png',
      'url','/shop?view=collections'
    )
  ),
  'bestSellers', jsonb_build_object(
    'title','Best Sellers',
    'subtitle','Fan favorites. Real style. Everyday wear.',
    'ctaLabel','View All Products',
    'ctaUrl','/shop',
    'limit',5
  ),
  'promos', jsonb_build_array(
    jsonb_build_object(
      'title','Custom Tees','subtitle','Turn your ideas into reality.','buttonLabel','Start Your Design',
      'imageUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654153667-c7277015-4e8c-43af-b5a1-5acca1027658-DTF-Gang-Sheet.png',
      'url','/custom-studio'
    ),
    jsonb_build_object(
      'title','Our Story','subtitle','Built by the culture, for the culture.','buttonLabel','Learn More',
      'imageUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654214518-e8f25549-f292-4bd7-80d9-e9a45d00e1b6-Custom-Couples-Hoodie-Set.png',
      'url','/pages/about'
    ),
    jsonb_build_object(
      'title','Quality. Bigger Moves.','subtitle','It''s in the details.','buttonLabel','Shop Now',
      'imageUrl','https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654189993-3e006a34-65b9-4849-b353-e65e431a6598-Memorial-Tribute-Tee.png',
      'url','/shop'
    )
  )
)
where id = 1
  and (homepage is null or homepage = '{}'::jsonb);

insert into public.content_pages (
  title, slug, page_type, excerpt, body, seo, status, published_at
)
values
  (
    'About GDP Clothing',
    'about',
    'page',
    'Good People. Dope Clothes. Built in Saskatoon.',
    jsonb_build_object(
      'content',
      'GDP Clothing is a Saskatoon-built streetwear and custom apparel brand focused on premium pieces, personal designs, and wearable stories. We create ready-to-wear drops and custom work designed around the people, moments, and ideas that matter.'
    ),
    jsonb_build_object(
      'title','About GDP Clothing',
      'description','Learn about GDP Clothing, a Saskatoon streetwear and custom apparel brand.'
    ),
    'published',
    now()
  ),
  (
    'Contact GDP Clothing',
    'contact',
    'page',
    'Questions, custom requests, and order support.',
    jsonb_build_object(
      'content',
      'Need help with an order or want to start a custom design? Contact GDP Clothing at hello@gdpclothing.ca. We are based in Saskatoon, Saskatchewan, Canada.'
    ),
    jsonb_build_object(
      'title','Contact GDP Clothing',
      'description','Contact GDP Clothing for custom apparel, order support, and general questions.'
    ),
    'published',
    now()
  )
on conflict (slug) do nothing;

insert into public.navigation_menus (name, handle, active)
values ('Main menu', 'main-menu', true)
on conflict (handle) do update
set active = true;

with menu as (
  select id from public.navigation_menus where handle = 'main-menu' limit 1
),
seed_items(label, url, position) as (
  values
    ('Home', '/', 0),
    ('Shop', '/shop', 1),
    ('Collections', '/shop?view=collections', 2),
    ('Custom Tee', '/custom-studio', 3),
    ('About', '/pages/about', 4),
    ('Contact', '/pages/contact', 5)
)
insert into public.navigation_items (
  menu_id, label, link_type, url, position, active
)
select menu.id, seed_items.label, 'url', seed_items.url, seed_items.position, true
from menu
cross join seed_items
where not exists (
  select 1 from public.navigation_items existing where existing.menu_id = menu.id
);

commit;
