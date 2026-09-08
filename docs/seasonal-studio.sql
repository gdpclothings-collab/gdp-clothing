-- Applied through Supabase migration seasonal_artwork_studio. No draft is auto-published.
alter table public.artwork_library
  add column studio_visible boolean not null default false,
  add column proof_approved boolean not null default false,
  add column aspect_ratio numeric,
  add column max_width_in numeric,
  add column max_height_in numeric,
  add column source_sha256 text,
  add column ink_bbox_px jsonb;
alter table public.artwork_library add constraint seasonal_publication_gate check (
  not studio_visible or (status='active' and rights_status='confirmed' and proof_approved
    and production_path is not null and source_sha256 is not null and source_sha256 ~ '^[a-f0-9]{64}$'
    and preview_data_url is not null
    and preview_data_url like 'data:image/webp;base64,%'
    and aspect_ratio > 0 and max_width_in > 0 and max_height_in > 0
    and aspect_ratio is not null and max_width_in is not null and max_height_in is not null
    and (ready_print or customizable))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('artwork-production','artwork-production',false,104857600,array['image/png'])
on conflict (id) do nothing;
create policy artwork_production_admin_read on storage.objects for select to authenticated
using (bucket_id='artwork-production' and (select public.is_admin()));
create policy artwork_production_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='artwork-production' and (select public.is_admin()));

-- The public RPC returns only display fields, never production paths or private metadata.
create function private.seasonal_print_area(p_product uuid,p_size text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.products; kind text; w numeric; h numeric; guide jsonb; sized jsonb;
begin
 select * into p from public.products where id=p_product;
 if not found or p.status <> 'active' or not p.custom_designable then raise exception 'This garment is unavailable.'; end if;
 kind:=lower(coalesce(p.name,'')||' '||coalesce(p.type,''));
 if kind ~ '(baby|bodysuit|onesie)' then w:=4; h:=5;
 elsif kind like '%toddler%' then w:=6; h:=7;
 elsif kind ~ '(youth|kids)' then w:=7; h:=9;
 elsif kind like '%hoodie%' then w:=9; h:=10;
 else w:=10; h:=11; end if;
 guide:=coalesce(p.customization#>'{preview,printGuide,front}','{}');
 sized:=case when guide->>'sizeScalingEnabled'='false' then '{}'::jsonb else coalesce(guide->'sizeOverrides'->p_size,'{}') end;
 -- The smaller of the conservative garment limit and configured production guide.
 w:=least(w,coalesce(nullif(sized->>'widthIn','')::numeric,nullif(guide->>'widthIn','')::numeric,w),coalesce(nullif(guide->>'maxWidthIn','')::numeric,w));
 h:=least(h,coalesce(nullif(sized->>'heightIn','')::numeric,nullif(guide->>'heightIn','')::numeric,h),coalesce(nullif(guide->>'maxHeightIn','')::numeric,h));
 if w<=0 or h<=1 then raise exception 'Garment print area needs review.'; end if;
 return jsonb_build_object('width',w,'height',h);
end $$;
revoke all on function private.seasonal_print_area(uuid,text) from public;

create function private.list_seasonal_artworks(p_product uuid,p_size text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('area',private.seasonal_print_area(p_product,p_size),'artworks',coalesce((
 select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'category',a.category,'tags',a.tags,
  'preview',a.preview_data_url,'customizable',a.customizable,'ready_print',a.ready_print,
  'aspect_ratio',a.aspect_ratio,'max_width_in',a.max_width_in,'max_height_in',a.max_height_in,
  'source_sha256',a.source_sha256,'requires_name',coalesce(a.metadata->>'customization_mode'='name-or-monogram-frame',false)) order by a.category,a.title)
 from public.artwork_library a where a.studio_visible and a.status='active' and a.rights_status='confirmed'
 and a.proof_approved and exists(select 1 from storage.objects o where o.bucket_id='artwork-production' and o.name=a.production_path)
 ),'[]'::jsonb));
$$;
revoke all on function private.list_seasonal_artworks(uuid,text) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.list_seasonal_artworks(uuid,text) to anon,authenticated;
create function public.list_seasonal_artworks(p_product uuid,p_size text) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.list_seasonal_artworks(p_product,p_size); $$;
revoke all on function public.list_seasonal_artworks(uuid,text) from public;
grant execute on function public.list_seasonal_artworks(uuid,text) to anon,authenticated;

alter table public.custom_designs add column seasonal_artwork_id uuid references public.artwork_library(id),
 add column seasonal_configuration jsonb;
create index custom_designs_seasonal_artwork_idx on public.custom_designs(seasonal_artwork_id) where seasonal_artwork_id is not null;

create function private.validate_seasonal_design() returns trigger
language plpgsql security definer set search_path='' as $$
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
 select * into a from public.artwork_library where id=new.seasonal_artwork_id and studio_visible and status='active' and rights_status='confirmed' and proof_approved;
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
end $$;
revoke all on function private.validate_seasonal_design() from public;
create trigger validate_seasonal_design before insert or update on public.custom_designs
for each row execute function private.validate_seasonal_design();

-- Checkout already uses the saved custom-design ID and trusted garment pricing.
-- This guard adds only seasonal validation and an immutable production snapshot.
create function private.seasonal_order_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
declare d public.custom_designs; a public.artwork_library;
begin
 select * into d from public.custom_designs where id=new.custom_design_id;
 if d.seasonal_artwork_id is null then return new; end if;
 select * into a from public.artwork_library where id=d.seasonal_artwork_id;
 if not a.studio_visible or a.status<>'active' or a.rights_status<>'confirmed' or not a.proof_approved
  or a.source_sha256 is distinct from d.seasonal_configuration->>'source_sha256'
  or not exists(select 1 from storage.objects where bucket_id='artwork-production' and name=a.production_path) then
  raise exception 'A seasonal artwork changed or was withdrawn. Remove it from the cart and select another.';
 end if;
 if new.product_id is distinct from d.product_id or new.size is distinct from d.size or new.color is distinct from d.color then
  raise exception 'Seasonal garment selection has changed. Create a new design for this garment.';
 end if;
 new.custom_data:=coalesce(new.custom_data,'{}')||jsonb_build_object('seasonalArtwork',d.seasonal_configuration);
 return new;
end $$;
revoke all on function private.seasonal_order_snapshot() from public;
create trigger seasonal_order_snapshot before insert on public.order_items for each row execute function private.seasonal_order_snapshot();
