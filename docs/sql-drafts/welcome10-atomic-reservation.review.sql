-- REVIEW DRAFT ONLY. NOT A MIGRATION. DO NOT RUN IN PRODUCTION.
-- Requires local PostgreSQL test, verified email ownership at checkout, and webhook integration.
-- This is a separate WELCOME10 reservation function; legacy coupons are untouched.
-- Server-only RPC: no anon/authenticated execute. The caller must have already
-- verified email ownership; the database checks identity against the order.
create or replace function public.reserve_welcome10_coupon(
  p_order_id uuid,
  p_discount_id uuid,
  p_expires_at timestamptz,
  p_verified_email text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_discount public.discounts%rowtype;
  v_email text;
begin
  v_email := lower(btrim(coalesce(p_verified_email, '')));
  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'WELCOME_EMAIL_NOT_VERIFIED';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'WELCOME_RESERVATION_EXPIRY_INVALID';
  end if;

  -- Lock order: ORDER then DISCOUNT. This matches the legacy redemption RPC.
  -- The campaign row still serializes all WELCOME10 reservations.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or lower(btrim(coalesce(v_order.customer_email,''))) <> v_email
     or upper(btrim(coalesce(v_order.discount_code,''))) <> 'WELCOME10'
     or v_order.payment_status <> 'pending' then
    raise exception 'WELCOME_ORDER_MISMATCH';
  end if;

  select * into v_discount from public.discounts
  where id = p_discount_id for update;
  if not found or upper(btrim(v_discount.code)) <> 'WELCOME10'
     or v_discount.active is not true
     or (v_discount.starts_at is not null and v_discount.starts_at > now())
     or (v_discount.ends_at is not null and v_discount.ends_at < now())
     or v_discount.type <> 'percentage' or v_discount.value <> 10 then
    raise exception 'WELCOME_CAMPAIGN_UNAVAILABLE';
  end if;

  -- Match BOTH verified email and user_id when available.
  if exists (
    select 1 from public.orders prior
    where prior.id <> v_order.id and prior.payment_status = 'paid'
      and (lower(btrim(prior.customer_email)) = v_email
           or (v_order.user_id is not null and prior.user_id = v_order.user_id))
  ) then
    raise exception 'WELCOME_PREVIOUS_PAID_ORDER';
  end if;

  -- Check redemptions independently of the order payment status.
  if exists (
    select 1 from public.coupon_redemptions redeemed
    join public.orders prior on prior.id = redeemed.order_id
    where redeemed.discount_id = p_discount_id
      and (lower(btrim(prior.customer_email)) = v_email
           or (v_order.user_id is not null and prior.user_id = v_order.user_id))
  ) then
    raise exception 'WELCOME_ALREADY_REDEEMED';
  end if;

  -- Expire stale holds before testing for an active hold.
  update public.order_coupon_reservations hold
  set status = 'expired', released_at = now()
  where hold.discount_id = p_discount_id and hold.status = 'active'
    and hold.expires_at <= now();

  if exists (
    select 1 from public.order_coupon_reservations hold
    join public.orders prior on prior.id = hold.order_id
    where hold.discount_id = p_discount_id and hold.status = 'active'
      and hold.expires_at > now() and hold.order_id <> p_order_id
      and (lower(btrim(prior.customer_email)) = v_email
           or (v_order.user_id is not null and prior.user_id = v_order.user_id))
  ) then
    raise exception 'WELCOME_ALREADY_RESERVED';
  end if;

  if exists (select 1 from public.order_coupon_reservations where order_id = p_order_id) then
    -- Only an existing ACTIVE reservation for this same campaign is idempotent.
    if exists (
      select 1 from public.order_coupon_reservations
      where order_id = p_order_id and discount_id = p_discount_id
        and status = 'active' and expires_at > now()
    ) then
      return jsonb_build_object('reserved', true, 'existing', true);
    end if;
    raise exception 'WELCOME_RESERVATION_CONFLICT';
  end if;

  if v_discount.usage_limit is not null and
     v_discount.usage_count + (
       select count(*) from public.order_coupon_reservations
       where discount_id = p_discount_id and status = 'active' and expires_at > now()
     ) >= v_discount.usage_limit then
    raise exception 'WELCOME_USAGE_LIMIT';
  end if;

  insert into public.order_coupon_reservations(order_id,discount_id,status,expires_at)
  values (p_order_id,p_discount_id,'active',p_expires_at);
  return jsonb_build_object('reserved',true,'existing',false);
end;
$$;

revoke all on function public.reserve_welcome10_coupon(uuid,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.reserve_welcome10_coupon(uuid,uuid,timestamptz,text) to service_role;

-- IMPORTANT REMAINING GATES:
-- 1. Caller-provided verified email MUST come from server-validated OTP/session, not browser text.
-- 2. Check all prior paid orders, not just orders with WELCOME10, including test/live policy.
-- 3. Payment webhook must refuse to redeem WELCOME10 without matching active reservation.
-- 4. Current webhook logs coupon RPC errors; it must fail/alert safely for welcome redemptions.
-- 5. Add a DB constraint/trigger against out-of-band WELCOME10 redemption paths.
-- 6. Rehearse concurrent transactions and rollback in disposable PostgreSQL.
-- 7. Audit every other RPC touching these rows for consistent lock ordering.
-- 8. This lock-order change alone does not solve webhook identity proof or recovery.
