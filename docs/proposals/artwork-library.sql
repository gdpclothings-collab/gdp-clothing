-- PROPOSAL ONLY. Not applied: requires approval for new production table/access rules.
create table public.artwork_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  tags text[] not null default '{}',
  status text not null default 'draft' check(status in ('draft','active','archived')),
  rights_status text not null default 'unverified' check(rights_status in ('unverified','confirmed')),
  ready_print boolean not null default false,
  customizable boolean not null default false,
  preview_data_url text,
  production_path text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint artwork_release_gate check (status <> 'active' or (rights_status='confirmed' and production_path is not null)),
  constraint artwork_mode_gate check ((not ready_print and not customizable) or status='active')
);
alter table public.artwork_library enable row level security;
grant select, insert, update, delete on public.artwork_library to authenticated;
revoke all on public.artwork_library from anon;
create policy artwork_library_admin on public.artwork_library for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
comment on table public.artwork_library is 'Staff artwork catalog. Draft imports are private; customer publication requires a separate approved storefront integration.';
