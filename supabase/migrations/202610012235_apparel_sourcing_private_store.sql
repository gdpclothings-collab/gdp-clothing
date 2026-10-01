-- Keep supplier sourcing and internal garment cost metadata out of publicly readable store settings.
-- Phase 1 is intentionally backward-compatible: it copies the existing sourcing object into
-- the private schema and adds admin-only RPCs, but does not remove the public copy yet.

CREATE TABLE IF NOT EXISTS private.apparel_sourcing_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sourcing jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.apparel_sourcing_settings FROM PUBLIC, anon, authenticated;

INSERT INTO private.apparel_sourcing_settings (id, sourcing, updated_at)
SELECT
  1,
  COALESCE(apparel_pricing -> 'sourcing', '{}'::jsonb),
  now()
FROM public.store_settings
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_admin_apparel_pricing()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
SECURITY DEFINER
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
