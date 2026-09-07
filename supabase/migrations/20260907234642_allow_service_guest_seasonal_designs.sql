create or replace function private.validate_seasonal_design()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  a public.artwork_library;
  s jsonb;
  area jsonb;
  w numeric;
  h numeric;
  x numeric;
  y numeric;
  text_space numeric;
  caller_role text := coalesce(auth.jwt()->>'role', '');
begin
  if TG_OP = 'UPDATE' and old.seasonal_artwork_id is not null then
    if new.seasonal_artwork_id is distinct from old.seasonal_artwork_id
      or new.seasonal_configuration is distinct from old.seasonal_configuration
      or new.product_id is distinct from old.product_id
      or new.size is distinct from old.size
      or new.color is distinct from old.color
      or new.placement is distinct from old.placement
      or new.additional_garments is distinct from old.additional_garments then
      raise exception 'Create a new seasonal design to change its saved configuration.';
    end if;
    new.proof_required := true;
    return new;
  end if;

  if new.seasonal_artwork_id is null then
    if new.seasonal_configuration is not null then
      raise exception 'Seasonal artwork is missing.';
    end if;
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    raise exception 'Create a new seasonal design instead of converting an existing design.';
  end if;

  if caller_role <> 'service_role'
    and (auth.uid() is null or new.user_id is distinct from auth.uid()) then
    raise exception 'Sign in to save a seasonal design.';
  end if;

  s := new.seasonal_configuration;
  if new.user_id is null
    and (s->>'client_request_id') is not null
    and (s->>'client_request_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'The guest design request is invalid. Refresh and try again.';
  end if;

  if new.user_id is null
    and (s->>'client_request_id') is null then
    raise exception 'Guest seasonal designs must use secure checkout.';
  end if;

  select * into a
  from public.artwork_library
  where id = new.seasonal_artwork_id
    and studio_visible
    and status = 'active'
    and rights_status = 'confirmed'
    and (proof_approved or digital_approved);

  if not found then
    raise exception 'This artwork is no longer available. Choose another design.';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'artwork-production' and name = a.production_path
  ) then
    raise exception 'The production file is unavailable.';
  end if;

  if s->>'source_sha256' is distinct from a.source_sha256 then
    raise exception 'This artwork has changed. Select it again.';
  end if;

  area := private.seasonal_print_area(new.product_id, new.size);
  w := (s->>'width')::numeric;
  h := (s->>'height')::numeric;
  x := (s->>'x')::numeric;
  y := (s->>'y')::numeric;
  text_space := case
    when coalesce(s->>'name', '') <> '' or coalesce(s->>'message', '') <> '' then 0.8
    else 0
  end;

  if w is null or h is null or x is null or y is null
    or w <= 0 or h <= 0 or x < 0 or y < 0
    or w > a.max_width_in or h > a.max_height_in
    or x + w > (area->>'width')::numeric + 0.001
    or y + h > (area->>'height')::numeric - text_space + 0.001
    or abs(w / h - a.aspect_ratio) > 0.001
    or w::text in ('NaN', 'Infinity', '-Infinity')
    or h::text in ('NaN', 'Infinity', '-Infinity')
    or x::text in ('NaN', 'Infinity', '-Infinity')
    or y::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Artwork must fit inside the garment print area without exceeding source resolution.';
  end if;

  if not a.customizable and text_space > 0 then
    raise exception 'Personalization is disabled for this artwork.';
  end if;
  if not a.ready_print and not a.customizable then
    raise exception 'Artwork is unavailable for printing.';
  end if;
  if a.metadata->>'customization_mode' = 'name-or-monogram-frame'
    and coalesce(trim(s->>'name'), '') = '' then
    raise exception 'Add a name for this personalization frame.';
  end if;
  if length(coalesce(s->>'name', '')) > 32 or length(coalesce(s->>'message', '')) > 60 then
    raise exception 'Personalization is too long.';
  end if;
  if not new.approval_policy_acknowledged then
    raise exception 'Approve the design details before continuing.';
  end if;
  if new.placement <> 'front' or jsonb_array_length(coalesce(new.additional_garments, '[]')) > 0 then
    raise exception 'Seasonal designs use one garment size and front placement per cart line.';
  end if;

  new.proof_required := true;
  new.design_style := 'Seasonal: ' || a.title;
  new.occasion := a.category;
  new.seasonal_configuration := jsonb_build_object(
    'version', 1,
    'artwork_id', a.id,
    'title', a.title,
    'category', a.category,
    'source_sha256', a.source_sha256,
    'production_path', a.production_path,
    'ink_bbox_px', a.ink_bbox_px,
    'placement', 'front',
    'width', w,
    'height', h,
    'x', x,
    'y', y,
    'area_width', area->'width',
    'area_height', area->'height',
    'name', coalesce(s->>'name', ''),
    'message', coalesce(s->>'message', ''),
    'text_font', 'Arial',
    'name_placement', case
      when a.metadata->>'customization_mode' = 'name-or-monogram-frame' then 'frame-centre'
      else 'below-artwork'
    end,
    'text_color', case when s->>'text_color' = '#ffffff' then '#ffffff' else '#111111' end,
    'preview', a.preview_data_url,
    'client_request_id', s->>'client_request_id'
  );
  return new;
end
$function$;

comment on function private.validate_seasonal_design() is
  'Validates immutable seasonal designs. Allows account inserts and service-role guest checkout inserts with a client request id.';
