-- GDP Clothing: LOCAL-ONLY invoice MFA authorization-claims regression test.
-- Uses REAL database admin / step-up functions (NO AUTHORIZATION STUBS).
-- Simulates JWT AAL1/AAL2 claims via PostgreSQL session settings;
-- it DOES NOT prove Supabase Auth verified an actual authenticator code.
-- All temporary user/order/ledger data is removed by ROLLBACK.
-- Execute ONLY in local Docker: supabase_db_gdp-clothing, psql -f.
\set ON_ERROR_STOP on
BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'postgres' OR inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'LOCAL TEST ONLY: expected Docker postgres over Unix socket';
  END IF;
  IF to_regprocedure('public.issue_admin_invoice_from_draft(uuid)') IS NULL
     OR to_regprocedure('public.issue_admin_order_invoice(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Required invoice RPCs are not installed';
  END IF;
END
$guard$;

DO $mfa_qa$
DECLARE
  v_order uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_reserved text := 'GDP-INV-MFA-QA-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  v_first public.gdp_invoices%rowtype;
  v_retry public.gdp_invoices%rowtype;
  v_denied boolean;
  v_status text;
  v_count integer;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES (
    v_user, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invoice-mfa-qa@example.invalid',
    '', now(), now(), now()
  );
  -- The standard auth.users trigger creates the profile automatically.
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user::text, 'aal', 'aal2',
      'role','authenticated')::text, true);

  IF public.is_admin() OR public.is_admin_step_up_authorized() THEN
    RAISE EXCEPTION 'SECURITY FAILURE: ordinary user elevated by AAL2 alone';
  END IF;
  RAISE NOTICE 'PASS: non-admin user is not authorized, even with AAL2 claim';

  UPDATE public.profiles SET role='admin' WHERE id=v_user;
  IF NOT EXISTS (SELECT 1 FROM public.admin_mfa_enrollment_state WHERE user_id=v_user)
     OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Could not initialize synthetic admin and MFA state';
  END IF;

  -- A previously enrolled admin with expired grace MUST reject AAL1.
  UPDATE public.admin_mfa_enrollment_state
  SET grace_started_at=now()-interval '8 days',
      grace_expires_at=now()-interval '1 day',
      enrolled_at=now()-interval '2 days'
  WHERE user_id=v_user;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user::text, 'aal', 'aal1',
      'role','authenticated')::text, true);
  IF public.is_admin_step_up_authorized() THEN
    RAISE EXCEPTION 'SECURITY FAILURE: enrolled admin AAL1 was allowed';
  END IF;

  INSERT INTO public.orders (
    id, order_number, customer_email, customer_name,
    subtotal, discount, shipping, tax, gst_hst_tax, pst_tax,
    total, status, payment_status, reserved_invoice_number
  ) VALUES (
    v_order, 'GDP-MFA-LOCAL-QA-' || substr(replace(v_order::text, '-', ''), 1, 12),
    'invoice-mfa-qa@example.invalid', 'LOCAL TEST CUSTOMER',
    40, 0, 0, 0, 0, 0, 40, 'draft', 'pending', v_reserved
  );
  INSERT INTO public.order_items(order_id,name,quantity,unit_price)
  VALUES(v_order,'TEST ONLY: Fake garment',2,20);

  v_denied:=false;
  BEGIN
    PERFORM public.issue_admin_invoice_from_draft(v_order);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'SECURITY FAILURE: enrolled AAL1 admin issued invoice';
  END IF;
  RAISE NOTICE 'PASS: enrolled admin AAL1 issuance rejected';

  -- By design the general helper ALLOWS first-time onboarding grace.
  -- The invoice RPC itself MUST still reject AAL1 during that grace.
  UPDATE public.admin_mfa_enrollment_state
  SET grace_started_at=now()-interval '1 day',
      grace_expires_at=now()+interval '1 day',
      enrolled_at=NULL
  WHERE user_id=v_user;
  IF NOT public.is_admin_step_up_authorized() THEN
    RAISE EXCEPTION 'Test setup failure: first-time grace helper not active';
  END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.issue_admin_invoice_from_draft(v_order);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'SECURITY FAILURE: AAL1 admin issued during MFA enrollment grace';
  END IF;
  SELECT status INTO v_status FROM public.orders WHERE id=v_order;
  SELECT count(*) INTO v_count FROM public.gdp_invoices WHERE order_id=v_order;
  IF v_status IS DISTINCT FROM 'draft' OR v_count<>0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: rejected issuance mutated draft';
  END IF;
  RAISE NOTICE 'PASS: invoice issuance requires AAL2, even during onboarding grace';

  -- Mark enrolled, end grace, then emulate the authenticated AAL2 JWT claim.
  UPDATE public.admin_mfa_enrollment_state
  SET grace_started_at=now()-interval '8 days',
      grace_expires_at=now()-interval '1 day',
      enrolled_at=now()-interval '2 days'
  WHERE user_id=v_user;
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user::text, 'aal', 'aal2',
      'role','authenticated')::text, true);
  IF NOT public.is_admin_step_up_authorized() THEN
    RAISE EXCEPTION 'SECURITY FAILURE: synthetic admin AAL2 rejected';
  END IF;
  SELECT * INTO v_first FROM public.issue_admin_invoice_from_draft(v_order);
  IF v_first.id IS NULL OR v_first.invoice_number IS DISTINCT FROM v_reserved THEN
    RAISE EXCEPTION 'ISSUANCE FAILURE: AAL2 did not preserve reserved number';
  END IF;
  SELECT * INTO v_retry FROM public.issue_admin_invoice_from_draft(v_order);
  IF v_first.id IS DISTINCT FROM v_retry.id
     OR v_first.invoice_number IS DISTINCT FROM v_retry.invoice_number THEN
    RAISE EXCEPTION 'ISSUANCE FAILURE: AAL2 retry made another invoice';
  END IF;
  RAISE NOTICE 'PASS: authorized AAL2 claims issued once; retry reused invoice';

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user::text, 'aal', 'aal1',
      'role','authenticated')::text, true);
  v_denied:=false;
  BEGIN
    PERFORM public.issue_admin_order_invoice(v_order);
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'SECURITY FAILURE: direct ledger RPC permitted AAL1';
  END IF;
  RAISE NOTICE 'PASS: direct ledger issuance RPC also blocks AAL1';

  SELECT count(*) INTO v_count FROM public.gdp_invoices WHERE order_id=v_order;
  IF v_count<>1 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: expected exactly one temporary invoice';
  END IF;
END
$mfa_qa$;

ROLLBACK;
\echo 'PASS: local MFA-claims QA transaction rolled back (no records persisted).'
