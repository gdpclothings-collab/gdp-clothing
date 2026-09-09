create schema if not exists private;

create table if not exists private.background_removal_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  window_seconds integer not null check (window_seconds > 0),
  request_count integer not null default 0 check (request_count >= 0),
  last_request_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (scope, key_hash, window_start)
);

create index if not exists background_removal_rate_limits_last_request_idx
  on private.background_removal_rate_limits (last_request_at);

revoke all on schema private from public, anon, authenticated;
revoke all on private.background_removal_rate_limits from public, anon, authenticated;

drop function if exists public.consume_background_removal_quota(text, text, integer, integer, integer);

create function public.consume_background_removal_quota(
  p_scope text,
  p_key_hash text,
  p_window_seconds integer,
  p_limit integer,
  p_cooldown_seconds integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_epoch bigint;
  v_window_start timestamptz;
  v_row private.background_removal_rate_limits%rowtype;
  v_retry_after integer := 0;
begin
  if coalesce(length(p_scope), 0) = 0
     or coalesce(length(p_key_hash), 0) < 16
     or p_window_seconds < 1
     or p_limit < 1
     or p_cooldown_seconds < 0 then
    raise exception 'invalid rate limit arguments';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_key_hash || ':' || p_window_seconds::text, 0));

  v_epoch := floor(extract(epoch from v_now) / p_window_seconds)::bigint * p_window_seconds;
  v_window_start := to_timestamp(v_epoch);

  select * into v_row
  from private.background_removal_rate_limits
  where scope = p_scope
    and key_hash = p_key_hash
    and window_start = v_window_start
  for update;

  if found then
    if p_cooldown_seconds > 0
       and v_row.last_request_at > v_now - make_interval(secs => p_cooldown_seconds) then
      v_retry_after := greatest(1, ceil(extract(epoch from (v_row.last_request_at + make_interval(secs => p_cooldown_seconds) - v_now)))::integer);
      return jsonb_build_object(
        'allowed', false,
        'reason', 'cooldown',
        'scope', p_scope,
        'retry_after_seconds', v_retry_after,
        'remaining', greatest(0, p_limit - v_row.request_count)
      );
    end if;

    if v_row.request_count >= p_limit then
      v_retry_after := greatest(1, ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer);
      return jsonb_build_object(
        'allowed', false,
        'reason', 'limit',
        'scope', p_scope,
        'retry_after_seconds', v_retry_after,
        'remaining', 0
      );
    end if;

    update private.background_removal_rate_limits
      set request_count = request_count + 1,
          last_request_at = v_now
      where scope = p_scope
        and key_hash = p_key_hash
        and window_start = v_window_start
      returning * into v_row;
  else
    insert into private.background_removal_rate_limits (
      scope, key_hash, window_start, window_seconds, request_count, last_request_at
    ) values (
      p_scope, p_key_hash, v_window_start, p_window_seconds, 1, v_now
    ) returning * into v_row;
  end if;

  if random() < 0.02 then
    delete from private.background_removal_rate_limits
    where last_request_at < v_now - interval '3 days';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'scope', p_scope,
    'retry_after_seconds', 0,
    'remaining', greatest(0, p_limit - v_row.request_count),
    'count', v_row.request_count
  );
end;
$$;

revoke all on function public.consume_background_removal_quota(text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_background_removal_quota(text, text, integer, integer, integer) to service_role;
