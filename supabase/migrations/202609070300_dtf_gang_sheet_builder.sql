-- GDP Clothing DTF gang sheet builder, pricing, artwork storage, and order metadata.
-- Pricing uses square inches. Default model: first 1,224 in² at $0.028/in²,
-- then additional area at $0.025/in² so larger sheets never become cheaper.

begin;

alter table public.store_settings
  add column if not exists dtf_settings jsonb not null
  default '{
    "enabled": true,
    "maxWidth": 34,
    "defaultWidth": 34,
    "minLength": 6,
    "standardMaxLength": 36,
    "pricingMode": "graduated",
    "standardRate": 0.028,
    "volumeRate": 0.025,
    "breakpointArea": 1224,
    "popularLengths": [12, 24, 36, 48, 60, 72, 96, 120],
    "spacing": 0.25,
    "recommendedDpi": 300,
    "minimumDpi": 200,
    "allowCustomWidth": true,
    "allowCustomLength": true,
    "productionSegmentLength": 120,
    "artworkReviewEnabled": true,
    "artworkReviewPrice": 0,
    "maxUploadMb": 100,
    "acceptedMimeTypes": ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"]
  }'::jsonb;

update public.store_settings
set dtf_settings = '{
  "enabled": true,
  "maxWidth": 34,
  "defaultWidth": 34,
  "minLength": 6,
  "standardMaxLength": 36,
  "pricingMode": "graduated",
  "standardRate": 0.028,
  "volumeRate": 0.025,
  "breakpointArea": 1224,
  "popularLengths": [12, 24, 36, 48, 60, 72, 96, 120],
  "spacing": 0.25,
  "recommendedDpi": 300,
  "minimumDpi": 200,
  "allowCustomWidth": true,
  "allowCustomLength": true,
  "productionSegmentLength": 120,
  "artworkReviewEnabled": true,
  "artworkReviewPrice": 0,
  "maxUploadMb": 100,
  "acceptedMimeTypes": ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"]
}'::jsonb
where id = 1
  and (
    dtf_settings is null
    or jsonb_typeof(dtf_settings) <> 'object'
    or dtf_settings = '{}'::jsonb
  );

alter table public.store_settings
  drop constraint if exists store_settings_dtf_settings_object;

alter table public.store_settings
  add constraint store_settings_dtf_settings_object
  check (jsonb_typeof(dtf_settings) = 'object');

alter table public.order_items
  add column if not exists custom_data jsonb not null default '{}'::jsonb;

alter table public.order_items
  drop constraint if exists order_items_custom_data_object;

alter table public.order_items
  add constraint order_items_custom_data_object
  check (jsonb_typeof(custom_data) = 'object');

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'dtf-artwork',
  'dtf-artwork',
  false,
  104857600,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dtf_artwork_admin_read" on storage.objects;
create policy "dtf_artwork_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'dtf-artwork'
  and public.is_admin()
);

drop policy if exists "dtf_artwork_admin_delete" on storage.objects;
create policy "dtf_artwork_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'dtf-artwork'
  and public.is_admin()
);

insert into public.products (
  name,
  slug,
  description,
  type,
  category,
  vendor,
  track_inventory,
  requires_shipping,
  taxable,
  price,
  images,
  colors,
  sizes,
  tags,
  fulfillment_mode,
  status,
  featured,
  best_seller,
  new_arrival,
  custom_designable,
  material,
  theme_template,
  metafields,
  customization,
  sell_when_out_of_stock
)
values (
  'Custom DTF Gang Sheet',
  'dtf-gang-sheet',
  'Order custom DTF transfer film up to 34 inches wide. Build a gang sheet from separate artwork or upload one print-ready sheet, preview the layout, and choose a custom film length.',
  'DTF Transfer Film',
  'DTF Transfers',
  'GDP Clothing',
  false,
  true,
  true,
  11.42,
  array['/images/dtf-gang-sheet.svg']::text[],
  '{}'::text[],
  '{}'::text[],
  array['dtf', 'gang-sheet', 'transfer-film', 'wide-format']::text[],
  'in_house',
  'active',
  true,
  false,
  true,
  false,
  'DTF transfer film',
  'dtf-gang-sheet',
  '{
    "short_description": "Build or upload a DTF gang sheet up to 34 inches wide with custom length and live artwork preview.",
    "dtf_gang_sheet": true,
    "exclude_quantity_discount": true
  }'::jsonb,
  '{}'::jsonb,
  true
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    type = excluded.type,
    category = excluded.category,
    vendor = excluded.vendor,
    track_inventory = excluded.track_inventory,
    requires_shipping = excluded.requires_shipping,
    taxable = excluded.taxable,
    price = excluded.price,
    images = excluded.images,
    tags = excluded.tags,
    fulfillment_mode = excluded.fulfillment_mode,
    status = excluded.status,
    featured = excluded.featured,
    new_arrival = excluded.new_arrival,
    custom_designable = excluded.custom_designable,
    material = excluded.material,
    theme_template = excluded.theme_template,
    metafields = coalesce(public.products.metafields, '{}'::jsonb) || excluded.metafields,
    sell_when_out_of_stock = excluded.sell_when_out_of_stock,
    updated_at = now();

commit;
