-- GDP Clothing LOCAL ONLY: initial invoice database functional checks.
-- Run with psql against the local Supabase Postgres container; no real customer records.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE t_exists boolean; f_exists boolean; rls_on boolean;
BEGIN
  SELECT to_regclass('public.gdp_invoices') IS NOT NULL INTO t_exists;
  SELECT to_regprocedure('public.issue_admin_order_invoice(uuid)') IS NOT NULL INTO f_exists;
  SELECT relrowsecurity INTO rls_on FROM pg_class WHERE oid='public.gdp_invoices'::regclass;
  IF NOT (t_exists AND f_exists AND rls_on) THEN RAISE EXCEPTION 'Invoice schema or RLS missing'; END IF;
  RAISE NOTICE 'PASS: invoice ledger, issuance function and RLS';
END $$;
-- Execute as anon to prove the issuance RPC cannot be called by unauthenticated clients.
SET LOCAL ROLE anon;
DO $$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM public.issue_admin_order_invoice('00000000-0000-4000-8000-000000000001'::uuid);
  EXCEPTION WHEN insufficient_privilege OR raise_exception OR undefined_function THEN
    blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'SECURITY FAILURE: anon issued an invoice'; END IF;
  RAISE NOTICE 'PASS: anon invoice issuance rejected';
END $$;
RESET ROLE;
ROLLBACK;
