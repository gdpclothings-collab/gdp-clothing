-- REVIEW ONLY. DO NOT RUN ON PRODUCTION.
-- Dedicated durable WELCOME10 reconciliation queue, independent of legacy coupons.
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
-- REVIEW BLOCKERS: exact schema verification; canonical first event ID does not
-- provide a complete per-event audit; event-ID collision across orders must
-- fail closed; trusted webhook caller must verify signature
-- and order binding; recovery must be service-only, idempotent, audited, and
-- require verified payment before invoking redeem_welcome10_coupon.
