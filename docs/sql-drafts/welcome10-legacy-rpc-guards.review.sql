-- REVIEW ONLY: real-schema-compatible legacy WELCOME10 bypass guards.
-- DO NOT EXECUTE IN PRODUCTION. Test on disposable clone first.
-- These retain the current ordinary-coupon logic and signatures.
-- Important: locking order of legacy redeem is order -> discount.
-- Dedicated WELCOME10 functions must use a compatible lock order.
create or replace function public.reserve_order_coupon(
 p_order_id uuid, p_discount_id uuid, p_expires_at timestamptz
) returns jsonb language plpgsql set search_path to 'public' as $$
declare
 v_discount public.discounts%rowtype;
 v_active_reservations integer := 0;
begin
 if p_discount_id is null then return jsonb_build_object('reserved',false); end if;
 -- Reject before mutating any reservation rows.
 if exists (select 1 from public.discounts where id=p_discount_id
            and upper(btrim(code))='WELCOME10')
    or exists (select 1 from public.orders where id=p_order_id
            and upper(btrim(coalesce(discount_code,'')))='WELCOME10') then
   raise exception 'WELCOME10_DEDICATED_RPC_REQUIRED';
 end if;
 update public.order_coupon_reservations
 set status='expired',released_at=now()
 where discount_id=p_discount_id and status='active' and expires_at<=now();
 select * into v_discount from public.discounts where id=p_discount_id for update;
 if not found or v_discount.active is not true
    or (v_discount.starts_at is not null and v_discount.starts_at>now())
    or (v_discount.ends_at is not null and v_discount.ends_at<now()) then
   raise exception 'COUPON_NOT_AVAILABLE';
 end if;
 if exists(select 1 from public.order_coupon_reservations where order_id=p_order_id) then
   return jsonb_build_object('reserved',true,'existing',true);
 end if;
 if v_discount.usage_limit is not null then
   select count(*) into v_active_reservations
   from public.order_coupon_reservations
   where discount_id=p_discount_id and status='active' and expires_at>now();
   if v_discount.usage_count+v_active_reservations>=v_discount.usage_limit then
     raise exception 'COUPON_USAGE_LIMIT_REACHED';
   end if;
 end if;
 insert into public.order_coupon_reservations(order_id,discount_id,status,expires_at)
 values(p_order_id,p_discount_id,'active',p_expires_at);
 return jsonb_build_object('reserved',true,'existing',false);
end $$;

create or replace function public.redeem_order_coupon(p_order_id uuid)
returns jsonb language plpgsql set search_path to 'public' as $$
declare
 v_order public.orders%rowtype;
 v_discount public.discounts%rowtype;
 v_redemption_id uuid;
begin
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.discount_code is null or trim(v_order.discount_code)='' then
   return jsonb_build_object('redeemed',false,'reason','no_coupon');
 end if;
 -- Prevent the legacy webhook from redeeming WELCOME10.
 if upper(btrim(v_order.discount_code))='WELCOME10' then
   raise exception 'WELCOME10_DEDICATED_RPC_REQUIRED';
 end if;
 select * into v_discount from public.discounts
 where code=upper(trim(v_order.discount_code)) for update;
 if not found then return jsonb_build_object('redeemed',false,'reason','coupon_missing'); end if;
 if upper(btrim(v_discount.code))='WELCOME10' then
   raise exception 'WELCOME10_DEDICATED_RPC_REQUIRED';
 end if;
 insert into public.coupon_redemptions(discount_id,order_id,customer_email)
 values(v_discount.id,p_order_id,v_order.customer_email)
 on conflict(order_id) do nothing returning id into v_redemption_id;
 if v_redemption_id is null then
   return jsonb_build_object('redeemed',false,'reason','already_redeemed');
 end if;
 update public.discounts set usage_count=usage_count+1,updated_at=now()
 where id=v_discount.id;
 update public.order_coupon_reservations set status='consumed',consumed_at=now()
 where order_id=p_order_id and status='active';
 return jsonb_build_object('redeemed',true,'discount_id',v_discount.id);
end $$;
-- BLOCKERS: transactional schema regression QA, privilege audit,
-- checkout verified identity, dedicated WELCOME10 RPC, Stripe webhook integration.
