-- Remove admin-only DTF capability flags from the publicly readable settings JSON
-- after the frontend has switched to the role-aware RPC boundary.

CREATE OR REPLACE FUNCTION public.strip_private_dtf_admin_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.dtf_settings := COALESCE(NEW.dtf_settings, '{}'::jsonb)
    - 'adminPreviewBypassEnabled'
    - 'adminProductionExportEnabled';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS strip_private_dtf_admin_settings_on_store_settings
  ON public.store_settings;

CREATE TRIGGER strip_private_dtf_admin_settings_on_store_settings
BEFORE INSERT OR UPDATE OF dtf_settings
ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.strip_private_dtf_admin_settings();

UPDATE public.store_settings
SET
  dtf_settings = COALESCE(dtf_settings, '{}'::jsonb)
    - 'adminPreviewBypassEnabled'
    - 'adminProductionExportEnabled',
  updated_at = now()
WHERE id = 1
  AND (
    COALESCE(dtf_settings, '{}'::jsonb) ? 'adminPreviewBypassEnabled'
    OR COALESCE(dtf_settings, '{}'::jsonb) ? 'adminProductionExportEnabled'
  );
