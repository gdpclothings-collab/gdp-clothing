-- Admin-only read boundary for operational store settings.
-- Phase 1 is backward-compatible: public column grants remain unchanged until
-- the frontend has switched admin reads to this RPC.

CREATE OR REPLACE FUNCTION private.get_admin_store_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s)
    INTO v_settings
  FROM public.store_settings AS s
  WHERE s.id = 1;

  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'store settings missing' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_settings;
END;
$$;

REVOKE ALL ON FUNCTION private.get_admin_store_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_admin_store_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_store_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.get_admin_store_settings();
$$;

REVOKE ALL ON FUNCTION public.get_admin_store_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_store_settings() TO authenticated;
