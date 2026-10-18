-- Accept both Supabase legacy and current verified JWT claim formats.
-- Public/browser grants remain revoked; execution stays service-role only.
create or replace function public.admin_cleanup_list_storage_files(p_bucket text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $body$
declare
  v_total integer;
  v_files jsonb;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '') <> 'service_role' then
    raise exception 'Service-only operation' using errcode = '42501';
  end if;
  if p_bucket not in ('customer-uploads','dtf-artwork') or p_bucket is null then
    raise exception 'Protected storage bucket' using errcode = '42501';
  end if;
  select count(*) into v_total from storage.objects where bucket_id=p_bucket;
  if v_total > 2000 then
    raise exception 'Too many upload files for safe cleanup preview';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'path', name,
    'created_at', created_at,
    'updated_at', updated_at,
    'bytes', case when (metadata->>'size') ~ '^[0-9]+$'
      then (metadata->>'size')::bigint else 0 end
  ) order by name), '[]'::jsonb)
  into v_files from storage.objects where bucket_id=p_bucket;
  return v_files;
end
$body$;
revoke all on function public.admin_cleanup_list_storage_files(text) from public, anon, authenticated;
grant execute on function public.admin_cleanup_list_storage_files(text) to service_role;

create or replace function public.admin_cleanup_delete_test_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $body$
declare
  v public.orders%rowtype;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '') <> 'service_role' then
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