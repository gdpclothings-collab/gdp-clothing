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
  v_actor uuid;
BEGIN
  IF current_database() !~ '^gdp_invoice_qa_[0-9a-f]{8}$' THEN
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

  SELECT count(*),max(invoice_number),max(issued_by)
  INTO v_invoice_count,v_issued_number,v_issued_by
  FROM public.gdp_invoices WHERE order_id=v_order;
  IF v_invoice_count<>1 OR v_issued_number IS DISTINCT FROM v_reserved
     OR v_issued_by IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Concurrency failure: ledger count %, invoice %, actor match %',
      v_invoice_count,v_issued_number,v_issued_by IS NOT DISTINCT FROM v_actor;
  END IF;
  RAISE NOTICE 'PASS: exactly one invoice ledger row; reserved number and actor preserved';

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
