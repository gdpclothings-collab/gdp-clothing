alter table public.store_settings
  add column if not exists maintenance_settings jsonb not null default
  '{"enabled":false,"eyebrow":"GDP CLOTHING","title":"We’re tuning things up.","message":"Our online store is temporarily unavailable while we make improvements. Thanks for your patience — we’ll be back shortly.","statusLabel":"Site maintenance","showEstimatedReturn":false,"estimatedReturnAt":null,"showContact":true,"contactLabel":"Need help with an existing order?","showSocialLinks":true}'::jsonb;

comment on column public.store_settings.maintenance_settings is
  'Public storefront maintenance-mode configuration. Public can read; admin role can update through store_settings RLS.';
