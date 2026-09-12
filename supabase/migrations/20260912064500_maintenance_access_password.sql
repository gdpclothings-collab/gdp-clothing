create table if not exists public.maintenance_access_control (
  id smallint primary key default 1 check (id = 1),
  password_hash text,
  password_configured_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.maintenance_access_control (id)
values (1)
on conflict (id) do nothing;

alter table public.maintenance_access_control enable row level security;

revoke all on table public.maintenance_access_control from anon, authenticated;
grant select, insert, update, delete on table public.maintenance_access_control to service_role;

comment on table public.maintenance_access_control is
  'Server-only maintenance access password hash. Never expose this table to storefront clients.';
comment on column public.maintenance_access_control.password_hash is
  'Bcrypt password hash managed only by the maintenance-access Edge Function.';
