-- Synthetic fixtures are isolated in one transaction and always rolled back.
-- The storage row is metadata-only for trigger testing; no file is uploaded or published.
begin;
do $$
declare u uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); d uuid; o uuid:=gen_random_uuid(); p uuid;
 s jsonb; saved jsonb; passed integer:=0; testpath text:=gen_random_uuid()||'.png';
begin
 select id into p from public.products where custom_designable and status='active' limit 1;
 insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@example.invalid','{}');
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into storage.objects(bucket_id,name) values('artwork-production',testpath);
 insert into public.artwork_library(id,slug,title,category,status,rights_status,ready_print,customizable,studio_visible,proof_approved,
  production_path,preview_data_url,source_sha256,aspect_ratio,max_width_in,max_height_in,ink_bbox_px)
 values(a,'qa-'||a,'QA rollback only','QA','active','confirmed',true,true,true,true,testpath,'data:image/webp;base64,AAAA',repeat('a',64),1,4,4,'[0,0,1200,1200]');
 if not exists(select 1 from jsonb_array_elements(public.list_seasonal_artworks(p,'M')->'artworks') x where x->>'id'=a::text) then raise exception 'QA catalog fixture missing'; end if; passed:=passed+1;
 s:=jsonb_build_object('source_sha256',repeat('a',64),'width',3,'height',3,'x',0,'y',0,'name','Test','message','','text_color','#ffffff');
 insert into public.custom_designs(user_id,product_id,product_name,size,color,seasonal_artwork_id,seasonal_configuration,approval_policy_acknowledged)
 values(u,p,'QA','M','Black',a,s,true) returning id,seasonal_configuration into d,saved;
 if saved->>'title'<>'QA rollback only' or saved->>'production_path'<>testpath then raise exception 'QA trusted snapshot missing';end if;passed:=passed+1;
 begin
  insert into public.custom_designs(user_id,product_id,product_name,size,color,seasonal_artwork_id,seasonal_configuration,approval_policy_acknowledged)
  values(u,p,'QA','M','Black',a,s||'{"width":100,"height":100}',true);
  raise exception 'QA oversized artwork accepted';
 exception when others then if sqlerrm not like 'Artwork must fit%' then raise;end if;end;passed:=passed+1;
 begin
  insert into public.custom_designs(user_id,product_id,product_name,size,color,seasonal_artwork_id,seasonal_configuration,approval_policy_acknowledged)
  values(u,p,'QA','M','Black',a,s||jsonb_build_object('source_sha256',repeat('b',64)),true);
  raise exception 'QA stale version accepted';
 exception when others then if sqlerrm not like 'This artwork has changed%' then raise;end if;end;passed:=passed+1;
 begin
  update public.custom_designs set seasonal_configuration=saved||'{"width":2}' where id=d;
  raise exception 'QA snapshot mutation accepted';
 exception when others then if sqlerrm not like 'Create a new seasonal design%' then raise;end if;end;passed:=passed+1;
 insert into public.orders(id,order_number,customer_email,total,user_id) values(o,'QA-'||o,'qa@example.invalid',0,u);
 insert into public.order_items(order_id,product_id,custom_design_id,name,size,color,quantity,unit_price,is_custom)
 values(o,p,d,'QA','M','Black',1,0,true);
 if not exists(select 1 from public.order_items where order_id=o and custom_data#>>'{seasonalArtwork,source_sha256}'=repeat('a',64)) then raise exception 'QA order snapshot missing';end if;passed:=passed+1;
 begin
  insert into public.order_items(order_id,product_id,custom_design_id,name,size,color,quantity,unit_price,is_custom)
  values(o,p,d,'QA','S','Black',1,0,true);
  raise exception 'QA changed garment accepted';
 exception when others then if sqlerrm not like 'Seasonal garment selection has changed%' then raise;end if;end;passed:=passed+1;
 update public.artwork_library set studio_visible=false where id=a;
 if exists(select 1 from jsonb_array_elements(public.list_seasonal_artworks(p,'M')->'artworks') x where x->>'id'=a::text) then raise exception 'QA hidden artwork exposed';end if;passed:=passed+1;
 begin
  insert into public.order_items(order_id,product_id,custom_design_id,name,size,color,quantity,unit_price,is_custom)
  values(o,p,d,'QA','M','Black',1,0,true);
  raise exception 'QA withdrawn design accepted';
 exception when others then if sqlerrm not like 'A seasonal artwork changed%' then raise;end if;end;passed:=passed+1;
 -- Existing photo designs and regular items still pass through without seasonal changes.
 insert into public.custom_designs(user_id,product_id,product_name) values(u,p,'QA legacy') returning id into d;
 insert into public.order_items(order_id,product_id,custom_design_id,name,quantity,unit_price) values(o,p,d,'QA legacy',1,0);passed:=passed+1;
 perform set_config('seasonal.qa.result',passed||' database checks passed',true);
end $$;
select current_setting('seasonal.qa.result') as result;
rollback;
