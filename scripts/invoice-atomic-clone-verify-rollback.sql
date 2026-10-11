-- Assert failure injection left NO invoice schema (full transaction rollback).
\set ON_ERROR_STOP on
DO $qa$
BEGIN
 IF current_database() !~ '^gdp_invoice_atomic_[0-9a-f]{8}$' OR inet_server_addr() IS NOT NULL THEN
   RAISE EXCEPTION 'Only disposable local atomic QA clone permitted';
 END IF;
 IF to_regclass('public.gdp_invoices') IS NOT NULL
    OR to_regclass('public.gdp_invoice_number_seq') IS NOT NULL
    OR to_regprocedure('public.issue_admin_order_invoice(uuid)') IS NOT NULL
    OR to_regprocedure('public.issue_admin_invoice_from_draft(uuid)') IS NOT NULL
    OR EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='orders'
        AND column_name IN ('reserved_invoice_number','invoice_document_meta','invoice_due_date','invoice_payment_terms')
    )
 THEN RAISE EXCEPTION 'ATOMICITY FAILURE: partial invoice schema survived the failed transaction';
 END IF;
 RAISE NOTICE 'PASS: deliberate failure rolled back ALL invoice schema changes';
END $qa$;
