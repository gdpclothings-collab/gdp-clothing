-- Keep the internal order-number prefix out of storefront/client reads.
-- Checkout continues to read this value server-side through the service role.
revoke select (order_prefix)
  on table public.store_settings
  from anon, authenticated;
