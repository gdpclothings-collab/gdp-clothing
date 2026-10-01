-- GDP Clothing garment sourcing policy and Michaels fallback catalog.
-- Primary wholesale pricing remains authoritative; local retail is reference/fallback only.

update public.store_settings
set apparel_pricing = jsonb_set(
  coalesce(apparel_pricing, '{}'::jsonb),
  '{sourcing}',
  $$
  {
    "strategy": "wholesale_primary_local_fallback",
    "primarySupplierName": "T-Shirt Ideal",
    "fallbackSupplierName": "Michaels",
    "useFallbackRetailAsBasePrice": false,
    "automaticPriceAdjustment": false,
    "localSourcingFee": 0,
    "garments": {
      "adultTshirt": {
        "label": "Gildan® Short Sleeve Adult T-Shirt",
        "productSlug": "gildan-short-sleeve-adult-custom",
        "wholesaleCost": null,
        "fallbackBrand": "Gildan",
        "fallbackItemNumber": "10532473",
        "fallbackRegularCost": 6.99,
        "fallbackCurrentCost": 4.99,
        "observedAt": "2026-10-01",
        "supportedSizes": ["S","M","L","XL","2XL","3XL"],
        "supportedColors": ["Safety Pink","Royal Blue","Sport Gray","White","Red","Daisy","Lime","Purple","Black","Navy","Heather Military Green","Heather Purple","Irish Green","Navy Heather","Tangerine","Sand","Light Pink","Sage","Dusty Rose","Violet","Light Blue"],
        "details": ["Classic adult short-sleeve tee available in multiple colours and sizes.","Most solid colours are 100% cotton.","Sport Gray and selected heathers use cotton/polyester blends.","Selected safety colours and heathers use a 50/50 cotton/polyester blend.","Tear-away tag on the referenced Michaels Gildan blank."]
      },
      "longSleeve": {
        "label": "Gildan® Long Sleeve Crew Neck Adult T-Shirt",
        "productSlug": "gildan-long-sleeve-adult-custom",
        "wholesaleCost": null,
        "fallbackBrand": "Gildan",
        "fallbackItemNumber": "10643769",
        "fallbackRegularCost": 16.99,
        "fallbackCurrentCost": 16.99,
        "observedAt": "2026-10-01",
        "supportedSizes": ["S","M","L","XL","2XL"],
        "supportedColors": ["White","Red","Royal","Black","Sport Grey","Irish Green"],
        "details": ["Adult crew-neck tee with long sleeves and elastic cuffs.","Most solid colours are 100% cotton.","Sport Gray is 90% cotton and 10% polyester on the referenced Michaels blank."]
      },
      "toddlerTshirt": {
        "label": "Gildan® Short Sleeve Toddler T-Shirt",
        "productSlug": "gildan-short-sleeve-toddler-custom",
        "wholesaleCost": null,
        "fallbackBrand": "Gildan",
        "fallbackItemNumber": "10620900",
        "fallbackRegularCost": 6.99,
        "fallbackCurrentCost": 4.99,
        "observedAt": "2026-10-01",
        "supportedSizes": ["2T","3T","4T"],
        "supportedColors": ["White","Red","Royal Blue","Black","Daisy","Sport Gray","Light Pink"],
        "details": ["Toddler short-sleeve tee available in multiple colours and sizes.","Most solid colours are 100% cotton.","Sport Gray is a 90/10 cotton-polyester blend on the referenced Michaels blank."]
      },
      "youthTshirt": {
        "label": "Gildan® Short Sleeve Youth T-Shirt",
        "productSlug": "gildan-short-sleeve-youth-custom",
        "wholesaleCost": null,
        "fallbackBrand": "Gildan",
        "fallbackItemNumber": "10267611",
        "fallbackRegularCost": 6.99,
        "fallbackCurrentCost": 4.99,
        "observedAt": "2026-10-01",
        "supportedSizes": ["XS","S","M","L","XL"],
        "supportedColors": ["Irish Green","White","Safety Pink","Purple","Red","Royal Blue","Black","Maroon","Daisy","Navy","Sport Grey","Sage","Light Blue","Tangerine","Sand","Light Pink"],
        "details": ["Youth short-sleeve tee with a classic fit and ribbed collar.","Most solid colours are 100% cotton.","Sport Gray and safety colours use cotton/polyester blends on the referenced Michaels blank."]
      },
      "crewneck": {
        "label": "Gildan® Crewneck Adult Sweatshirt",
        "productSlug": "gildan-adult-crewneck-sweatshirt-custom",
        "wholesaleCost": null,
        "fallbackBrand": "Gildan",
        "fallbackItemNumber": "10619430",
        "fallbackRegularCost": 24.99,
        "fallbackCurrentCost": 24.99,
        "observedAt": "2026-10-01",
        "supportedSizes": ["S","M","L","XL"],
        "supportedColors": ["Gray","Red","Royal","Irish Green","White","Black","Navy"],
        "details": ["Adult crewneck sweatshirt with a soft 50/50 cotton-polyester fleece blend.","Designed for a softer feel with reduced pilling.","Double-needle cuffs and reinforced stitching on the referenced blank."]
      },
      "hoodie": {
        "label": "Adult Pullover Hoodie",
        "productSlug": "gildan-adult-fleece-hoodie-custom",
        "wholesaleCost": null,
        "fallbackBrand": "Make Market",
        "fallbackItemNumber": "10728168",
        "fallbackRegularCost": 34.99,
        "fallbackCurrentCost": 34.99,
        "observedAt": "2026-10-01",
        "supportedSizes": ["S","M","L","XL"],
        "supportedColors": ["Gray","Blue","Red","Black","White","Light Blue","Pink","Cream"],
        "requiresSubstitutionApproval": true,
        "details": ["Adult unisex pullover hoodie with drawstring hood.","The Michaels fallback is a 60/40 cotton-polyester fleece blank.","Because the local fallback brand is Make Market rather than Gildan, substitution must be confirmed before fulfillment."]
      }
    }
  }
  $$::jsonb,
  true
)
where id = 1;

-- Add Michaels-supported colours to the master garment catalog without removing
-- wholesale-supported colours or extended sizes already offered by GDP.
with source_data(slug, description, add_colors, garment_details, supplier_sourcing) as (
  values
    (
      'gildan-short-sleeve-adult-custom',
      'A comfortable adult short-sleeve Gildan blank built for custom DTF printing. Most solid colours are cotton, while selected sport, safety and heather colours use cotton/polyester blends.',
      array['Safety Pink','Daisy','Lime','Purple','Heather Military Green','Heather Purple','Irish Green','Navy Heather','Tangerine','Sand','Light Pink','Sage','Dusty Rose','Violet','Light Blue']::text[],
      '["Classic adult fit with short sleeves","Most solid colours are 100% cotton","Sport Gray and selected heathers use cotton/polyester blends","Safety colours and selected heathers use a 50/50 cotton-polyester blend","Tear-away tag on the referenced local Gildan blank"]'::jsonb,
      '{"primarySupplier":"T-Shirt Ideal","fallbackSupplier":"Michaels","fallbackBrand":"Gildan","fallbackReferenceItem":"10532473","useFallbackRetailAsBasePrice":false,"observedAt":"2026-10-01","michaelsSizes":["S","M","L","XL","2XL","3XL"],"michaelsColors":["Safety Pink","Royal Blue","Sport Gray","White","Red","Daisy","Lime","Purple","Black","Navy","Heather Military Green","Heather Purple","Irish Green","Navy Heather","Tangerine","Sand","Light Pink","Sage","Dusty Rose","Violet","Light Blue"]}'::jsonb
    ),
    (
      'gildan-long-sleeve-adult-custom',
      'A classic adult Gildan crew-neck long-sleeve blank for custom DTF printing, with elastic cuffs and a comfortable everyday fit.',
      array['Irish Green']::text[],
      '["Adult crew-neck with long sleeves","Elastic cuffs","Most solid colours are 100% cotton","Sport Gray is a 90/10 cotton-polyester blend on the referenced local blank"]'::jsonb,
      '{"primarySupplier":"T-Shirt Ideal","fallbackSupplier":"Michaels","fallbackBrand":"Gildan","fallbackReferenceItem":"10643769","useFallbackRetailAsBasePrice":false,"observedAt":"2026-10-01","michaelsSizes":["S","M","L","XL","2XL"],"michaelsColors":["White","Red","Royal","Black","Sport Grey","Irish Green"]}'::jsonb
    ),
    (
      'gildan-short-sleeve-toddler-custom',
      'A soft toddler Gildan short-sleeve blank sized for personalized family, birthday and event designs. Fiber content varies slightly by colour.',
      array['Royal','Daisy','Light Pink']::text[],
      '["Toddler short-sleeve fit","Most solid colours are 100% cotton","Sport Gray is a 90/10 cotton-polyester blend on the referenced local blank"]'::jsonb,
      '{"primarySupplier":"T-Shirt Ideal","fallbackSupplier":"Michaels","fallbackBrand":"Gildan","fallbackReferenceItem":"10620900","useFallbackRetailAsBasePrice":false,"observedAt":"2026-10-01","michaelsSizes":["2T","3T","4T"],"michaelsColors":["White","Red","Royal Blue","Black","Daisy","Sport Gray","Light Pink"]}'::jsonb
    ),
    (
      'gildan-short-sleeve-youth-custom',
      'A classic-fit youth Gildan short-sleeve blank with a ribbed collar, ready for school, team, birthday and custom DTF designs.',
      array['Irish Green','Safety Pink','Purple','Maroon','Daisy','Sage','Light Blue','Tangerine','Sand','Light Pink']::text[],
      '["Youth sizing with classic fit","Classic-width ribbed collar","Most solid colours are 100% cotton","Sport Gray and safety colours use cotton-polyester blends on the referenced local blank"]'::jsonb,
      '{"primarySupplier":"T-Shirt Ideal","fallbackSupplier":"Michaels","fallbackBrand":"Gildan","fallbackReferenceItem":"10267611","useFallbackRetailAsBasePrice":false,"observedAt":"2026-10-01","michaelsSizes":["XS","S","M","L","XL"],"michaelsColors":["Irish Green","White","Safety Pink","Purple","Red","Royal Blue","Black","Maroon","Daisy","Navy","Sport Grey","Sage","Light Blue","Tangerine","Sand","Light Pink"]}'::jsonb
    ),
    (
      'gildan-adult-crewneck-sweatshirt-custom',
      'A soft adult Gildan crewneck sweatshirt for custom DTF printing, with a 50/50 cotton-polyester fleece blend, reduced pilling and reinforced stitching.',
      array[]::text[],
      '["Adult sizing","50/50 cotton-polyester fleece","Softer feel with reduced pilling","Double-needle cuffs and reinforced stitching"]'::jsonb,
      '{"primarySupplier":"T-Shirt Ideal","fallbackSupplier":"Michaels","fallbackBrand":"Gildan","fallbackReferenceItem":"10619430","useFallbackRetailAsBasePrice":false,"observedAt":"2026-10-01","michaelsSizes":["S","M","L","XL"],"michaelsColors":["Gray","Red","Royal","Irish Green","White","Black","Navy"]}'::jsonb
    ),
    (
      'gildan-adult-fleece-hoodie-custom',
      'A classic adult pullover fleece hoodie blank for custom GDP Clothing designs and DTF printing.',
      array[]::text[],
      '["Adult pullover fleece hoodie","Designed for custom DTF printing","Local fallback substitutions require approval when the blank brand or fabric differs"]'::jsonb,
      '{"primarySupplier":"T-Shirt Ideal","fallbackSupplier":"Michaels","fallbackBrand":"Make Market","fallbackReferenceItem":"10728168","useFallbackRetailAsBasePrice":false,"requiresSubstitutionApproval":true,"observedAt":"2026-10-01","michaelsSizes":["S","M","L","XL"],"michaelsColors":["Gray","Blue","Red","Black","White","Light Blue","Pink","Cream"]}'::jsonb
    )
),
updated as (
  update public.products p
  set
    description = s.description,
    colors = coalesce(p.colors, array[]::text[]) || array(
      select c
      from unnest(s.add_colors) as c
      where not (c = any(coalesce(p.colors, array[]::text[])))
    ),
    customization = coalesce(p.customization, '{}'::jsonb) || jsonb_build_object(
      'garmentDetails', s.garment_details,
      'supplierSourcing', s.supplier_sourcing
    ),
    updated_at = now()
  from source_data s
  where p.slug = s.slug
  returning p.id, p.slug, p.price, p.colors, p.sizes, p.customization
),
missing_matrix as (
  select
    u.id,
    u.slug,
    u.price,
    color,
    size,
    coalesce((u.customization->'sizeSurcharges'->>size)::numeric, 0) as surcharge
  from updated u
  cross join lateral unnest(u.colors) as color
  cross join lateral unnest(u.sizes) as size
  where not exists (
    select 1
    from public.product_variants pv
    where pv.product_id = u.id
      and lower(coalesce(pv.color, '')) = lower(color)
      and lower(coalesce(pv.size, '')) = lower(size)
  )
)
insert into public.product_variants (
  product_id, name, sku, stock, price, color, size, active
)
select
  m.id,
  m.color || ' / ' || m.size,
  'GDP-CS-' || upper(substr(md5(m.slug), 1, 6)) || '-' ||
    regexp_replace(upper(m.color), '[^A-Z0-9]+', '', 'g') || '-' ||
    regexp_replace(upper(m.size), '[^A-Z0-9]+', '', 'g'),
  0,
  case when m.surcharge > 0 then m.price + m.surcharge else null end,
  m.color,
  m.size,
  true
from missing_matrix m
on conflict (sku) do nothing;
