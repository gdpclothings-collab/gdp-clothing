-- Keep the administrative store timezone out of storefront/client reads.
-- Admins continue to receive this value through the protected admin settings RPC.
revoke select (timezone)
  on table public.store_settings
  from anon, authenticated;
