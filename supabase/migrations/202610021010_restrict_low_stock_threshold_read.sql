-- Keep the internal inventory alert threshold out of storefront/client reads.
-- Admins continue to receive this value through the protected admin settings RPC.
revoke select (low_stock_threshold)
  on table public.store_settings
  from anon, authenticated;
