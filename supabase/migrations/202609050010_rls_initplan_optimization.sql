-- Optimize existing GDP Clothing RLS policies without changing authorization semantics.
-- Supabase recommends wrapping stable auth/helper calls in SELECT so Postgres
-- evaluates them once per statement rather than once per row.

alter policy "checkout_sessions_owner_read"
on public.checkout_sessions
using ((user_id = (select auth.uid())) or (select is_admin()));

alter policy "custom_designs_delete_own_or_admin"
on public.custom_designs
using ((user_id = (select auth.uid())) or (select is_admin()));

alter policy "custom_designs_insert_own"
on public.custom_designs
with check (user_id = (select auth.uid()));

alter policy "custom_designs_select_own_or_admin"
on public.custom_designs
using ((user_id = (select auth.uid())) or (select is_admin()));

alter policy "custom_designs_update_own_or_admin"
on public.custom_designs
using ((user_id = (select auth.uid())) or (select is_admin()))
with check ((user_id = (select auth.uid())) or (select is_admin()));

alter policy "design_proofs_select_customer_or_admin"
on public.design_proofs
using (
  (select is_admin())
  or exists (
    select 1
    from public.custom_designs d
    where d.id = design_proofs.custom_design_id
      and d.user_id = (select auth.uid())
  )
);

alter policy "order_items_select_own_or_admin"
on public.order_items
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (
        o.user_id = (select auth.uid())
        or (select is_admin())
      )
  )
);

alter policy "order_status_events_select_own_or_admin"
on public.order_status_events
using (
  (select is_admin())
  or exists (
    select 1
    from public.orders o
    where o.id = order_status_events.order_id
      and o.user_id = (select auth.uid())
  )
);

alter policy "orders_select_own_or_admin"
on public.orders
using ((user_id = (select auth.uid())) or (select is_admin()));

alter policy "profiles_select_self_or_admin"
on public.profiles
using ((id = (select auth.uid())) or (select is_admin()));

alter policy "profiles_update_self_or_admin"
on public.profiles
using ((id = (select auth.uid())) or (select is_admin()))
with check (
  (select is_admin())
  or (
    id = (select auth.uid())
    and role = (select current_user_role())
  )
);

alter policy "proof_versions_select_customer_or_admin"
on public.proof_versions
using (
  (select is_admin())
  or exists (
    select 1
    from public.design_proofs dp
    join public.custom_designs d on d.id = dp.custom_design_id
    where dp.id = proof_versions.proof_id
      and d.user_id = (select auth.uid())
  )
);

alter policy "refunds_customer_read"
on public.refunds
using (
  (select is_admin())
  or exists (
    select 1
    from public.orders o
    where o.id = refunds.order_id
      and o.user_id = (select auth.uid())
  )
);

alter policy "return_items_customer_read"
on public.return_items
using (
  (select is_admin())
  or exists (
    select 1
    from public.returns r
    join public.orders o on o.id = r.order_id
    where r.id = return_items.return_id
      and o.user_id = (select auth.uid())
  )
);

alter policy "returns_customer_read"
on public.returns
using (
  (select is_admin())
  or exists (
    select 1
    from public.orders o
    where o.id = returns.order_id
      and o.user_id = (select auth.uid())
  )
);

alter policy "reviews_insert_own"
on public.reviews
with check (user_id = (select auth.uid()));

alter policy "reviews_public_approved_or_own"
on public.reviews
using (
  status = 'approved'
  or user_id = (select auth.uid())
  or (select is_admin())
);

alter policy "reviews_update_own_pending"
on public.reviews
using (
  (
    user_id = (select auth.uid())
    and status = 'pending'
  )
  or (select is_admin())
)
with check (
  (
    user_id = (select auth.uid())
    and status = 'pending'
  )
  or (select is_admin())
);

alter policy "saved_designs_owner_all"
on public.saved_designs
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter policy "support_tickets_insert_customer"
on public.support_tickets
with check (
  user_id is null
  or user_id = (select auth.uid())
);

alter policy "support_tickets_select_own_or_admin"
on public.support_tickets
using ((user_id = (select auth.uid())) or (select is_admin()));

alter policy "wishlist_owner_all"
on public.wishlist_items
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
