-- Customer preview policy and clean admin production export defaults.
update public.store_settings
set dtf_settings = coalesce(dtf_settings, '{}'::jsonb) || jsonb_build_object(
  'watermarkedPreviewEnabled', true,
  'previewDownloadBeforePayment', false,
  'fullResolutionDownloadAfterPayment', false,
  'adminProductionExportEnabled', true,
  'watermarkText', 'GDP Clothing Preview',
  'watermarkOpacity', 0.2,
  'watermarkSize', 28,
  'watermarkPosition', 'repeated',
  'watermarkApplyTo', 'all'
),
updated_at = now()
where id = 1;
