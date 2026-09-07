-- Secure, expiring proof that an unauthenticated browser created a custom design.
-- Raw guest tokens never enter the database; only their SHA-256 digest is stored.
create table if not exists public.guest_design_sessions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null unique references public.custom_designs(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  converted_order_id uuid references public.orders(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_design_sessions_conversion_consistent check (
    (converted_order_id is null and converted_at is null)
    or converted_at is not null
  )
);

create index if not exists guest_design_sessions_expires_at_idx
  on public.guest_design_sessions(expires_at)
  where converted_at is null;

alter table public.guest_design_sessions enable row level security;

-- This table is intentionally server-only. Checkout uses the service role and
-- no browser role receives a policy or direct table grant.
revoke all on table public.guest_design_sessions from anon, authenticated;

comment on table public.guest_design_sessions is
  'Server-only, expiring ownership proof for guest-created custom designs.';
