-- Phase 2: remove supplier sourcing/internal garment cost metadata from the publicly readable
-- store_settings JSON and prevent legacy/direct writes from putting it back.

CREATE OR REPLACE FUNCTION public.strip_private_apparel_sourcing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.apparel_pricing := COALESCE(NEW.apparel_pricing, '{}'::jsonb) - 'sourcing';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS strip_private_apparel_sourcing_on_store_settings
  ON public.store_settings;

CREATE TRIGGER strip_private_apparel_sourcing_on_store_settings
BEFORE INSERT OR UPDATE OF apparel_pricing
ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.strip_private_apparel_sourcing();

UPDATE public.store_settings
SET
  apparel_pricing = COALESCE(apparel_pricing, '{}'::jsonb) - 'sourcing',
  updated_at = now()
WHERE id = 1
  AND COALESCE(apparel_pricing, '{}'::jsonb) ? 'sourcing';
