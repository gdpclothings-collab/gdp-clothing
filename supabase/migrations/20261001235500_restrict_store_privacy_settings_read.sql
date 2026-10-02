-- Keep internal privacy/compliance retention controls out of storefront sessions.
-- Customer privacy workflows use dedicated tables/functions and do not require
-- direct access to store_settings.privacy_settings.

revoke select (privacy_settings)
on table public.store_settings
from anon, authenticated;
