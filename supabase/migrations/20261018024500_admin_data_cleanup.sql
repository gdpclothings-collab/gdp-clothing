-- Admin Data Cleanup: durable audit + least-privilege helpers.
-- Never relax RLS or grant storage/auth access to browser roles.
create table if not exists public.admin_cleanup_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  operation text not null check (operation in ('file_delete', 'order_delete', 'account_delete')),
  target_ref text not null,
  outcome text not null check (outcome in ('success', 'failed')),
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists admin_cleanup_audit_recent_idx
on public.admin_cleanup_audit_log(created_at desc);
alter table public.admin_cleanup_audit_log enable row level security;
revoke all on public.admin_cleanup_audit_log from public, anon, authenticated;
revoke all on sequence public.admin_cleanup_audit_log_id_seq from public, anon, authenticated;
revoke update, delete, truncate on public.admin_cleanup_audit_log from service_role;
grant select, insert on public.admin_cleanup_audit_log to service_role;
grant usage, select on sequence public.admin_cleanup_audit_log_id_seq to service_role;

-- Service-only diagnostic for account removal; object deletion itself MUST use
-- Supabase Storage API (never SQL DELETE on storage.objects).
create or replace function public.admin_cleanup_owned_storage_count(p_user_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $body$
  select count(*)::integer from storage.objects where owner_id = p_user_id::text;
$body$;
revoke all on function public.admin_cleanup_owned_storage_count(uuid) from public, anon, authenticated;
grant execute on function public.admin_cleanup_owned_storage_count(uuid) to service_role;

-- Atomic, conservative order removal. Invoked ONLY by authenticated, AAL2-checked
-- admin Edge Function using service_role, and only for unpaid/test records.
create or replace function public.admin_cleanup_delete_test_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $body$
declare
  v public.orders%rowtype;
begin
  if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' then
    raise exception 'Service-only operation' using errcode='42501';
  end if;
  select * into v from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if (v.payment_mode not in ('test','live') or v.payment_mode is null)
    or (v.payment_mode='live' and (v.stripe_payment_intent_id is not null or v.stripe_checkout_session_id is not null))
    or coalesce(v.payment_status,'') in ('paid','refunded','partially_refunded')
    or coalesce(v.status,'') in ('paid','completed','fulfilled','shipped','delivered','refunded','partially_refunded')
    or coalesce(v.fulfillment_status,'') in ('fulfilled','shipped','out_for_delivery','delivered','picked_up')
    or not (
       v.payment_mode='test'
       or (v.payment_mode='live' and v.payment_status in ('failed','pending')
         and v.status in ('payment_failed','cancelled','pending_payment','draft'))
    )
  then raise exception 'Protected order: deletion not allowed'; end if;
  if exists(select 1 from public.order_inventory_reservations
     where order_id=p_order_id and status in ('active','reserved','consumed'))
   or exists(select 1 from public.order_coupon_reservations
     where order_id=p_order_id and status in ('consumed','redeemed'))
   or exists(select 1 from public.finance_ledger_source_postings
     where source_domain='order' and source_record_id=p_order_id::text)
   or exists(select 1 from public.gdp_invoices where order_id=p_order_id)
   or exists(select 1 from public.refunds where order_id=p_order_id)
   or exists(select 1 from public.returns where order_id=p_order_id)
   or exists(select 1 from public.welcome10_reconciliation where order_id=p_order_id)
  then raise exception 'Order has protected commerce dependencies'; end if;
  -- A converted guest session cannot be SET NULL because of its consistency
  -- constraint; delete it before deleting the linked order.
  delete from public.guest_design_sessions where converted_order_id=p_order_id;
  delete from public.checkout_sessions where converted_order_id=p_order_id;
  delete from public.orders where id=p_order_id;
  return jsonb_build_object('deleted',true,'order_number',v.order_number);
end
$body$;
revoke all on function public.admin_cleanup_delete_test_order(uuid) from public, anon, authenticated;
grant execute on function public.admin_cleanup_delete_test_order(uuid) to service_role;