-- GDP CLOTHING - LOCAL-ONLY, TRANSACTIONAL rollback QA for direct invoice issuance.
-- Run ONLY against the Docker container supabase_db_gdp-clothing, through psql -f.
-- No real orders are selected or edited. Every fixture and auth stub is rolled back.
-- This test simulates already-approved admin/MFA gates; it does NOT validate real MFA.
\set ON_ERROR_STOP on
BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'postgres' OR inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'LOCAL TEST ONLY: expected local Docker postgres over Unix socket';
  END IF;
  IF to_regprocedure('public.issue_admin_invoice_from_draft(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Direct issuance migration not installed';
  END IF;
END
$guard$;

-- Transaction-scoped overrides used only in this local test transaction.
-- Other database connections never see them, and ROLLBACK restores originals.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $qa$ SELECT current_setting('gdp.qa_admin', true) = 'yes' $qa$;
CREATE OR REPLACE FUNCTION public.is_admin_step_up_authorized()
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $qa$ SELECT current_setting('gdp.qa_mfa', true) = 'yes' $qa$;

DO $qa$
DECLARE
  v_order uuid := gen_random_uuid();
  v_missing_user uuid := gen_random_uuid(); -- intentionally NOT inserted into auth.users
  v_reserved text := 'GDP-INV-QA-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_status text;
  v_payment_status text;
  v_number text;
  v_subtotal numeric;
  v_total numeric;
  v_items integer;
  v_issued integer;
  v_fk_name text := '';
  v_failed boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_missing_user::text, true);
  PERFORM set_config('gdp.qa_admin', 'yes', true);
  PERFORM set_config('gdp.qa_mfa', 'yes', true);

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_missing_user) THEN
    RAISE EXCEPTION 'Unexpected test user collision';
  END IF;

  INSERT INTO public.orders (
    id, order_number, customer_email, customer_name, subtotal, discount,
    shipping, tax, gst_hst_tax, pst_tax, total, status, payment_status,
    reserved_invoice_number
  ) VALUES (
    v_order, 'GDP-LOCAL-ROLLBACK-' || substr(replace(v_order::text, '-', ''), 1, 12),
    'invoice-rollback@example.invalid', 'LOCAL QA FAKE CUSTOMER',
    40, 0, 0, 0, 0, 0, 40, 'draft', 'pending', v_reserved
  );
  INSERT INTO public.order_items (order_id, name, quantity, unit_price)
  VALUES (v_order, 'LOCAL QA item; never sell', 2, 20);

  -- activate_admin_draft_atomic runs first; ledger INSERT then fails because
  -- issued_by references an auth.users row intentionally absent in this fixture.
  -- PL/pgSQL exception subtransaction must undo the earlier draft activation.
  BEGIN
    PERFORM public.issue_admin_invoice_from_draft(v_order);
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_fk_name = CONSTRAINT_NAME;
    IF v_fk_name NOT LIKE '%issued_by%' THEN
      RAISE EXCEPTION 'Unexpected foreign key failure: %', v_fk_name;
    END IF;
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'ROLLBACK TEST FAILED: issued_by foreign key failure was not raised';
  END IF;

  SELECT status, payment_status, reserved_invoice_number, subtotal, total
    INTO v_status, v_payment_status, v_number, v_subtotal, v_total
  FROM public.orders WHERE id = v_order;

  SELECT count(*) INTO v_items FROM public.order_items WHERE order_id = v_order;
  SELECT count(*) INTO v_issued FROM public.gdp_invoices WHERE order_id = v_order;

  IF v_status IS DISTINCT FROM 'draft'
    OR v_payment_status IS DISTINCT FROM 'pending'
    OR v_number IS DISTINCT FROM v_reserved
    OR v_subtotal IS DISTINCT FROM 40
    OR v_total IS DISTINCT FROM 40
    OR v_items <> 1
    OR v_issued <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK TEST FAILED: status=%, payment=%, number=%, subtotal=%, total=%, items=%, invoices=%',
      v_status, v_payment_status, v_number, v_subtotal, v_total, v_items, v_issued;
  END IF;

  RAISE NOTICE 'PASS: issuance failed at ledger foreign key after draft activation';
  RAISE NOTICE 'PASS: order stays draft / pending with reserved number unchanged';
  RAISE NOTICE 'PASS: original totals and line items preserved; no ledger row inserted';
END
$qa$;

-- Mandatory cleanup even on successful assertions.
ROLLBACK;
\echo 'PASS: Entire QA transaction rolled back; no test data or auth overrides persist.'
