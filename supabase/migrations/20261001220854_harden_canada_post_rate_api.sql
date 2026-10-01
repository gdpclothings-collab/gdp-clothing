create table if not exists public.canada_post_rate_cache (
  cache_key text primary key,
  response_payload jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.canada_post_rate_cache enable row level security;
revoke all on table public.canada_post_rate_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.canada_post_rate_cache to service_role;

create index if not exists canada_post_rate_cache_expires_at_idx
  on public.canada_post_rate_cache (expires_at);

comment on table public.canada_post_rate_cache is
  'Server-only short-lived cache for Canada Post rating responses. No customer-visible access.';
