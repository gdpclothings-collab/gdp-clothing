-- GDP Clothing industry-calibrated recommended print guides.
-- Sources used for calibration: Transfer Express standard/max apparel design sizes,
-- Transfer Express infant/toddler/youth recommendations, Ninja Transfers full-back sizing,
-- and STAHLS hoodie placement guidance. Product-specific data remains the runtime source of truth.

with targets as (
  select
    id,
    lower(coalesce(name, '') || ' ' || coalesce(type, '')) as token,
    lower(coalesce(type, '')) as type_token
  from public.products
  where custom_designable = true
), guides as (
  select id,
    case
      when token ~ '(baby|bodysuit|onesie|infant)' then jsonb_build_object(
        'front', '{"collarIn":1.5,"widthIn":4,"heightIn":4,"maxWidthIn":4,"maxHeightIn":4,"sizeScalingEnabled":true,"sizeOverrides":{"0-3M":{"widthIn":4,"heightIn":4},"3-6M":{"widthIn":4,"heightIn":4},"6-12M":{"widthIn":4,"heightIn":4},"12-18M":{"widthIn":4,"heightIn":4},"18-24M":{"widthIn":4,"heightIn":4}}}'::jsonb,
        'back',  '{"collarIn":1.75,"widthIn":4,"heightIn":4,"maxWidthIn":4,"maxHeightIn":4,"sizeScalingEnabled":true,"sizeOverrides":{"0-3M":{"widthIn":4,"heightIn":4},"3-6M":{"widthIn":4,"heightIn":4},"6-12M":{"widthIn":4,"heightIn":4},"12-18M":{"widthIn":4,"heightIn":4},"18-24M":{"widthIn":4,"heightIn":4}}}'::jsonb
      )
      when type_token = 'kids' then jsonb_build_object(
        'front', '{"collarIn":2.25,"widthIn":10.5,"heightIn":10.5,"maxWidthIn":10.5,"maxHeightIn":10.5,"sizeScalingEnabled":true,"sizeOverrides":{"2T":{"widthIn":5.5,"heightIn":5.5},"3T":{"widthIn":5.5,"heightIn":5.5},"4T":{"widthIn":5.5,"heightIn":5.5},"5T":{"widthIn":5.5,"heightIn":5.5},"YS":{"widthIn":8.5,"heightIn":8.5},"YM":{"widthIn":10.5,"heightIn":10.5},"YL":{"widthIn":10.5,"heightIn":10.5},"YXL":{"widthIn":10.5,"heightIn":10.5}}}'::jsonb,
        'back',  '{"collarIn":3,"widthIn":10,"heightIn":12,"maxWidthIn":10,"maxHeightIn":12,"sizeScalingEnabled":true,"sizeOverrides":{"2T":{"widthIn":5.5,"heightIn":5.5},"3T":{"widthIn":5.5,"heightIn":5.5},"4T":{"widthIn":5.5,"heightIn":5.5},"5T":{"widthIn":5.5,"heightIn":5.5},"YS":{"widthIn":8.5,"heightIn":10},"YM":{"widthIn":10,"heightIn":12},"YL":{"widthIn":10,"heightIn":12},"YXL":{"widthIn":10,"heightIn":12}}}'::jsonb
      )
      when token like '%toddler%' then jsonb_build_object(
        'front', '{"collarIn":2,"widthIn":5.5,"heightIn":5.5,"maxWidthIn":5.5,"maxHeightIn":5.5,"sizeScalingEnabled":true,"sizeOverrides":{"2T":{"widthIn":5.5,"heightIn":5.5},"3T":{"widthIn":5.5,"heightIn":5.5},"4T":{"widthIn":5.5,"heightIn":5.5},"5T":{"widthIn":5.5,"heightIn":5.5}}}'::jsonb,
        'back',  '{"collarIn":2.5,"widthIn":5.5,"heightIn":5.5,"maxWidthIn":5.5,"maxHeightIn":5.5,"sizeScalingEnabled":true,"sizeOverrides":{"2T":{"widthIn":5.5,"heightIn":5.5},"3T":{"widthIn":5.5,"heightIn":5.5},"4T":{"widthIn":5.5,"heightIn":5.5},"5T":{"widthIn":5.5,"heightIn":5.5}}}'::jsonb
      )
      when token ~ '(youth|kids)' then jsonb_build_object(
        'front', '{"collarIn":2.5,"widthIn":10.5,"heightIn":10.5,"maxWidthIn":10.5,"maxHeightIn":10.5,"sizeScalingEnabled":true,"sizeOverrides":{"XS":{"widthIn":8,"heightIn":8},"S":{"widthIn":8.5,"heightIn":8.5},"M":{"widthIn":10.5,"heightIn":10.5},"L":{"widthIn":10.5,"heightIn":10.5},"XL":{"widthIn":10.5,"heightIn":10.5},"2XL":{"widthIn":10.5,"heightIn":10.5},"3XL":{"widthIn":10.5,"heightIn":10.5},"YS":{"widthIn":8.5,"heightIn":8.5},"YM":{"widthIn":10.5,"heightIn":10.5},"YL":{"widthIn":10.5,"heightIn":10.5}}}'::jsonb,
        'back',  '{"collarIn":3,"widthIn":10,"heightIn":12,"maxWidthIn":10,"maxHeightIn":12,"sizeScalingEnabled":true,"sizeOverrides":{"XS":{"widthIn":8,"heightIn":9.5},"S":{"widthIn":8.5,"heightIn":10},"M":{"widthIn":10,"heightIn":12},"L":{"widthIn":10,"heightIn":12},"XL":{"widthIn":10,"heightIn":12},"2XL":{"widthIn":10,"heightIn":12},"3XL":{"widthIn":10,"heightIn":12},"YS":{"widthIn":8.5,"heightIn":10},"YM":{"widthIn":10,"heightIn":12},"YL":{"widthIn":10,"heightIn":12}}}'::jsonb
      )
      when token ~ '(hoodie|hooded)' then jsonb_build_object(
        'front', '{"collarIn":3,"widthIn":11,"heightIn":10,"maxWidthIn":11,"maxHeightIn":10,"sizeScalingEnabled":true,"sizeOverrides":{"S":{"widthIn":11,"heightIn":10},"M":{"widthIn":11,"heightIn":10},"L":{"widthIn":11,"heightIn":10},"XL":{"widthIn":11,"heightIn":10},"2XL":{"widthIn":11,"heightIn":10},"3XL":{"widthIn":11,"heightIn":10},"4XL":{"widthIn":11,"heightIn":10},"5XL":{"widthIn":11,"heightIn":10}}}'::jsonb,
        'back',  '{"collarIn":5.5,"widthIn":12,"heightIn":14,"maxWidthIn":12,"maxHeightIn":14,"sizeScalingEnabled":true,"sizeOverrides":{"S":{"widthIn":11,"heightIn":13},"M":{"widthIn":12,"heightIn":14},"L":{"widthIn":12,"heightIn":14},"XL":{"widthIn":12,"heightIn":14},"2XL":{"widthIn":12,"heightIn":14},"3XL":{"widthIn":12,"heightIn":14},"4XL":{"widthIn":12,"heightIn":14},"5XL":{"widthIn":12,"heightIn":14}}}'::jsonb
      )
      when token ~ '(crewneck|crew neck|sweatshirt|sweater)' and token !~ '(t-shirt|t shirt|tee|long sleeve)' then jsonb_build_object(
        'front', '{"collarIn":2.75,"widthIn":11.25,"heightIn":14,"maxWidthIn":11.25,"maxHeightIn":14,"sizeScalingEnabled":true,"sizeOverrides":{"S":{"widthIn":10.5,"heightIn":13},"M":{"widthIn":11,"heightIn":13.5},"L":{"widthIn":11.25,"heightIn":14},"XL":{"widthIn":11.25,"heightIn":14},"2XL":{"widthIn":11.25,"heightIn":14},"3XL":{"widthIn":11.25,"heightIn":14},"4XL":{"widthIn":11.25,"heightIn":14},"5XL":{"widthIn":11.25,"heightIn":14}}}'::jsonb,
        'back',  '{"collarIn":4,"widthIn":12,"heightIn":14,"maxWidthIn":12,"maxHeightIn":14,"sizeScalingEnabled":true,"sizeOverrides":{"S":{"widthIn":11,"heightIn":13},"M":{"widthIn":11.5,"heightIn":13.5},"L":{"widthIn":12,"heightIn":14},"XL":{"widthIn":12,"heightIn":14},"2XL":{"widthIn":12,"heightIn":14},"3XL":{"widthIn":12,"heightIn":14},"4XL":{"widthIn":12,"heightIn":14},"5XL":{"widthIn":12,"heightIn":14}}}'::jsonb
      )
      else jsonb_build_object(
        'front', '{"collarIn":2.75,"widthIn":11.25,"heightIn":14,"maxWidthIn":11.25,"maxHeightIn":14,"sizeScalingEnabled":true,"sizeOverrides":{"XS":{"widthIn":10,"heightIn":12.5},"S":{"widthIn":10.5,"heightIn":13},"M":{"widthIn":11,"heightIn":13.5},"L":{"widthIn":11.25,"heightIn":14},"XL":{"widthIn":11.25,"heightIn":14},"2XL":{"widthIn":11.25,"heightIn":14},"3XL":{"widthIn":11.25,"heightIn":14},"4XL":{"widthIn":11.25,"heightIn":14},"5XL":{"widthIn":11.25,"heightIn":14}}}'::jsonb,
        'back',  '{"collarIn":4,"widthIn":12,"heightIn":14,"maxWidthIn":12,"maxHeightIn":14,"sizeScalingEnabled":true,"sizeOverrides":{"XS":{"widthIn":10.5,"heightIn":12.5},"S":{"widthIn":11,"heightIn":13},"M":{"widthIn":11.5,"heightIn":13.5},"L":{"widthIn":12,"heightIn":14},"XL":{"widthIn":12,"heightIn":14},"2XL":{"widthIn":12,"heightIn":14},"3XL":{"widthIn":12,"heightIn":14},"4XL":{"widthIn":12,"heightIn":14},"5XL":{"widthIn":12,"heightIn":14}}}'::jsonb
      )
    end as guide
  from targets
)
update public.products p
set customization =
  coalesce(p.customization, '{}'::jsonb)
  || jsonb_build_object(
    'preview',
    coalesce(p.customization->'preview', '{}'::jsonb)
    || jsonb_build_object('printGuide', guides.guide)
  ),
  updated_at = now()
from guides
where p.id = guides.id;

create or replace function private.seasonal_print_area(p_product uuid, p_size text, p_side text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  p public.products;
  normalized_side text := case when lower(coalesce(p_side, 'front')) = 'back' then 'back' else 'front' end;
  guide jsonb;
  sized jsonb;
  w numeric;
  h numeric;
  max_w numeric;
  max_h numeric;
begin
  select * into p from public.products where id = p_product;
  if not found or p.status <> 'active' or not p.custom_designable then
    raise exception 'This garment is unavailable.';
  end if;

  guide := coalesce(p.customization #> array['preview','printGuide',normalized_side], '{}'::jsonb);
  sized := case
    when guide->>'sizeScalingEnabled' = 'false' then '{}'::jsonb
    else coalesce(guide->'sizeOverrides'->p_size, '{}'::jsonb)
  end;

  w := coalesce(nullif(sized->>'widthIn','')::numeric, nullif(guide->>'widthIn','')::numeric);
  h := coalesce(nullif(sized->>'heightIn','')::numeric, nullif(guide->>'heightIn','')::numeric);
  max_w := coalesce(nullif(guide->>'maxWidthIn','')::numeric, w);
  max_h := coalesce(nullif(guide->>'maxHeightIn','')::numeric, h);

  if w is null or h is null or w <= 0 or h <= 0 then
    raise exception 'Garment print area needs review.';
  end if;

  return jsonb_build_object('width', least(w, max_w), 'height', least(h, max_h));
end
$function$;

create or replace function private.seasonal_print_area(p_product uuid, p_size text)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  select private.seasonal_print_area(p_product, p_size, 'front');
$function$;

create or replace function private.list_seasonal_artworks(p_product uuid, p_size text, p_side text)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'area', private.seasonal_print_area(p_product, p_size, p_side),
    'artworks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'category', a.category,
        'tags', a.tags,
        'preview', a.preview_data_url,
        'customizable', a.customizable,
        'ready_print', a.ready_print,
        'aspect_ratio', a.aspect_ratio,
        'max_width_in', a.max_width_in,
        'max_height_in', a.max_height_in,
        'source_sha256', a.source_sha256,
        'requires_name', coalesce(a.metadata->>'customization_mode' = 'name-or-monogram-frame', false)
      ) order by a.category, a.title)
      from public.artwork_library a
      where a.studio_visible
        and a.status = 'active'
        and a.rights_status = 'confirmed'
        and (a.proof_approved or a.digital_approved)
        and exists(
          select 1 from storage.objects o
          where o.bucket_id = 'artwork-production' and o.name = a.production_path
        )
    ), '[]'::jsonb)
  );
$function$;

create or replace function private.list_seasonal_artworks(p_product uuid, p_size text)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  select private.list_seasonal_artworks(p_product, p_size, 'front');
$function$;

create or replace function public.list_seasonal_artworks(p_product uuid, p_size text, p_side text)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private.list_seasonal_artworks(p_product, p_size, p_side);
$function$;

create or replace function public.list_seasonal_artworks(p_product uuid, p_size text)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select private.list_seasonal_artworks(p_product, p_size, 'front');
$function$;

grant execute on function public.list_seasonal_artworks(uuid, text, text) to anon, authenticated;
grant execute on function public.list_seasonal_artworks(uuid, text) to anon, authenticated;
