-- DESTRUCTIVE TEST FIXTURE. ONLY disposable gdp_invoice_atomic_<8 hex>
-- database restored from local Docker DB. NEVER run against 'postgres' or production.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
  IF current_database() !~ '^gdp_invoice_atomic_[0-9a-f]{8}$'
     OR inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSING: only local disposable invoice atomic QA clone is allowed';
  END IF;
  IF to_regclass('public.gdp_invoices') IS NULL
     OR to_regprocedure('public.issue_admin_invoice_from_draft(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Local clone must already have fully migrated invoices to construct baseline';
  END IF;
END
$guard$;

-- Restore an invoice-free schema state from the cloned local database.
-- RESTRICT ensures any unexpected cross-feature dependency blocks this test.
DROP FUNCTION IF EXISTS public.issue_admin_invoice_from_draft(uuid) RESTRICT;
DROP FUNCTION IF EXISTS public.issue_admin_order_invoice(uuid) RESTRICT;
DROP FUNCTION IF EXISTS public.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb) RESTRICT;
DROP FUNCTION IF EXISTS public.save_admin_invoice_layout_dates(uuid,jsonb,date) RESTRICT;
DROP FUNCTION IF EXISTS public.reserve_admin_invoice_number(uuid) RESTRICT;
DROP FUNCTION IF EXISTS public.save_admin_invoice_document_meta(uuid,jsonb) RESTRICT;
DROP FUNCTION IF EXISTS public.activate_admin_draft_atomic(uuid) RESTRICT;
DROP FUNCTION IF EXISTS public.save_admin_draft_atomic(uuid,jsonb,jsonb) RESTRICT;
DROP TABLE IF EXISTS public.gdp_invoices RESTRICT;
DROP FUNCTION IF EXISTS public.prevent_gdp_invoice_mutation() RESTRICT;
ALTER TABLE public.orders DROP COLUMN IF EXISTS reserved_invoice_number RESTRICT;
ALTER TABLE public.orders DROP COLUMN IF EXISTS invoice_document_meta RESTRICT;
ALTER TABLE public.orders DROP COLUMN IF EXISTS invoice_due_date RESTRICT;
ALTER TABLE public.orders DROP COLUMN IF EXISTS invoice_payment_terms RESTRICT;
DROP SEQUENCE IF EXISTS public.gdp_invoice_number_seq RESTRICT;

DO $qa$
BEGIN
  IF to_regclass('public.gdp_invoices') IS NOT NULL
     OR to_regprocedure('public.issue_admin_invoice_from_draft(uuid)') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='orders'
         AND column_name IN ('reserved_invoice_number','invoice_document_meta','invoice_due_date','invoice_payment_terms')
     ) THEN
     RAISE EXCEPTION 'Could not prepare a clean invoice-free schema in the QA clone';
  END IF;
  RAISE NOTICE 'PASS: invoice-free baseline recreated inside disposable local clone';
END $qa$;
COMMIT;
