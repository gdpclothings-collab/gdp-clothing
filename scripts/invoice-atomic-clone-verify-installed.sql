-- Assert the complete 11-migration atomic rollout installed secure final schema.
\set ON_ERROR_STOP on
DO $qa$
DECLARE
  v_def text;
  v_direct_def text;
  v_count integer;
BEGIN
 IF current_database() !~ '^gdp_invoice_atomic_[0-9a-f]{8}$' OR inet_server_addr() IS NOT NULL THEN
   RAISE EXCEPTION 'Only disposable local atomic QA clone permitted';
 END IF;
 IF to_regclass('public.gdp_invoices') IS NULL
    OR to_regclass('public.gdp_invoice_number_seq') IS NULL
    OR to_regprocedure('public.issue_admin_invoice_from_draft(uuid)') IS NULL
    OR to_regprocedure('public.issue_admin_order_invoice(uuid)') IS NULL THEN
   RAISE EXCEPTION 'Atomic package missing ledger, sequence, or RPC';
 END IF;
 SELECT count(*) INTO v_count FROM information_schema.columns
 WHERE table_schema='public' AND table_name='orders'
   AND column_name IN ('reserved_invoice_number','invoice_document_meta','invoice_due_date','invoice_payment_terms');
 IF v_count<>4 THEN RAISE EXCEPTION 'Expected 4 added invoice columns; saw %',v_count; END IF;
 SELECT pg_get_functiondef('public.issue_admin_order_invoice(uuid)'::regprocedure) INTO v_def;
 SELECT pg_get_functiondef('public.issue_admin_invoice_from_draft(uuid)'::regprocedure) INTO v_direct_def;
 IF v_def NOT LIKE '%aal2%' OR v_direct_def NOT LIKE '%aal2%'
    OR v_def NOT LIKE '%is_admin_step_up_authorized%'
    OR v_direct_def NOT LIKE '%is_admin_step_up_authorized%' THEN
   RAISE EXCEPTION 'Missing strict AAL2 or admin step-up guards';
 END IF;
 IF v_def NOT LIKE '%invoice_due_date%' OR v_def NOT LIKE '%invoice_payment_terms%' THEN
   RAISE EXCEPTION 'Immutable issued due-date/terms snapshot incomplete';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.gdp_invoices'::regclass) THEN
   RAISE EXCEPTION 'Invoice ledger RLS is disabled';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_trigger
   WHERE tgrelid='public.gdp_invoices'::regclass
     AND tgname='gdp_invoices_immutable' AND NOT tgisinternal
 ) THEN RAISE EXCEPTION 'Immutable ledger trigger missing'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid='public.gdp_invoices'::regclass
   AND contype='u' AND conname='gdp_invoices_order_id_key'
 ) OR NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid='public.gdp_invoices'::regclass
   AND contype='u' AND conname='gdp_invoices_invoice_number_key'
 ) THEN RAISE EXCEPTION 'Unique invoice ID/order number constraints missing'; END IF;
 IF has_function_privilege('anon','public.issue_admin_order_invoice(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.issue_admin_invoice_from_draft(uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.issue_admin_invoice_from_draft(uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.issue_admin_order_invoice(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected invoice issuance RPC execution privileges';
 END IF;
 RAISE NOTICE 'PASS: full atomic package installed with ledger uniqueness, RLS, immutable trigger, admin AAL2 and frozen terms';
END $qa$;
