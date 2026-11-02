-- Assertions run on a disposable PostgreSQL instance only.
do $$
declare
  r record;
begin
  for r in select 'guest_custom_upload_grants' as name
    union all select 'guest_custom_mockup_bindings'
  loop
    if not exists (select 1 from pg_class where oid = ('public.' || r.name)::regclass and relrowsecurity) then
      raise exception 'RLS must be enabled for %', r.name;
    end if;
    if has_table_privilege('anon', 'public.' || r.name, 'SELECT')
      or has_table_privilege('anon', 'public.' || r.name, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || r.name, 'SELECT')
      or has_table_privilege('authenticated', 'public.' || r.name, 'INSERT') then
      raise exception 'Client roles must not have direct table access to %', r.name;
    end if;
    if not (has_table_privilege('service_role', 'public.' || r.name, 'SELECT')
      and has_table_privilege('service_role', 'public.' || r.name, 'INSERT')
      and has_table_privilege('service_role', 'public.' || r.name, 'UPDATE')
      and has_table_privilege('service_role', 'public.' || r.name, 'DELETE')) then
      raise exception 'Service role must have full grants on %', r.name;
    end if;
  end loop;
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='guest_custom_upload_grants' and policyname='deny_client_guest_custom_upload_grants'
    and permissive='RESTRICTIVE') then
    raise exception 'Missing restrictive upload grant policy';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='guest_custom_mockup_bindings' and policyname='deny_client_guest_custom_mockup_bindings'
    and permissive='RESTRICTIVE') then
    raise exception 'Missing restrictive binding policy';
  end if;
end $$;

set role service_role;
insert into public.guest_custom_upload_grants (path, proof_hash, purpose)
values ('guest/11111111-1111-4111-8111-111111111111/front.png', repeat('a', 64), 'mockup');
insert into public.guest_custom_mockup_bindings (design_id, side, path)
values ('33333333-3333-4333-8333-333333333333', 'front', 'guest/11111111-1111-4111-8111-111111111111/front.png');
do $$
begin
  if (select count(*) from public.guest_custom_mockup_bindings) <> 1 then
    raise exception 'Service binding insert/read failed';
  end if;
end $$;
reset role;

set role anon;
do $$
begin
  begin
    perform 1 from public.guest_custom_upload_grants;
    raise exception 'Anon unexpectedly read upload grants';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.guest_custom_mockup_bindings;
    raise exception 'Anon unexpectedly read bindings';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role authenticated;
do $$
begin
  begin
    perform 1 from public.guest_custom_upload_grants;
    raise exception 'Authenticated unexpectedly read upload grants';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.guest_custom_mockup_bindings;
    raise exception 'Authenticated unexpectedly read bindings';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
