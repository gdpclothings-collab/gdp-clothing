-- Recover a historical checkout rate-limit prerequisite for fresh local builds.
-- Existing hosted function/table are not overwritten.
create table if not exists public.checkout_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.checkout_rate_limits enable row level security;
revoke all on public.checkout_rate_limits from public, anon, authenticated;

do $recovery$
begin
  if to_regprocedure('public.consume_checkout_rate_limit(text,integer,integer)') is null then
    execute $ddl$
      create function public.consume_checkout_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
      returns jsonb
      language plpgsql
      set search_path = 'public'
      as $function$
      declare
        v_row public.checkout_rate_limits%rowtype;
        v_window interval;
        v_retry_after integer := 0;
      begin
        if p_key is null or length(trim(p_key)) < 8 then
          raise exception 'INVALID_RATE_LIMIT_KEY';
        end if;
        if p_limit < 1 or p_limit > 10000 or p_window_seconds < 1 or p_window_seconds > 86400 then
          raise exception 'INVALID_RATE_LIMIT_CONFIG';
        end if;
        v_window := make_interval(secs => p_window_seconds);
        insert into public.checkout_rate_limits(rate_key, window_started_at, request_count, updated_at)
        values (p_key, now(), 1, now())
        on conflict (rate_key) do update
          set window_started_at = case
                when public.checkout_rate_limits.window_started_at <= now() - v_window then now()
                else public.checkout_rate_limits.window_started_at end,
              request_count = case
                when public.checkout_rate_limits.window_started_at <= now() - v_window then 1
                else public.checkout_rate_limits.request_count + 1 end,
              updated_at = now()
        returning * into v_row;
        if v_row.request_count > p_limit then
          v_retry_after := greatest(1,
            ceil(extract(epoch from (v_row.window_started_at + v_window - now())))::integer);
        end if;
        return jsonb_build_object('allowed', v_row.request_count <= p_limit,
          'count', v_row.request_count, 'limit', p_limit, 'retry_after', v_retry_after);
      end
      $function$;
    $ddl$;
  end if;
end;
$recovery$;

revoke all on function public.consume_checkout_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_checkout_rate_limit(text,integer,integer) to service_role;
