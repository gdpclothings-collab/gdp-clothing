begin;

-- Keep Stripe dispute mutations service-role only, while allowing the stepped-up
-- GDP admin session to read dispute rows for the Finance dashboard.
revoke all on table public.payment_disputes from public, anon, authenticated;
grant select on table public.payment_disputes to authenticated;

drop policy if exists payment_disputes_admin_select on public.payment_disputes;
create policy payment_disputes_admin_select
  on public.payment_disputes
  for select
  to authenticated
  using (public.is_admin_step_up_authorized());

-- The snapshot no longer needs owner privileges. It now runs under the caller's
-- identity and is constrained by the existing order/refund/expense policies plus
-- the read-only dispute policy above.
alter function public.get_admin_finance_snapshot(timestamptz, timestamptz, integer)
  security invoker;

comment on function public.get_admin_finance_snapshot(timestamptz, timestamptz, integer) is
  'AAL2/admin-only, SECURITY INVOKER finance snapshot. Excludes Stripe test-mode orders and uses RLS-protected reads for orders, refunds, expenses and disputes.';

commit;
