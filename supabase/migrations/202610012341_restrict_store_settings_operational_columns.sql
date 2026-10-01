-- Phase 2: remove payment/test operational fields from storefront Data API reads.
-- Service-role access is intentionally preserved for checkout and payment preflight.

REVOKE SELECT ON TABLE public.store_settings FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id,
  logo,
  store_name,
  slogan,
  primary_color,
  currency,
  timezone,
  order_prefix,
  low_stock_threshold,
  contact_email,
  phone,
  address,
  facebook,
  instagram,
  tiktok,
  youtube,
  footer_text,
  updated_at,
  homepage,
  homepage_version,
  homepage_published_at,
  homepage_updated_at,
  custom_studio_settings,
  dtf_settings,
  privacy_settings,
  maintenance_settings,
  apparel_pricing
) ON public.store_settings TO anon, authenticated;
