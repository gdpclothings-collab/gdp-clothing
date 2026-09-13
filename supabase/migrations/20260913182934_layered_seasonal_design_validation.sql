-- Keep the database validator aligned with the layered Seasonal Design Lab.
-- This remains backward-compatible with legacy single-artwork seasonal designs.

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
  layer jsonb;
  normalized_layers jsonb := '[]'::jsonb;
  layer_artwork_id uuid;
  first_artwork_id uuid;
  layer_count integer;
  layer_order integer := 0;
  titles text[] := array[]::text[];
  categories text[] := array[]::text[];
  w numeric;
  h numeric;
  x numeric;
  y numeric;
  rotation numeric;
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
    new.proof_required := old.proof_required;
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

  s := coalesce(new.seasonal_configuration, '{}'::jsonb);

  if new.user_id is null
    and (s->>'client_request_id') is not null
    and (s->>'client_request_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'The guest design request is invalid. Refresh and try again.';
  end if;

  if new.user_id is null and (s->>'client_request_id') is null then
    raise exception 'Guest seasonal designs must use secure checkout.';
  end if;

  area := private.seasonal_print_area(new.product_id, new.size);

  if s->>'version' = '2' and jsonb_typeof(s->'layers') = 'array' then
    layer_count := jsonb_array_length(s->'layers');
    if layer_count < 1 or layer_count > 10 then
      raise exception 'Seasonal designs must contain between 1 and 10 artwork layers.';
    end if;

    for layer in select value from jsonb_array_elements(s->'layers') loop
      layer_order := layer_order + 1;

      if coalesce(layer->>'artwork_id', layer->>'artworkId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'A seasonal artwork layer is invalid.';
      end if;
      layer_artwork_id := coalesce(layer->>'artwork_id', layer->>'artworkId')::uuid;
      if layer_order = 1 then first_artwork_id := layer_artwork_id; end if;

      select * into a
      from public.artwork_library
      where id = layer_artwork_id
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

      if layer->>'source_sha256' is distinct from a.source_sha256 then
        raise exception 'This artwork has changed. Select it again.';
      end if;

      if coalesce(layer->>'width', '') !~ '^-?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
        or coalesce(layer->>'height', '') !~ '^-?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
        or coalesce(layer->>'x', '') !~ '^-?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
        or coalesce(layer->>'y', '') !~ '^-?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
        or (layer ? 'rotation' and coalesce(layer->>'rotation', '') !~ '^-?([0-9]+([.][0-9]*)?|[.][0-9]+)$') then
        raise exception 'A seasonal artwork placement is invalid.';
      end if;

      w := (layer->>'width')::numeric;
      h := (layer->>'height')::numeric;
      x := (layer->>'x')::numeric;
      y := (layer->>'y')::numeric;
      rotation := coalesce((layer->>'rotation')::numeric, 0);

      if a.aspect_ratio is null or a.max_width_in is null or a.max_height_in is null
        or w <= 0 or h <= 0 or x < 0 or y < 0
        or w > a.max_width_in or h > a.max_height_in
        or x + w > (area->>'width')::numeric + 0.001
        or y + h > (area->>'height')::numeric + 0.001
        or abs(w / h - a.aspect_ratio) > 0.001
        or rotation < -180 or rotation > 180 then
        raise exception 'Artwork must fit inside the garment print area without exceeding source resolution.';
      end if;

      if coalesce(trim(layer->>'name'), '') <> '' or coalesce(trim(layer->>'message'), '') <> '' then
        raise exception 'Seasonal Design Lab artwork layers do not accept customer text.';
      end if;

      normalized_layers := normalized_layers || jsonb_build_array(
        layer || jsonb_build_object(
          'order', layer_order - 1,
          'artworkId', a.id,
          'artwork_id', a.id,
          'artworkTitle', a.title,
          'category', a.category,
          'source_sha256', a.source_sha256,
          'production_path', a.production_path,
          'ink_bbox_px', a.ink_bbox_px,
          'placement', 'front',
          'width', w,
          'height', h,
          'x', x,
          'y', y,
          'rotation', rotation,
          'area_width', (area->>'width')::numeric,
          'area_height', (area->>'height')::numeric,
          'name', '',
          'message', ''
        )
      );
      titles := array_append(titles, a.title);
      categories := array_append(categories, a.category);
    end loop;

    if first_artwork_id is distinct from new.seasonal_artwork_id then
      raise exception 'The seasonal design primary artwork does not match its first layer.';
    end if;

    if not new.approval_policy_acknowledged then
      raise exception 'Approve the design details before continuing.';
    end if;
    if new.placement <> 'front' or jsonb_array_length(coalesce(new.additional_garments, '[]'::jsonb)) > 0 then
      raise exception 'Seasonal designs use one garment size and front placement per cart line.';
    end if;

    new.proof_required := case when new.render_status = 'locked' then false else true end;
    new.design_style := 'Seasonal Layers: ' || array_to_string(titles, ' + ');
    new.occasion := array_to_string(categories, ' · ');
    new.seasonal_configuration := jsonb_build_object(
      'version', 2,
      'layers', normalized_layers,
      'client_request_id', s->>'client_request_id'
    );
    return new;
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
  if new.placement <> 'front' or jsonb_array_length(coalesce(new.additional_garments, '[]'::jsonb)) > 0 then
    raise exception 'Seasonal designs use one garment size and front placement per cart line.';
  end if;

  new.proof_required := case when new.render_status = 'locked' then false else true end;
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
