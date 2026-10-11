-- GDP Clothing: least-privilege hardening of the new official invoice sequence.
-- Forward-only and additive to the database-only PR #481 release already installed
-- as consolidated remote migration 20261011161818.
--
-- Supabase default sequence grants currently expose nextval/setval via USAGE
-- and UPDATE to anon/authenticated. Security-definer invoice functions execute
-- as their privileged owner; direct customer roles do NOT need sequence rights.
-- Do not execute this migration on production without separate approval.
DO $pr481_invoice_seq$
BEGIN
 IF to_regclass('public.gdp_invoice_number_seq') IS NULL
    OR to_regprocedure('public.issue_admin_order_invoice(uuid)') IS NULL
    OR to_regprocedure('public.issue_admin_invoice_from_draft(uuid)') IS NULL
 THEN
   RAISE EXCEPTION 'Invoice ledger not installed; refusing sequence grants update';
 END IF;
END
$pr481_invoice_seq$;

REVOKE ALL PRIVILEGES ON SEQUENCE public.gdp_invoice_number_seq
FROM PUBLIC, anon, authenticated;

DO $pr481_invoice_seq_verify$
BEGIN
 IF has_sequence_privilege('anon','public.gdp_invoice_number_seq','USAGE')
    OR has_sequence_privilege('anon','public.gdp_invoice_number_seq','UPDATE')
    OR has_sequence_privilege('authenticated','public.gdp_invoice_number_seq','USAGE')
    OR has_sequence_privilege('authenticated','public.gdp_invoice_number_seq','UPDATE')
 THEN
  RAISE EXCEPTION 'Invoice number sequence privileges remain too broad; transaction must roll back';
 END IF;
END
$pr481_invoice_seq_verify$;
