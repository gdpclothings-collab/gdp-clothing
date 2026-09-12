-- Refine checkout replay state using existing checkout_sessions hardening columns.

create or replace function public.claim_checkout_session(p_session_token uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
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
    set status = 'expired', processing_started_at = null, last_activity_at = now()
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
  set status = 'processing', processing_started_at = now(), last_activity_at = now()
  where id = v_session.id;

  return jsonb_build_object(
    'claimed', true,
    'status', 'processing',
    'converted_order_id', v_session.converted_order_id
  );
end;
$$;

create or replace function public.release_checkout_session_claim(p_session_token uuid)
returns boolean
language plpgsql
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  update public.checkout_sessions
  set status = 'active',
      converted_order_id = null,
      stripe_checkout_session_id = null,
      stripe_client_secret = null,
      processing_started_at = null,
      last_activity_at = now()
  where session_token = p_session_token
    and status = 'processing';

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke execute on function public.claim_checkout_session(uuid) from public, anon, authenticated;
revoke execute on function public.release_checkout_session_claim(uuid) from public, anon, authenticated;
grant execute on function public.claim_checkout_session(uuid) to service_role;
grant execute on function public.release_checkout_session_claim(uuid) to service_role;
