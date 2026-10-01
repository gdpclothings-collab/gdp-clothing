-- Move DTF admin-only capability flags behind an authenticated admin/RLS boundary.
-- This migration is backward-compatible: it copies the current flags and adds RPCs,
-- while leaving the public JSON untouched until the frontend is deployed.

CREATE TABLE IF NOT EXISTS private.dtf_admin_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_preview_bypass_enabled boolean NOT NULL DEFAULT true,
  admin_production_export_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.dtf_admin_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.dtf_admin_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE private.dtf_admin_settings TO authenticated;

DROP POLICY IF EXISTS dtf_admin_settings_admin_select ON private.dtf_admin_settings;
CREATE POLICY dtf_admin_settings_admin_select
ON private.dtf_admin_settings
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS dtf_admin_settings_admin_insert ON private.dtf_admin_settings;
CREATE POLICY dtf_admin_settings_admin_insert
ON private.dtf_admin_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS dtf_admin_settings_admin_update ON private.dtf_admin_settings;
CREATE POLICY dtf_admin_settings_admin_update
ON private.dtf_admin_settings
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

INSERT INTO private.dtf_admin_settings (
  id,
  admin_preview_bypass_enabled,
  admin_production_export_enabled,
  updated_at
)
SELECT
  1,
  COALESCE((dtf_settings ->> 'adminPreviewBypassEnabled')::boolean, true),
  COALESCE((dtf_settings ->> 'adminProductionExportEnabled')::boolean, true),
  now()
FROM public.store_settings
WHERE id = 1
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_dtf_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_public jsonb;
  v_private private.dtf_admin_settings%ROWTYPE;
BEGIN
  SELECT COALESCE(dtf_settings, '{}'::jsonb)
    INTO v_public
  FROM public.store_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store settings missing' USING ERRCODE = 'P0002';
  END IF;

  v_public := v_public - 'adminPreviewBypassEnabled' - 'adminProductionExportEnabled';

  IF public.is_admin() THEN
    SELECT * INTO v_private
    FROM private.dtf_admin_settings
    WHERE id = 1;

    RETURN v_public || jsonb_build_object(
      'adminPreviewBypassEnabled', COALESCE(v_private.admin_preview_bypass_enabled, false),
      'adminProductionExportEnabled', COALESCE(v_private.admin_production_export_enabled, false)
    );
  END IF;

  RETURN v_public;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_admin_dtf_settings(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_public jsonb;
  v_preview_bypass boolean;
  v_production_export boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  v_public := COALESCE(p_settings, '{}'::jsonb)
    - 'adminPreviewBypassEnabled'
    - 'adminProductionExportEnabled';
  v_preview_bypass := COALESCE((p_settings ->> 'adminPreviewBypassEnabled')::boolean, false);
  v_production_export := COALESCE((p_settings ->> 'adminProductionExportEnabled')::boolean, false);

  UPDATE public.store_settings
  SET dtf_settings = v_public, updated_at = now()
  WHERE id = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store settings missing' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO private.dtf_admin_settings (
    id,
    admin_preview_bypass_enabled,
    admin_production_export_enabled,
    updated_at
  )
  VALUES (1, v_preview_bypass, v_production_export, now())
  ON CONFLICT (id) DO UPDATE
  SET
    admin_preview_bypass_enabled = EXCLUDED.admin_preview_bypass_enabled,
    admin_production_export_enabled = EXCLUDED.admin_production_export_enabled,
    updated_at = EXCLUDED.updated_at;

  RETURN v_public || jsonb_build_object(
    'adminPreviewBypassEnabled', v_preview_bypass,
    'adminProductionExportEnabled', v_production_export
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dtf_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dtf_settings() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.save_admin_dtf_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_admin_dtf_settings(jsonb) TO authenticated;
