-- Synthetic dependencies for isolated PostgreSQL 17 migration verification.
-- This is a disposable GitHub runner database, not live Supabase.
create role anon login;
create role authenticated login;
create role service_role login bypassrls;
create table public.custom_designs (
  id uuid primary key
);
insert into public.custom_designs (id)
values ('33333333-3333-4333-8333-333333333333');
