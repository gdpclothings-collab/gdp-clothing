-- Production checkout/security hardening.
-- Applied to Supabase production after branch validation.

create or replace function public.claim_checkout_session(p_session_token uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_session public.checkout_sessions%rowtype;
begin
  select *
    into v_session
  from public.checkout_sessions
  where session_token = p_session_token
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'status', 'missing');
  end if;

  if v_session.expires_at <= now() then
    update public.checkout_sessions
    set status = 'expired', last_activity_at = now()
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

  if v_session.status = 'processing'
     and v_session.last_activity_at > now() - interval '10 minutes' then
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
  set status = 'processing', last_activity_at = now()
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
      last_activity_at = now()
  where session_token = p_session_token
    and status = 'processing';

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke execute on function public.claim_checkout_session(uuid) from public, anon, authenticated;
revoke execute on function public.release_checkout_session_claim(uuid) from public, anon, authenticated;
revoke execute on function public.consume_checkout_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_checkout_session(uuid) to service_role;
grant execute on function public.release_checkout_session_claim(uuid) to service_role;
grant execute on function public.consume_checkout_rate_limit(text, integer, integer) to service_role;

create index if not exists dtf_export_audit_log_order_id_idx on public.dtf_export_audit_log(order_id);
create index if not exists dtf_export_audit_log_order_item_id_idx on public.dtf_export_audit_log(order_item_id);
create index if not exists dtf_export_audit_log_user_id_idx on public.dtf_export_audit_log(user_id);
create index if not exists order_activity_events_actor_user_id_idx on public.order_activity_events(actor_user_id);
create index if not exists payment_mode_audit_log_changed_by_idx on public.payment_mode_audit_log(changed_by);
create index if not exists security_incidents_created_by_idx on public.security_incidents(created_by);

update storage.buckets
set file_size_limit = 41943040,
    allowed_mime_types = array['image/png','image/jpeg','image/webp']::text[]
where id = 'customer-uploads';
