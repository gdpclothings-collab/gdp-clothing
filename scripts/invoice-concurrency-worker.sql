-- Each pgbench client runs this independently in its own transaction.
-- Real public.is_admin and public.is_admin_step_up_authorized are used.
-- AAL2 JWT data is synthetic, and no authenticator credential is used.
\set ON_ERROR_STOP on
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::text, true)
FROM public.gdp_qa_concurrency_fixture;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',actor_id::text,'aal','aal2','role','authenticated')::text,
  true
) FROM public.gdp_qa_concurrency_fixture;
INSERT INTO public.gdp_qa_concurrency_calls(order_id)
  SELECT order_id FROM public.gdp_qa_concurrency_fixture;
SELECT invoice_number FROM public.issue_admin_invoice_from_draft(
  (SELECT order_id FROM public.gdp_qa_concurrency_fixture)
);
