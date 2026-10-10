-- LOCAL ONLY. Test invoices with fake data and transactional authorization stubs.
-- This test does NOT validate real MFA enrollment. All changes rollback.
\set ON_ERROR_STOP on
BEGIN;
-- Temporarily replace ONLY the two public auth wrappers within this transaction.
-- ROLLBACK restores the originals. Do not run against any hosted database.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $auth$ SELECT current_setting('gdp.test_admin', true) = 'yes' $auth$;
CREATE OR REPLACE FUNCTION public.is_admin_step_up_authorized()
RETURNS boolean LANGUAGE sql STABLE SET search_path = ''
AS $auth$ SELECT current_setting('gdp.test_mfa', true) = 'yes' $auth$;

DO $test$
DECLARE
  v_order uuid := gen_random_uuid();
  v_first public.gdp_invoices%ROWTYPE;
  v_second public.gdp_invoices%ROWTYPE;
  v_blocked boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
  PERFORM set_config('gdp.test_admin','yes',true);
  PERFORM set_config('gdp.test_mfa','yes',true);

  INSERT INTO public.orders(id,order_number,customer_email,customer_name,
    subtotal,discount,shipping,tax,gst_hst_tax,pst_tax,total,status,payment_status)
  VALUES (v_order,'LOCAL-INVOICE-SMOKE-' || substr(v_order::text,1,8),
    'test@example.invalid','LOCAL TEST CUSTOMER',40,0,0,4.40,2,2.40,44.40,
    'pending_payment','pending');
  INSERT INTO public.order_items(order_id,name,quantity,unit_price)
  VALUES (v_order,'Fake T-shirt for local test',2,20);

  SELECT * INTO v_first FROM public.issue_admin_order_invoice(v_order);
  IF v_first.order_id IS DISTINCT FROM v_order OR v_first.invoice_number NOT LIKE 'GDP-INV-%'
    THEN RAISE EXCEPTION 'Invoice creation failed'; END IF;
  RAISE NOTICE 'PASS: numbered invoice created';

  SELECT * INTO v_second FROM public.issue_admin_order_invoice(v_order);
  IF v_second.id IS DISTINCT FROM v_first.id OR v_second.invoice_number IS DISTINCT FROM v_first.invoice_number
    THEN RAISE EXCEPTION 'Duplicate invoice issued'; END IF;
  RAISE NOTICE 'PASS: retry returned same invoice';

  v_blocked := false;
  BEGIN
    UPDATE public.gdp_invoices SET snapshot='{}'::jsonb WHERE id=v_first.id;
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Invoice mutation incorrectly permitted'; END IF;
  RAISE NOTICE 'PASS: invoice update blocked';

  PERFORM set_config('gdp.test_mfa','no',true);
  v_blocked := false;
  BEGIN
    PERFORM public.issue_admin_order_invoice(gen_random_uuid());
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Invoice issuance without MFA permitted'; END IF;
  RAISE NOTICE 'PASS: MFA guard invoked';

  PERFORM set_config('gdp.test_mfa','yes',true);
  PERFORM set_config('gdp.test_admin','no',true);
  v_blocked := false;
  BEGIN
    PERFORM public.issue_admin_order_invoice(gen_random_uuid());
  EXCEPTION WHEN raise_exception THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Invoice issuance without admin permitted'; END IF;
  RAISE NOTICE 'PASS: admin guard invoked';
END
$test$;
ROLLBACK;
