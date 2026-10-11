-- GDP Clothing local-only duplicate issuance/idempotency test.
-- Run ONLY in local Docker Supabase DB; all data and auth stubs are rolled back.
-- Admin/MFA gates are SIMULATED, not a test of actual TOTP enrollment.
\set ON_ERROR_STOP on
BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'postgres' OR inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'LOCAL TEST ONLY: expected Docker postgres over Unix socket';
  END IF;
  IF to_regprocedure('public.issue_admin_invoice_from_draft(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Direct issuance migration not installed';
  END IF;
END
$guard$;

-- Transaction-scoped stubs. Existing functions are restored on ROLLBACK.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $qa$ SELECT current_setting('gdp.qa_admin', true) = 'yes' $qa$;

CREATE OR REPLACE FUNCTION public.is_admin_step_up_authorized()
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $qa$ SELECT current_setting('gdp.qa_mfa', true) = 'yes' $qa$;

DO $qa$
DECLARE
  v_order uuid := gen_random_uuid();
  v_test_user uuid := gen_random_uuid();
  v_reserved text := 'GDP-INV-QA-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  v_first public.gdp_invoices%ROWTYPE;
  v_retry public.gdp_invoices%ROWTYPE;
  v_count integer;
  v_order_status text;
  v_payment_status text;
  v_stored_number text;
  v_total numeric;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES (
    v_test_user, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invoice-idempotency-qa@example.invalid',
    '', now(), now(), now()
  );
  PERFORM set_config('request.jwt.claim.sub', v_test_user::text, true);
  PERFORM set_config('gdp.qa_admin', 'yes', true);
  PERFORM set_config('gdp.qa_mfa', 'yes', true);

  INSERT INTO public.orders (
    id, order_number, customer_email, customer_name,
    subtotal, discount, shipping, tax, gst_hst_tax, pst_tax,
    total, status, payment_status, reserved_invoice_number
  ) VALUES (
    v_order, 'GDP-LOCAL-IDEMPOTENCY-' || substr(replace(v_order::text, '-', ''), 1, 12),
    'invoice-idempotency@example.invalid', 'LOCAL QA FAKE CUSTOMER',
    40, 0, 0, 4.40, 2.00, 2.40,
    44.40, 'draft', 'pending', v_reserved
  );

  INSERT INTO public.order_items (order_id, name, quantity, unit_price)
  VALUES (v_order, 'LOCAL QA item; never sell', 2, 20);

  SELECT * INTO v_first FROM public.issue_admin_invoice_from_draft(v_order);
  IF v_first.id IS NULL OR v_first.order_id IS DISTINCT FROM v_order
    OR v_first.invoice_number IS DISTINCT FROM v_reserved
    OR v_first.issued_by IS DISTINCT FROM v_test_user THEN
    RAISE EXCEPTION 'ISSUANCE TEST FAILED: first issue did not preserve reserved number or actor';
  END IF;
  RAISE NOTICE 'PASS: first issuance preserved reserved invoice number';

  SELECT * INTO v_retry FROM public.issue_admin_invoice_from_draft(v_order);
  IF v_retry.id IS DISTINCT FROM v_first.id
    OR v_retry.invoice_number IS DISTINCT FROM v_first.invoice_number
    OR v_retry.issued_at IS DISTINCT FROM v_first.issued_at THEN
    RAISE EXCEPTION 'IDEMPOTENCY TEST FAILED: repeat issuance changed invoice';
  END IF;
  RAISE NOTICE 'PASS: repeat issuance returned same invoice, number and issuance time';

  SELECT count(*) INTO v_count
  FROM public.gdp_invoices WHERE order_id = v_order;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'IDEMPOTENCY TEST FAILED: expected one invoice row, got %', v_count;
  END IF;
  RAISE NOTICE 'PASS: exactly one ledger entry for this order';

  SELECT status, payment_status, reserved_invoice_number, total
  INTO v_order_status, v_payment_status, v_stored_number, v_total
  FROM public.orders WHERE id = v_order;
  IF v_order_status IS DISTINCT FROM 'pending_payment'
    OR v_payment_status IS DISTINCT FROM 'pending'
    OR v_stored_number IS DISTINCT FROM v_reserved
    OR v_total IS DISTINCT FROM 44.40 THEN
    RAISE EXCEPTION 'IDEMPOTENCY TEST FAILED: order changed unexpectedly';
  END IF;
  RAISE NOTICE 'PASS: activated order remains unpaid with original totals';
END
$qa$;

ROLLBACK;
\echo 'PASS: local-only invoice test, synthetic user and auth stubs rolled back.'
