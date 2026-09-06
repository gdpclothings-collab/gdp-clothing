-- Global Custom Studio UI/settings ownership.
-- Product records keep only garment-specific preview/media/print-area configuration.

alter table public.store_settings
  add column if not exists custom_studio_settings jsonb not null
  default '{
    "mobileFloatingCtaEnabled": false,
    "intensityExamplesEnabled": true,
    "intensityExampleImageUrl": "/images/design-intensity-bootleg.svg",
    "defaultDesignIntensity": 3,
    "orderGuideEnabled": true
  }'::jsonb;

update public.store_settings
set custom_studio_settings =
  jsonb_build_object(
    'mobileFloatingCtaEnabled', false,
    'intensityExamplesEnabled', true,
    'intensityExampleImageUrl', '/images/design-intensity-bootleg.svg',
    'defaultDesignIntensity', 3,
    'orderGuideEnabled', true
  )
where id = 1
  and (
    custom_studio_settings is null
    or jsonb_typeof(custom_studio_settings) <> 'object'
    or custom_studio_settings = '{}'::jsonb
  );

alter table public.store_settings
  drop constraint if exists store_settings_custom_studio_settings_object;

alter table public.store_settings
  add constraint store_settings_custom_studio_settings_object
  check (jsonb_typeof(custom_studio_settings) = 'object');
