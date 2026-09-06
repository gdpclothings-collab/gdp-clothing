begin;

alter table public.store_settings
  add column if not exists homepage_version integer not null default 1,
  add column if not exists homepage_published_at timestamptz,
  add column if not exists homepage_updated_at timestamptz not null default now();

update public.store_settings
set
  homepage_version = greatest(coalesce(homepage_version, 1), 1),
  homepage_published_at = coalesce(homepage_published_at, now()),
  homepage_updated_at = coalesce(homepage_updated_at, now())
where id = 1;

create table if not exists public.landing_page_draft (
  id smallint primary key default 1 check (id = 1),
  content jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.landing_page_draft (id, content, updated_by, updated_at)
select 1, homepage, null, now()
from public.store_settings
where id = 1
on conflict (id) do nothing;

alter table public.landing_page_draft enable row level security;

drop policy if exists "landing_page_draft_admin_select" on public.landing_page_draft;
create policy "landing_page_draft_admin_select"
  on public.landing_page_draft
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "landing_page_draft_admin_insert" on public.landing_page_draft;
create policy "landing_page_draft_admin_insert"
  on public.landing_page_draft
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "landing_page_draft_admin_update" on public.landing_page_draft;
create policy "landing_page_draft_admin_update"
  on public.landing_page_draft
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.landing_page_draft from anon;
revoke all on table public.landing_page_draft from authenticated;
grant select, insert, update on table public.landing_page_draft to authenticated;
grant all on table public.landing_page_draft to service_role;

create table if not exists public.landing_page_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  content jsonb not null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now()
);

create index if not exists landing_page_versions_published_at_idx
  on public.landing_page_versions (published_at desc);

alter table public.landing_page_versions enable row level security;

drop policy if exists "landing_page_versions_admin_select" on public.landing_page_versions;
create policy "landing_page_versions_admin_select"
  on public.landing_page_versions
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "landing_page_versions_admin_insert" on public.landing_page_versions;
create policy "landing_page_versions_admin_insert"
  on public.landing_page_versions
  for insert
  to authenticated
  with check (public.is_admin());

revoke all on table public.landing_page_versions from anon;
revoke all on table public.landing_page_versions from authenticated;
grant select, insert on table public.landing_page_versions to authenticated;
grant all on table public.landing_page_versions to service_role;

insert into public.landing_page_versions (version, content, published_by, published_at)
select
  greatest(coalesce(homepage_version, 1), 1),
  homepage,
  null,
  coalesce(homepage_published_at, now())
from public.store_settings
where id = 1
on conflict (version) do nothing;

create or replace function public.publish_landing_page(p_content jsonb default null)
returns table (
  published_homepage jsonb,
  published_version integer,
  published_at timestamptz
)
language plpgsql
security invoker
set search_path = 'public', 'private'
as $$
declare
  v_content jsonb;
  v_version integer;
  v_published_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501';
  end if;

  if p_content is not null then
    v_content := p_content;
  else
    select d.content
    into v_content
    from public.landing_page_draft d
    where d.id = 1;
  end if;

  if v_content is null then
    select s.homepage
    into v_content
    from public.store_settings s
    where s.id = 1;
  end if;

  if v_content is null or jsonb_typeof(v_content) <> 'object' then
    raise exception 'Landing page content must be a JSON object'
      using errcode = '22023';
  end if;

  perform 1
  from public.store_settings
  where id = 1
  for update;

  v_published_at := now();

  update public.store_settings
  set
    homepage = v_content,
    homepage_version = greatest(coalesce(homepage_version, 1), 1) + 1,
    homepage_published_at = v_published_at,
    homepage_updated_at = v_published_at
  where id = 1
  returning homepage_version into v_version;

  insert into public.landing_page_draft (id, content, updated_by, updated_at)
  values (1, v_content, auth.uid(), v_published_at)
  on conflict (id) do update
  set content = excluded.content,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.landing_page_versions (
    version,
    content,
    published_by,
    published_at
  )
  values (
    v_version,
    v_content,
    auth.uid(),
    v_published_at
  );

  return query
  select v_content, v_version, v_published_at;
end;
$$;

revoke all on function public.publish_landing_page(jsonb) from public;
revoke all on function public.publish_landing_page(jsonb) from anon;
grant execute on function public.publish_landing_page(jsonb) to authenticated;
grant execute on function public.publish_landing_page(jsonb) to service_role;

commit;
