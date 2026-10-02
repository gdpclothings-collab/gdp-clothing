-- Storefront visitors should never be able to mutate store-wide settings.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.store_settings
FROM anon;

-- Signed-in admins still update settings through existing client paths, protected
-- by the store_settings_admin_update RLS policy. Other mutation/DDL-adjacent
-- privileges are unnecessary for authenticated browser clients.
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.store_settings
FROM authenticated;
