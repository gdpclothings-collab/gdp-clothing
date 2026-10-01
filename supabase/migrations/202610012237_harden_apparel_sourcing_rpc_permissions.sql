-- Replace authenticated-callable SECURITY DEFINER RPCs with SECURITY INVOKER functions.
-- Private sourcing access is enforced by table privileges + RLS admin policies.

ALTER TABLE private.apparel_sourcing_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.apparel_sourcing_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE private.apparel_sourcing_settings TO authenticated;

DROP POLICY IF EXISTS apparel_sourcing_admin_select ON private.apparel_sourcing_settings;
CREATE POLICY apparel_sourcing_admin_select
ON private.apparel_sourcing_settings
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS apparel_sourcing_admin_insert ON private.apparel_sourcing_settings;
CREATE POLICY apparel_sourcing_admin_insert
ON private.apparel_sourcing_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS apparel_sourcing_admin_update ON private.apparel_sourcing_settings;
CREATE POLICY apparel_sourcing_admin_update
ON private.apparel_sourcing_settings
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_admin_apparel_pricing()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pricing jsonb;
  v_sourcing jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(apparel_pricing, '{}'::jsonb)
    INTO v_pricing
  FROM public.store_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store settings missing' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(sourcing, '{}'::jsonb)
    INTO v_sourcing
  FROM private.apparel_sourcing_settings
  WHERE id = 1;

  RETURN (v_pricing - 'sourcing') ||
    jsonb_build_object('sourcing', COALESCE(v_sourcing, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_admin_apparel_pricing(p_pricing jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_public_pricing jsonb;
  v_sourcing jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  v_public_pricing := COALESCE(p_pricing, '{}'::jsonb) - 'sourcing';
  v_sourcing := COALESCE(p_pricing -> 'sourcing', '{}'::jsonb);

  UPDATE public.store_settings
  SET
    apparel_pricing = v_public_pricing,
    updated_at = now()
  WHERE id = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store settings missing' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.apparel_sourcing_settings (id, sourcing, updated_at)
  VALUES (1, v_sourcing, now())
  ON CONFLICT (id) DO UPDATE
  SET
    sourcing = EXCLUDED.sourcing,
    updated_at = EXCLUDED.updated_at;

  RETURN v_public_pricing || jsonb_build_object('sourcing', v_sourcing);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_apparel_pricing() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_admin_apparel_pricing(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_apparel_pricing() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_apparel_pricing(jsonb) TO authenticated;
