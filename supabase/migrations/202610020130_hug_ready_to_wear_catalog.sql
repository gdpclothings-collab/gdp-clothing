-- Sometimes All We Need Is a Hug — GDP Ready-to-Wear catalog
-- Data-only migration. Uses the existing products/product_variants/admin editor contract.
-- Adult garments use S-5XL. Youth/toddler keep age-appropriate sizing.

begin;

do $$
declare
  garment record;
  c text;
  s text;
  product_uuid uuid;
  colors text[] := array['Black','Navy','Dark Heather','Forest Green','Maroon'];
begin
  for garment in
    select * from (values
      ('adult-short-sleeve-tee','Adult Short Sleeve Tee',array['S','M','L','XL','2XL','3XL','4XL','5XL']::text[],24.99::numeric),
      ('toddler-short-sleeve-tee','Toddler Short Sleeve Tee',array['2T','3T','4T','5T']::text[],19.99::numeric),
      ('adult-long-sleeve-tee','Adult Long Sleeve Tee',array['S','M','L','XL','2XL','3XL','4XL','5XL']::text[],29.99::numeric),
      ('adult-pullover-hoodie','Adult Pullover Hoodie',array['S','M','L','XL','2XL','3XL','4XL','5XL']::text[],44.99::numeric),
      ('youth-short-sleeve-tee','Youth Short Sleeve Tee',array['YS','YM','YL','YXL']::text[],21.99::numeric),
      ('gildan-crewneck-adult-sweatshirt','Gildan® Crewneck Adult Sweatshirt',array['S','M','L','XL','2XL','3XL','4XL','5XL']::text[],39.99::numeric)
    ) as g(garment_key, garment_name, garment_sizes, base_price)
  loop
    insert into public.products (
      name, slug, description, type, category, vendor, price,
      colors, sizes, tags, status, custom_designable, selling_mode,
      track_inventory, requires_shipping, taxable, customization
    ) values (
      'Sometimes All We Need Is a Hug — ' || garment.garment_name,
      'sometimes-all-we-need-is-a-hug-' || garment.garment_key,
      'GDP Ready-to-Wear message design. Choose an available dark garment colour and size.',
      garment.garment_name,
      'GDP Ready-to-Wear',
      'GDP Clothing',
      garment.base_price,
      colors,
      garment.garment_sizes,
      array['ready-to-wear','sometimes-all-we-need-is-a-hug','message-design'],
      'draft',
      false,
      'ready_to_wear',
      true,
      true,
      true,
      jsonb_build_object(
        'design_title','Sometimes All We Need Is a Hug',
        'garment_key',garment.garment_key,
        'artwork_for_dark_garment','white_ink',
        'admin_editable',true
      )
    )
    on conflict (slug) do update set
      name = excluded.name,
      description = excluded.description,
      type = excluded.type,
      category = excluded.category,
      colors = excluded.colors,
      sizes = excluded.sizes,
      tags = excluded.tags,
      custom_designable = false,
      selling_mode = 'ready_to_wear',
      customization = coalesce(public.products.customization,'{}'::jsonb) || excluded.customization,
      updated_at = now()
    returning id into product_uuid;

    foreach c in array colors loop
      foreach s in array garment.garment_sizes loop
        insert into public.product_variants (product_id,name,sku,stock,price,color,size,active)
        values (
          product_uuid,
          garment.garment_name || ' / ' || c || ' / ' || s,
          'HUG-' || upper(regexp_replace(garment.garment_key,'[^a-z0-9]+','','g')) || '-' || upper(regexp_replace(c,'[^a-z0-9]+','','g')) || '-' || upper(s),
          0,
          garment.base_price,
          c,
          s,
          true
        )
        on conflict (sku) do update set
          product_id = excluded.product_id,
          name = excluded.name,
          price = excluded.price,
          color = excluded.color,
          size = excluded.size,
          active = true,
          updated_at = now();
      end loop;
    end loop;
  end loop;
end
$$;

commit;
