-- GDP Clothing WELCOME10 — staged migration. DO NOT APPLY WITHOUT COMPLETE GATES.
-- This migration is additive except for defensive WELCOME10 guards in legacy RPCs.
-- All ordinary coupons preserve their previous logic.
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
    where prior.id <> v_order.id and prior.payment_status in ('paid','refunded','partially_refunded')
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


create table if not exists public.welcome10_reconciliation (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id),
  stripe_event_id text not null,
  payment_intent_id text not null,
  payment_mode text not null check (payment_mode in ('test','live')),
  state text not null default 'pending' check (state in ('pending','resolved','manual_review')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  last_error_code text not null,
  constraint welcome10_reconciliation_event_unique unique (stripe_event_id),
  constraint welcome10_reconciliation_order_intent_unique unique (order_id,payment_intent_id)
);
create index if not exists welcome10_reconciliation_pending_idx
 on public.welcome10_reconciliation (last_seen_at) where state='pending';
alter table public.welcome10_reconciliation enable row level security;
revoke all on public.welcome10_reconciliation from public, anon, authenticated;
-- The caller must be a server-side verified Stripe webhook, not a browser.
create or replace function public.record_welcome10_reconciliation(
  p_order_id uuid, p_stripe_event_id text, p_payment_intent_id text,
  p_payment_mode text, p_error_code text
) returns void language plpgsql security definer
set search_path = '' as $$
begin
  if nullif(btrim(p_stripe_event_id),'') is null or
     nullif(btrim(p_payment_intent_id),'') is null or
     p_payment_mode not in ('test','live') or
     nullif(btrim(p_error_code),'') is null then
    raise exception 'invalid reconciliation input';
  end if;
  -- Refuse events that do not match a persisted paid order.
  if not exists (
    select 1 from public.orders o
    where o.id=p_order_id
      and upper(btrim(coalesce(o.discount_code,'')))='WELCOME10'
      and o.payment_status='paid'
      and o.payment_mode=p_payment_mode
      and o.stripe_payment_intent_id=p_payment_intent_id
  ) then
    raise exception 'unverified reconciliation order binding';
  end if;
  insert into public.welcome10_reconciliation
    (order_id,stripe_event_id,payment_intent_id,payment_mode,last_error_code)
  values (p_order_id,p_stripe_event_id,p_payment_intent_id,p_payment_mode,p_error_code)
  -- Coalesce different Stripe event IDs for the same paid order and intent.
  -- The first event ID remains the canonical identifier; an event ID reused
  -- for another order still violates event_unique and fails closed.
  on conflict (order_id,payment_intent_id) do update
    set attempt_count=public.welcome10_reconciliation.attempt_count+1,
        last_seen_at=now(),
        last_error_code=excluded.last_error_code
  where public.welcome10_reconciliation.order_id=excluded.order_id
    and public.welcome10_reconciliation.payment_intent_id=excluded.payment_intent_id
    and public.welcome10_reconciliation.payment_mode=excluded.payment_mode
    and public.welcome10_reconciliation.state='pending';
end $$;
revoke all on function public.record_welcome10_reconciliation(uuid,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.record_welcome10_reconciliation(uuid,text,text,text,text) to service_role;


-- Webhook-only operation; verified signature, order binding and paid intent are checked in the webhook.
-- Lock order always order -> campaign. Reservations serialize on campaign lock.
create or replace function public.redeem_welcome10_coupon(p_order_id uuid, p_signed_paid_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_discount public.discounts%rowtype;
  v_hold public.order_coupon_reservations%rowtype;
  v_existing public.coupon_redemptions%rowtype;
  v_redemption_id uuid;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or upper(btrim(coalesce(v_order.discount_code,''))) <> 'WELCOME10'
     or v_order.payment_status <> 'paid'
     or v_order.payment_mode not in ('live','test')
     or nullif(btrim(coalesce(v_order.stripe_checkout_session_id,'')),'') is null
     or nullif(btrim(coalesce(v_order.stripe_payment_intent_id,'')),'') is null
     or nullif(btrim(coalesce(v_order.customer_email,'')),'') is null then
    raise exception 'WELCOME_PAID_ORDER_NOT_VERIFIED';
  end if;

  select * into v_discount from public.discounts
  where code='WELCOME10' for update;
  if not found or v_discount.active is not true
     or v_discount.type <> 'percentage' or v_discount.value <> 10
     or v_discount.applies_to <> 'all' then
    raise exception 'WELCOME_CAMPAIGN_NOT_ACTIVE';
  end if;

  select * into v_existing from public.coupon_redemptions where order_id=p_order_id;
  if found then
    if v_existing.discount_id=v_discount.id then
      return jsonb_build_object('redeemed',true,'existing',true);
    end if;
    raise exception 'WELCOME_OTHER_COUPON_ALREADY_REDEEMED';
  end if;

  select * into v_hold from public.order_coupon_reservations where order_id=p_order_id for update;
  if not found or v_hold.discount_id<>v_discount.id or v_hold.status<>'active' then
    raise exception 'WELCOME_ACTIVE_RESERVATION_REQUIRED';
  end if;
  -- A signed Stripe event timestamp is supplied by the verified webhook, never
  -- by the customer. Delayed webhook delivery alone must not invalidate a
  -- payment completed before its reservation expired.
  if p_signed_paid_at is null or p_signed_paid_at < v_hold.created_at
     or p_signed_paid_at > v_hold.expires_at then
    raise exception 'WELCOME_PAID_OUTSIDE_RESERVATION_REVIEW_REQUIRED';
  end if;

  if exists (
    select 1 from public.orders prior
    where prior.id<>v_order.id
      and prior.payment_status in ('paid','refunded','partially_refunded')
      and (lower(btrim(prior.customer_email))=lower(btrim(v_order.customer_email))
           or (v_order.user_id is not null and prior.user_id=v_order.user_id))
  ) then
    raise exception 'WELCOME_NOT_FIRST_ORDER';
  end if;
  if exists (
    select 1 from public.coupon_redemptions redeemed
    join public.orders prior on prior.id=redeemed.order_id
    where redeemed.discount_id=v_discount.id
      and (lower(btrim(prior.customer_email))=lower(btrim(v_order.customer_email))
           or (v_order.user_id is not null and prior.user_id=v_order.user_id))
  ) then
    raise exception 'WELCOME_IDENTITY_ALREADY_REDEEMED';
  end if;
  if v_order.discount is null or v_order.discount<=0 or v_order.discount>15
     or v_order.discount>round(v_order.subtotal*0.10,2) then
    raise exception 'WELCOME_DISCOUNT_OUTSIDE_LIMITS';
  end if;
  if v_discount.usage_limit is not null and v_discount.usage_count>=v_discount.usage_limit then
    raise exception 'WELCOME_USAGE_LIMIT_REACHED';
  end if;

  insert into public.coupon_redemptions(discount_id,order_id,customer_email)
  values(v_discount.id,v_order.id,v_order.customer_email)
  on conflict(order_id) do nothing returning id into v_redemption_id;
  if v_redemption_id is null then
    raise exception 'WELCOME_REDEMPTION_CONFLICT';
  end if;
  update public.discounts set usage_count=usage_count+1,updated_at=now() where id=v_discount.id;
  update public.order_coupon_reservations set status='consumed', consumed_at=now()
  where id=v_hold.id and status='active';
  return jsonb_build_object('redeemed',true,'existing',false);
end;
$$;
revoke all on function public.redeem_welcome10_coupon(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.redeem_welcome10_coupon(uuid,timestamptz) to service_role;

create or replace function public.resolve_welcome10_reconciliation(p_order_id uuid,p_payment_intent_id text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.orders o join public.coupon_redemptions r on r.order_id=o.id
    join public.discounts d on d.id=r.discount_id
    where o.id=p_order_id and o.payment_status='paid' and d.code='WELCOME10'
      and o.stripe_payment_intent_id=p_payment_intent_id) then
    raise exception 'WELCOME_RECONCILIATION_UNVERIFIED';
  end if;
  update public.welcome10_reconciliation
    set state='resolved',resolved_at=now(),last_seen_at=now()
    where order_id=p_order_id and payment_intent_id=p_payment_intent_id and state='pending';
  return found;
end $$;
revoke all on function public.resolve_welcome10_reconciliation(uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_welcome10_reconciliation(uuid,text) to service_role;

-- WELCOME10 activation prerequisites: signed Stripe test, guest/login verification,
-- server setting WELCOME10_PROMO_ENABLED=true, and independent production release approval.
-- Campaign is created INACTIVE by default; migration alone must not grant discounts.
insert into public.discounts(code,type,value,applies_to,active,usage_count)
values ('WELCOME10','percentage',10,'all',false,0)
on conflict(code) do nothing;

