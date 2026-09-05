-- GDP Clothing one-time catalog seed migrated from the former Base44 project.
-- No Base44 runtime dependency is required by this seed.

begin;

insert into public.products (
  name, slug, description, type, category, vendor,
  price, compare_at_price, images, colors, sizes, tags,
  fulfillment_mode, pod_provider, status, featured,
  best_seller, new_arrival, custom_designable, material,
  created_at, updated_at
) values
('Vintage Bootleg Hoodie','vintage-bootleg-hoodie','Heavyweight 400gsm fleece hoodie with a vintage bootleg graphic. Boxy fit, dropped shoulders.','Hoodie',null,'GDP Clothing',64.99,79.99,array['/images/gdp-hero.svg'],array['Black','Charcoal','Sand','Navy'],array['S','M','L','XL','2XL','3XL'],array['bestseller','hoodie','custom'],'in_house',null,'active',true,true,false,true,'400gsm 80/20 cotton/polyester fleece','2026-08-16T14:01:21.322Z','2026-08-16T14:01:21.322Z'),
('Memorial Tribute Tee','memorial-tribute-tee','Premium 240gsm cotton tee designed to honor a loved one. Soft hand, durable print.','T-Shirt',null,'GDP Clothing',34.99,null,array['/images/gdp-tshirt.svg'],array['Black','White','Charcoal'],array['S','M','L','XL','2XL','3XL','4XL','5XL'],array['bestseller','tee','memorial','custom'],'in_house',null,'active',false,true,false,true,'240gsm 100% combed ring-spun cotton','2026-08-16T14:01:21.322Z','2026-08-16T14:01:21.322Z'),
('Retro Crewneck','retro-crewneck','Mid-weight brushed fleece crewneck with retro colorblocking. Perfect layering piece.','Crewneck',null,'GDP Clothing',54.99,64.99,array['/images/gdp-crewneck.svg'],array['Sand','Charcoal','Forest','Navy'],array['S','M','L','XL','2XL','3XL'],array['crewneck','retro'],'in_house',null,'active',false,false,false,true,'350gsm cotton/polyester fleece','2026-08-16T14:01:21.322Z','2026-08-16T14:01:21.322Z'),
('Custom Couples Hoodie Set','custom-couples-hoodie-set','His & hers custom hoodies. Upload a couples photo and we''ll design matching bootleg sets.','Hoodie',null,'GDP Clothing',129.99,null,array['/images/gdp-couples.svg'],array['Black','White','Sand'],array['S','M','L','XL','2XL'],array['couples','custom','set'],'in_house',null,'active',true,false,false,true,null,'2026-08-16T14:01:21.322Z','2026-08-16T14:01:21.322Z'),
('DTF Gang Sheet','dtf-gang-sheet','Custom DTF gang sheet — upload your artwork and receive ready-to-press transfers. Cold peel, hot peel available.','DTF Gang Sheet',null,'GDP Clothing',24.99,null,array['/images/gdp-process.svg'],array['Full Color'],array['11in x 17in','11in x 24in','22in x 24in'],array['dtf','transfer','wholesale'],'in_house',null,'active',false,false,false,true,null,'2026-08-16T14:01:21.322Z','2026-08-16T14:01:21.322Z'),
('Kids Custom Tee','kids-custom-tee','Soft 200gsm cotton tee for the little ones. Custom design with their favorite character or photo.','Kids',null,'GDP Clothing',29.99,null,array['/images/gdp-tshirt.svg'],array['Black','White','Sand','Pink'],array['2T','3T','4T','YS','YM','YL'],array['kids','custom'],'in_house',null,'active',false,false,false,true,null,'2026-08-16T14:01:21.322Z','2026-08-16T14:01:21.322Z'),
('Signature GDP Heavyweight Tee','signature-gdp-heavyweight-tee','Our flagship 260gsm heavyweight tee in GDP black. Structured, boxy, built to last.','T-Shirt',null,'GDP Clothing',39.99,null,array['/images/gdp-tshirt.svg'],array['Black','White','Charcoal','Navy','Sand'],array['S','M','L','XL','2XL','3XL','4XL','5XL'],array['bestseller','tee','signature'],'in_house',null,'active',false,true,false,false,'260gsm 100% carded cotton','2026-08-16T14:01:21.322Z','2026-08-16T14:01:21.322Z'),
('Oversized Knit Sweater','oversized-knit-sweater','Chunky knit oversized sweater for the colder Saskatoon months. Relaxed, premium feel.','Sweater',null,'GDP Clothing',59.99,74.99,array['/images/gdp-crewneck.svg'],array['Charcoal','Sand','Forest'],array['S','M','L','XL','2XL'],array['new','sweater','pod'],'pod','Printful','active',false,false,true,false,null,'2026-08-16T14:01:21.322Z','2026-08-16T14:01:21.322Z')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  type = excluded.type,
  category = excluded.category,
  vendor = excluded.vendor,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  images = excluded.images,
  colors = excluded.colors,
  sizes = excluded.sizes,
  tags = excluded.tags,
  fulfillment_mode = excluded.fulfillment_mode,
  pod_provider = excluded.pod_provider,
  status = excluded.status,
  featured = excluded.featured,
  best_seller = excluded.best_seller,
  new_arrival = excluded.new_arrival,
  custom_designable = excluded.custom_designable,
  material = excluded.material,
  updated_at = excluded.updated_at;

insert into public.discounts (
  code, type, value, applies_to, min_purchase, active,
  usage_count, usage_limit, qty_tier_2, qty_tier_3,
  created_at, updated_at
) values
('GDP10','percentage',10,'all',50,true,0,null,20,25,'2026-08-16T14:01:23.148Z','2026-08-16T14:01:23.148Z'),
('WELCOME15','percentage',15,'all',100,true,0,null,20,25,'2026-08-16T14:01:23.148Z','2026-08-16T14:01:23.148Z'),
('FREESHIP','free_shipping',0,'all',75,true,0,null,20,25,'2026-08-16T14:01:23.148Z','2026-08-16T14:01:23.148Z')
on conflict (code) do update set
  type = excluded.type,
  value = excluded.value,
  applies_to = excluded.applies_to,
  min_purchase = excluded.min_purchase,
  active = excluded.active,
  usage_limit = excluded.usage_limit,
  qty_tier_2 = excluded.qty_tier_2,
  qty_tier_3 = excluded.qty_tier_3,
  updated_at = excluded.updated_at;

update public.store_settings
set
  store_name = 'GDP Clothing',
  slogan = 'Design Your Dream, Wear Your Vision!',
  currency = 'CAD',
  timezone = 'America/Regina',
  contact_email = 'hello@gdpclothing.ca',
  phone = '(306) 555-GDP1',
  address = 'Saskatoon, SK, Canada',
  facebook = 'https://www.facebook.com/gdpclothing',
  instagram = 'https://www.instagram.com/gdpclothing',
  footer_text = '© GDP Clothing. Saskatoon Steel.',
  updated_at = now()
where id = 1;

commit;
