-- GDP Clothing: concurrent issuance verification, CLONE database only.
\set ON_ERROR_STOP on
DO $qa$
DECLARE
  v_order uuid;
  v_reserved text;
  v_invoice_count integer;
  v_call_count integer;
  v_gap_ms numeric;
  v_order_status text;
  v_payment_status text;
  v_total numeric;
  v_issued_number text;
  v_issued_by uuid;
  v_issued_id uuid;
  v_ledger_snapshot jsonb;
  v_return_count integer;
  v_distinct_return_ids integer;
  v_distinct_return_numbers integer;
  v_matching_returns integer;
  v_actor uuid;
BEGIN
  IF current_database() !~ '^(gdp_invoice_qa|gdp_invoice_atomic)_[0-9a-f]{8}$' OR inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'REFUSING concurrent issuance check outside disposable clone';
  END IF;
  SELECT order_id,reserved_number,actor_id INTO STRICT v_order,v_reserved,v_actor
  FROM public.gdp_qa_concurrency_fixture;
  SELECT count(*),EXTRACT(EPOCH FROM max(started_at)-min(started_at))*1000
  INTO v_call_count,v_gap_ms
  FROM public.gdp_qa_concurrency_calls WHERE order_id=v_order;
  IF v_call_count<>2 THEN
    RAISE EXCEPTION 'Expected exactly 2 committed concurrent calls; found %',v_call_count;
  END IF;
  IF v_gap_ms>2300 THEN
    RAISE EXCEPTION 'Connections did not sufficiently overlap (gap % ms); retry the test',round(v_gap_ms);
  END IF;
  RAISE NOTICE 'PASS: two independent issuance clients overlapped by design (start gap: % ms)',round(v_gap_ms);

  SELECT count(*) INTO v_invoice_count
  FROM public.gdp_invoices WHERE order_id=v_order;
  IF v_invoice_count<>1 THEN
    RAISE EXCEPTION 'Concurrency failure: expected exactly one invoice, found %',v_invoice_count;
  END IF;
  SELECT id,invoice_number,issued_by,snapshot
  INTO STRICT v_issued_id,v_issued_number,v_issued_by,v_ledger_snapshot
  FROM public.gdp_invoices WHERE order_id=v_order;
  IF v_issued_number IS DISTINCT FROM v_reserved
     OR v_issued_by IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Concurrency failure: reserved invoice number or issuer mismatched';
  END IF;
  RAISE NOTICE 'PASS: exactly one invoice ledger row; reserved number and actor preserved';
  IF NOT (v_ledger_snapshot ? 'invoice_due_date')
     OR v_ledger_snapshot->>'invoice_due_date' IS DISTINCT FROM '2026-10-31'
     OR v_ledger_snapshot->>'invoice_payment_terms' IS DISTINCT FROM 'Net 7' THEN
    RAISE EXCEPTION 'Invoice snapshot missing immutable payment due date or terms. Apply local migration 20261011043000 before retesting.';
  END IF;
  RAISE NOTICE 'PASS: original payment due date and terms frozen in invoice snapshot';

  SELECT count(*),count(DISTINCT invoice_id),count(DISTINCT invoice_number),
         count(*) FILTER (
           WHERE invoice_id=v_issued_id AND invoice_number=v_reserved
         )
  INTO v_return_count,v_distinct_return_ids,v_distinct_return_numbers,v_matching_returns
  FROM public.gdp_qa_concurrency_results WHERE order_id=v_order;
  IF v_return_count<>2 OR v_distinct_return_ids<>1
     OR v_distinct_return_numbers<>1 OR v_matching_returns<>2 THEN
    RAISE EXCEPTION 'Concurrency failure: RPC results differed: count %, IDs %, numbers %, matching %',
      v_return_count,v_distinct_return_ids,v_distinct_return_numbers,v_matching_returns;
  END IF;
  RAISE NOTICE 'PASS: BOTH overlapping RPCs returned the SAME invoice ID and number';

  SELECT status,payment_status,total
  INTO STRICT v_order_status,v_payment_status,v_total
  FROM public.orders WHERE id=v_order;
  IF v_order_status IS DISTINCT FROM 'pending_payment'
     OR v_payment_status IS DISTINCT FROM 'pending'
     OR v_total IS DISTINCT FROM 44.40 THEN
    RAISE EXCEPTION 'Concurrent issuance changed payment or totals unexpectedly';
  END IF;
  RAISE NOTICE 'PASS: order activated once, remains unpaid; totals unchanged';
END $qa$;
