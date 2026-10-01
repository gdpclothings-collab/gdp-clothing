-- Require a live checkout-gateway claim before the server-side checkout core
-- may create a new pending-payment order. This closes direct calls to the
-- public checkout Edge Function from bypassing gateway rate/session controls.

alter table public.checkout_sessions
  add column if not exists gateway_claim_consumed boolean not null default false;

create or replace function public.claim_checkout_session(p_session_token uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_session public.checkout_sessions%rowtype;
  v_started_at timestamptz;
begin
  select * into v_session
  from public.checkout_sessions
  where session_token = p_session_token
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'status', 'missing');
  end if;

  if v_session.expires_at is not null and v_session.expires_at <= now() then
    update public.checkout_sessions
    set status = 'expired',
        processing_started_at = null,
        gateway_claim_consumed = false,
        last_activity_at = now()
    where id = v_session.id;
    return jsonb_build_object('claimed', false, 'status', 'expired');
  end if;

  if v_session.status = 'converted' then
    return jsonb_build_object(
      'claimed', false,
      'status', 'converted',
      'converted_order_id', v_session.converted_order_id
    );
  end if;

  v_started_at := coalesce(v_session.processing_started_at, v_session.last_activity_at);
  if v_session.status = 'processing' and v_started_at > now() - interval '10 minutes' then
    return jsonb_build_object(
      'claimed', false,
      'status', 'processing',
      'converted_order_id', v_session.converted_order_id
    );
  end if;

  if v_session.status not in ('active', 'processing') then
    return jsonb_build_object('claimed', false, 'status', v_session.status);
  end if;

  update public.checkout_sessions
  set status = 'processing',
      processing_started_at = now(),
      gateway_claim_consumed = false,
      last_activity_at = now()
  where id = v_session.id;

  return jsonb_build_object(
    'claimed', true,
    'status', 'processing',
    'converted_order_id', v_session.converted_order_id
  );
end;
$function$;

create or replace function public.release_checkout_session_claim(p_session_token uuid)
returns boolean
language plpgsql
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  update public.checkout_sessions
  set status = 'active',
      converted_order_id = null,
      stripe_checkout_session_id = null,
      stripe_client_secret = null,
      processing_started_at = null,
      gateway_claim_consumed = false,
      last_activity_at = now()
  where session_token = p_session_token
    and status = 'processing';

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;

create or replace function public.enforce_checkout_gateway_claim()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_session_id uuid;
begin
  -- Gate only the initial server-side checkout order insert. Existing admin
  -- and operational order-management workflows are intentionally unaffected.
  if current_user <> 'service_role'
     or new.status <> 'pending_payment'
     or new.payment_status <> 'pending'
     or new.stripe_checkout_session_id is not null then
    return new;
  end if;

  select s.id
    into v_session_id
  from public.checkout_sessions s
  where s.status = 'processing'
    and s.gateway_claim_consumed = false
    and s.processing_started_at is not null
    and s.processing_started_at > now() - interval '10 minutes'
    and (s.expires_at is null or s.expires_at > now())
    and lower(trim(coalesce(s.customer_email, ''))) = lower(trim(coalesce(new.customer_email, '')))
    and (s.user_id is null or new.user_id is null or s.user_id = new.user_id)
  order by s.processing_started_at desc
  for update
  limit 1;

  if v_session_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'CHECKOUT_GATEWAY_REQUIRED';
  end if;

  update public.checkout_sessions
  set gateway_claim_consumed = true,
      last_activity_at = now()
  where id = v_session_id
    and gateway_claim_consumed = false;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CHECKOUT_GATEWAY_CLAIM_ALREADY_CONSUMED';
  end if;

  return new;
end;
$function$;

drop trigger if exists orders_require_checkout_gateway_claim on public.orders;
create trigger orders_require_checkout_gateway_claim
before insert on public.orders
for each row
execute function public.enforce_checkout_gateway_claim();

revoke all on function public.enforce_checkout_gateway_claim() from public, anon, authenticated;
grant execute on function public.enforce_checkout_gateway_claim() to service_role;
