-- GDP Clothing: concurrent issuance QA SETUP.
-- Requires a disposable local clone gdp_invoice_qa_<8hex> or gdp_invoice_atomic_<8hex>, never 'postgres'.
-- This file creates only fictional test records in the clone.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF current_database() !~ '^(gdp_invoice_qa|gdp_invoice_atomic)_[0-9a-f]{8}$' THEN
    RAISE EXCEPTION 'REFUSING to run concurrency fixture outside a disposable QA database';
  END IF;
  IF inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'Expected local Docker Unix socket';
  END IF;
  IF to_regprocedure('public.issue_admin_invoice_from_draft(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Invoice issuance function missing in clone';
  END IF;
  IF pg_get_functiondef('public.issue_admin_invoice_from_draft(uuid)'::regprocedure)
       NOT LIKE '%auth.jwt()%aal%aal2%' THEN
    RAISE EXCEPTION 'Strict AAL2 invoice-issuance migration missing';
  END IF;
END $$;

CREATE TABLE public.gdp_qa_concurrency_fixture (
  actor_id uuid not null,
  order_id uuid not null,
  reserved_number text not null
);
CREATE TABLE public.gdp_qa_concurrency_calls (
  order_id uuid not null,
  started_at timestamptz not null default clock_timestamp()
);
GRANT SELECT ON public.gdp_qa_concurrency_fixture TO authenticated;
GRANT INSERT ON public.gdp_qa_concurrency_calls TO authenticated;

-- Persist each client's RPC return value inside the disposable clone.
-- Successful transactions must both report the SAME invoice ID and number.
CREATE TABLE public.gdp_qa_concurrency_results (
  order_id uuid not null,
  invoice_id uuid not null,
  invoice_number text not null
);
GRANT INSERT ON public.gdp_qa_concurrency_results TO authenticated;

-- Hold the FIRST ledger INSERT for 2.5s, so second connection arrives
-- while first holds the order lock. This trigger exists in the clone only.
CREATE FUNCTION public.gdp_qa_concurrency_delay() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.gdp_qa_concurrency_fixture f
    WHERE f.order_id=NEW.order_id
  ) THEN
    PERFORM pg_catalog.pg_sleep(2.5);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER gdp_qa_concurrency_pause BEFORE INSERT ON public.gdp_invoices
FOR EACH ROW EXECUTE FUNCTION public.gdp_qa_concurrency_delay();

DO $qa$
DECLARE
  v_actor uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_number text := 'GDP-INV-QA-'||substr(replace(gen_random_uuid()::text,'-',''),1,12);
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES (
    v_actor, '00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated','invoice-concurrency-qa@example.invalid',
    '',now(),now(),now()
  );
  UPDATE public.profiles SET role='admin' WHERE id=v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not create synthetic administrator profile';
  END IF;
  UPDATE public.admin_mfa_enrollment_state
  SET grace_started_at=now()-interval '8 days',
      grace_expires_at=now()-interval '1 day',
      enrolled_at=now()-interval '2 days'
  WHERE user_id=v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not establish synthetic AAL2-only admin state';
  END IF;
  INSERT INTO public.orders (
    id, order_number, customer_email, customer_name,
    subtotal,discount,shipping,tax,gst_hst_tax,pst_tax,total,
    status,payment_status,reserved_invoice_number,invoice_due_date,invoice_payment_terms
  ) VALUES (
    v_order,'GDP-LOCAL-CONCURRENT-'||substr(replace(v_order::text,'-',''),1,12),
    'invoice-concurrency-qa@example.invalid','CONCURRENCY QA FAKE CUSTOMER',
    40,0,0,4.40,2.00,2.40,44.40,'draft','pending',v_number,date '2026-10-31','Net 7'
  );
  INSERT INTO public.order_items(order_id,name,quantity,unit_price)
  VALUES(v_order,'LOCAL QA TEST GARMENT',2,20);
  INSERT INTO public.gdp_qa_concurrency_fixture(actor_id,order_id,reserved_number)
  VALUES(v_actor,v_order,v_number);
  RAISE NOTICE 'PASS: isolated fictional draft and test administrator prepared';
END $qa$;
COMMIT;
