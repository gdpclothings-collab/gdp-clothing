-- GDP Clothing: local-only transaction rollback test for direct invoice issuance.
-- Run ONLY against the Docker container supabase_db_gdp-clothing with psql -f.
-- No real orders are read or changed. Fake records, wrappers and test trigger
-- are created inside BEGIN/ROLLBACK, so nothing survives the test.
-- Admin/MFA authorization is STUBBED; this does not prove real MFA enrollment.
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

-- These test-only auth wrappers are transaction-scoped; the originals return
-- on ROLLBACK and concurrent connections cannot see these uncommitted changes.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $qa$ SELECT current_setting('gdp.qa_admin', true) = 'yes' $qa$;

CREATE OR REPLACE FUNCTION public.is_admin_step_up_authorized()
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $qa$ SELECT current_setting('gdp.qa_mfa', true) = 'yes' $qa$;

-- Force a deterministic failure at the FINAL ledger INSERT, after
-- activate_admin_draft_atomic has already updated the draft. This is more
-- reliable than a missing auth user, which can fail in an order-activity hook.
CREATE FUNCTION public.gdp_qa_block_invoice_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $qa$
BEGIN
  IF NEW.order_id::text = current_setting('gdp.qa_fail_invoice_order', true) THEN
    RAISE EXCEPTION 'GDP_QA_EXPECTED_INVOICE_INSERT_FAILURE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$qa$;

CREATE TRIGGER gdp_qa_block_invoice_insert
BEFORE INSERT ON public.gdp_invoices
FOR EACH ROW EXECUTE FUNCTION public.gdp_qa_block_invoice_insert();

DO $qa$
DECLARE
  v_order uuid := gen_random_uuid();
  v_test_user uuid := gen_random_uuid();
  v_reserved text := 'GDP-INV-QA-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_status text;
  v_payment_status text;
  v_number text;
  v_subtotal numeric;
  v_total numeric;
  v_items integer;
  v_issued integer;
  v_failed boolean := false;
BEGIN
  -- A real (but synthetic) local auth.users row satisfies audit-log FK
  -- constraints; the row is reverted by ROLLBACK.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES (
    v_test_user, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invoice-rollback-qa@example.invalid',
    '', now(), now(), now()
  );
  PERFORM set_config('request.jwt.claim.sub', v_test_user::text, true);
  PERFORM set_config('gdp.qa_admin', 'yes', true);
  PERFORM set_config('gdp.qa_mfa', 'yes', true);
  PERFORM set_config('gdp.qa_fail_invoice_order', v_order::text, true);

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

  -- Function first activates the draft, then our trigger blocks the ledger
  -- INSERT. Catch only this EXPECTED error; all other errors fail the test.
  BEGIN
    PERFORM public.issue_admin_invoice_from_draft(v_order);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'GDP_QA_EXPECTED_INVOICE_INSERT_FAILURE' THEN
      RAISE;
    END IF;
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'ROLLBACK TEST FAILED: expected ledger failure never occurred';
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

  RAISE NOTICE 'PASS: ledger failure triggered after draft activation';
  RAISE NOTICE 'PASS: draft and payment status unchanged; reserved number preserved';
  RAISE NOTICE 'PASS: totals and items preserved; no invoice row inserted';
END
$qa$;

-- Mandatory cleanup even when all assertions pass.
ROLLBACK;
\echo 'PASS: all local QA rows, overrides and failure trigger were rolled back.'
