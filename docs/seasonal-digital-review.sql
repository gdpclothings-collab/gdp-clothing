-- Apply after seasonal-studio.sql. Already applied to the GDP production database.
-- Digital review allows catalog publication; customer production proof remains required.
alter table public.artwork_library add column if not exists digital_approved boolean not null default false;
alter table public.artwork_library drop constraint seasonal_publication_gate;
alter table public.artwork_library add constraint seasonal_publication_gate CHECK (((NOT studio_visible) OR ((status = 'active'::text) AND (rights_status = 'confirmed'::text) AND (proof_approved OR digital_approved) AND (production_path IS NOT NULL) AND (source_sha256 IS NOT NULL) AND (source_sha256 ~ '^[a-f0-9]{64}$'::text) AND (preview_data_url IS NOT NULL) AND (preview_data_url ~~ 'data:image/webp;base64,%'::text) AND (aspect_ratio > (0)::numeric) AND (max_width_in > (0)::numeric) AND (max_height_in > (0)::numeric) AND (aspect_ratio IS NOT NULL) AND (max_width_in IS NOT NULL) AND (max_height_in IS NOT NULL) AND (ready_print OR customizable))));
CREATE OR REPLACE FUNCTION private.list_seasonal_artworks(p_product uuid, p_size text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('area',private.seasonal_print_area(p_product,p_size),'artworks',coalesce((
 select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'category',a.category,'tags',a.tags,
  'preview',a.preview_data_url,'customizable',a.customizable,'ready_print',a.ready_print,
  'aspect_ratio',a.aspect_ratio,'max_width_in',a.max_width_in,'max_height_in',a.max_height_in,
  'source_sha256',a.source_sha256,'requires_name',coalesce(a.metadata->>'customization_mode'='name-or-monogram-frame',false)) order by a.category,a.title)
 from public.artwork_library a where a.studio_visible and a.status='active' and a.rights_status='confirmed'
 and (a.proof_approved OR a.digital_approved) and exists(select 1 from storage.objects o where o.bucket_id='artwork-production' and o.name=a.production_path)
 ),'[]'::jsonb));
$function$
;
CREATE OR REPLACE FUNCTION private.validate_seasonal_design()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.artwork_library; s jsonb; area jsonb; w numeric; h numeric; x numeric; y numeric; text_space numeric;
begin
 if TG_OP='UPDATE' and old.seasonal_artwork_id is not null then
  if new.seasonal_artwork_id is distinct from old.seasonal_artwork_id or new.seasonal_configuration is distinct from old.seasonal_configuration
    or new.product_id is distinct from old.product_id or new.size is distinct from old.size or new.color is distinct from old.color
    or new.placement is distinct from old.placement or new.additional_garments is distinct from old.additional_garments then
    raise exception 'Create a new seasonal design to change its saved configuration.';
  end if;
  new.proof_required:=true;
  return new;
 end if;
 if new.seasonal_artwork_id is null then
  if new.seasonal_configuration is not null then raise exception 'Seasonal artwork is missing.'; end if;
  return new;
 end if;
 if TG_OP='UPDATE' then raise exception 'Create a new seasonal design instead of converting an existing design.'; end if;
 if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'Sign in to save a seasonal design.'; end if;
 select * into a from public.artwork_library where id=new.seasonal_artwork_id and studio_visible and status='active' and rights_status='confirmed' and (proof_approved OR digital_approved);
 if not found then raise exception 'This artwork is no longer available. Choose another design.'; end if;
 if not exists(select 1 from storage.objects where bucket_id='artwork-production' and name=a.production_path) then raise exception 'The production file is unavailable.'; end if;
 s:=new.seasonal_configuration;
 if s->>'source_sha256' is distinct from a.source_sha256 then raise exception 'This artwork has changed. Select it again.'; end if;
 area:=private.seasonal_print_area(new.product_id,new.size);
 w:=(s->>'width')::numeric; h:=(s->>'height')::numeric; x:=(s->>'x')::numeric; y:=(s->>'y')::numeric;
 text_space:=case when coalesce(s->>'name','')<>'' or coalesce(s->>'message','')<>'' then 0.8 else 0 end;
 if w is null or h is null or x is null or y is null or w<=0 or h<=0 or x<0 or y<0
  or w>a.max_width_in or h>a.max_height_in or x+w>(area->>'width')::numeric+0.001
  or y+h>(area->>'height')::numeric-text_space+0.001 or abs(w/h-a.aspect_ratio)>0.001
  or w::text in ('NaN','Infinity','-Infinity') or h::text in ('NaN','Infinity','-Infinity')
  or x::text in ('NaN','Infinity','-Infinity') or y::text in ('NaN','Infinity','-Infinity') then
  raise exception 'Artwork must fit inside the garment print area without exceeding source resolution.';
 end if;
 if not a.customizable and text_space>0 then raise exception 'Personalization is disabled for this artwork.'; end if;
 if not a.ready_print and not a.customizable then raise exception 'Artwork is unavailable for printing.'; end if;
 if a.metadata->>'customization_mode'='name-or-monogram-frame' and coalesce(trim(s->>'name'),'')='' then raise exception 'Add a name for this personalization frame.'; end if;
 if length(coalesce(s->>'name',''))>32 or length(coalesce(s->>'message',''))>60 then raise exception 'Personalization is too long.'; end if;
 if not new.approval_policy_acknowledged then raise exception 'Approve the design details before continuing.'; end if;
 if new.placement<>'front' or jsonb_array_length(coalesce(new.additional_garments,'[]'))>0 then raise exception 'Seasonal designs use one garment size and front placement per cart line.'; end if;
 new.proof_required:=true;
 new.design_style:='Seasonal: '||a.title;
 new.occasion:=a.category;
 new.seasonal_configuration:=jsonb_build_object('version',1,'artwork_id',a.id,'title',a.title,'category',a.category,
  'source_sha256',a.source_sha256,'production_path',a.production_path,'ink_bbox_px',a.ink_bbox_px,
  'placement','front','width',w,'height',h,'x',x,'y',y,'area_width',area->'width','area_height',area->'height',
  'name',coalesce(s->>'name',''),'message',coalesce(s->>'message',''),'text_font','Arial',
  'name_placement',case when a.metadata->>'customization_mode'='name-or-monogram-frame' then 'frame-centre' else 'below-artwork' end,
  'text_color',case when s->>'text_color'='#ffffff' then '#ffffff' else '#111111' end,
  'preview',a.preview_data_url);
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION private.seasonal_order_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.custom_designs; a public.artwork_library;
begin
 select * into d from public.custom_designs where id=new.custom_design_id;
 if d.seasonal_artwork_id is null then return new; end if;
 select * into a from public.artwork_library where id=d.seasonal_artwork_id;
 if not a.studio_visible or a.status<>'active' or a.rights_status<>'confirmed' or not (a.proof_approved OR a.digital_approved)
  or a.source_sha256 is distinct from d.seasonal_configuration->>'source_sha256'
  or not exists(select 1 from storage.objects where bucket_id='artwork-production' and name=a.production_path) then
  raise exception 'A seasonal artwork changed or was withdrawn. Remove it from the cart and select another.';
 end if;
 if new.product_id is distinct from d.product_id or new.size is distinct from d.size or new.color is distinct from d.color then
  raise exception 'Seasonal garment selection has changed. Create a new design for this garment.';
 end if;
 new.custom_data:=coalesce(new.custom_data,'{}')||jsonb_build_object('seasonalArtwork',d.seasonal_configuration);
 return new;
end $function$
;
update storage.buckets set allowed_mime_types=array['image/png','image/svg+xml'] where id='artwork-production';
