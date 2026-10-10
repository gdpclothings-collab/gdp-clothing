-- Restore the missing artwork library schema prerequisite for fresh local databases.
-- Existing production tables are not replaced or rewritten.
do $recovery$
begin
if to_regclass('public.artwork_library') is null then
create table public.artwork_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  tags text[] not null default '{}'::text[],
  status text not null default 'draft',
  rights_status text not null default 'unverified',
  ready_print boolean not null default false,
  customizable boolean not null default false,
  preview_data_url text,
  production_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  studio_visible boolean not null default false,
  proof_approved boolean not null default false,
  aspect_ratio numeric,
  max_width_in numeric,
  max_height_in numeric,
  source_sha256 text,
  ink_bbox_px jsonb,
  digital_approved boolean not null default false
);

-- Defense in depth: newly created tables are private until an admin session is authorized.
alter table public.artwork_library enable row level security;
revoke all on public.artwork_library from anon, authenticated;
grant select, insert, update, delete on public.artwork_library to authenticated;
create policy artwork_library_admin on public.artwork_library
  for all to authenticated
  using (public.is_admin() and public.is_admin_step_up_authorized())
  with check (public.is_admin() and public.is_admin_step_up_authorized());

end if;
end;
$recovery$;
