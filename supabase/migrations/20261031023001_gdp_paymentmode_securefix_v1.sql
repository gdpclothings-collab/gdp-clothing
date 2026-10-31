-- GDP Clothing: isolated secure payment-mode switch. Do not deploy without approval.
-- The existing payment_mode column grants, RLS policies, triggers, audit and
-- production mode are intentionally unchanged. Admins need real AAL2 (no grace).
begin;

do $preflight$
begin
  if to_regprocedure('private.set_admin_payment_mode(text,text)') is not null
     or to_regprocedure('public.set_admin_payment_mode(text,text)') is not null then
    raise exception 'payment-mode setter already exists; review migration drift';
  end if;
  if to_regprocedure('public.is_admin()') is null
     or not has_schema_privilege('authenticated','private','USAGE') then
    raise exception 'payment-mode setter prerequisites missing';
  end if;
end;
$preflight$;

-- Privileged write is necessary because authenticated deliberately has UPDATE
-- but no SELECT privilege for payment_mode. Identity + AAL2 are checked inside
-- the database before the definer performs an atomic expected-mode update.
create function private.set_admin_payment_mode(p_expected_mode text, p_next_mode text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $setter$
declare
  v_saved_mode text;
begin
  if auth.uid() is null
     or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     or not public.is_admin() then
    raise exception 'Admin MFA (AAL2) authorization required to change payment mode'
      using errcode = '42501';
  end if;

  if p_expected_mode is null or p_next_mode is null
     or p_expected_mode not in ('live','test')
     or p_next_mode not in ('live','test')
     or p_expected_mode = p_next_mode then
    raise exception 'Invalid payment-mode transition' using errcode = '22023';
  end if;

  update public.store_settings
     set payment_mode = p_next_mode
   where id = 1
     and payment_mode = p_expected_mode
  returning payment_mode into v_saved_mode;

  if not found then
    if not exists (select 1 from public.store_settings where id = 1) then
      raise exception 'Store settings missing' using errcode = 'P0002';
    end if;
    raise exception 'Payment mode changed in another session; reload settings'
      using errcode = 'P0001';
  end if;

  return v_saved_mode;
end;
$setter$;

revoke all on function private.set_admin_payment_mode(text, text) from public, anon;
grant execute on function private.set_admin_payment_mode(text, text) to authenticated;

-- Public API only forwards with invoker privileges; privileged logic stays
-- in the unexposed private schema and is not accessible to anonymous clients.
create function public.set_admin_payment_mode(p_expected_mode text, p_next_mode text)
returns text
language sql
volatile
security invoker
set search_path = ''
as $facade$
  select private.set_admin_payment_mode(p_expected_mode, p_next_mode);
$facade$;

revoke all on function public.set_admin_payment_mode(text, text) from public, anon;
grant execute on function public.set_admin_payment_mode(text, text) to authenticated;

do $verify$
begin
  if has_function_privilege('anon','public.set_admin_payment_mode(text,text)','EXECUTE')
     or has_function_privilege('anon','private.set_admin_payment_mode(text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.set_admin_payment_mode(text,text)','EXECUTE')
     or not has_function_privilege('authenticated','private.set_admin_payment_mode(text,text)','EXECUTE')
     or (select prosecdef from pg_proc where oid='public.set_admin_payment_mode(text,text)'::regprocedure)
     or not (select prosecdef from pg_proc where oid='private.set_admin_payment_mode(text,text)'::regprocedure) then
    raise exception 'Payment-mode RPC postflight security verification failed';
  end if;
end;
$verify$;

commit;
