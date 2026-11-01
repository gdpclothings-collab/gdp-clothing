-- ISOLATED/UNAPPLIED: server-only guest-upload capability and immutable side binding.
-- Never backfill unknown legacy paths with an ownership proof.
create table if not exists public.guest_custom_upload_grants (
  path text primary key check (path ~* '^guest/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'),
  proof_hash text not null check (proof_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null check (purpose in ('source', 'production', 'mockup')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guest_custom_upload_grants_expires_at_idx
  on public.guest_custom_upload_grants(expires_at);

create table if not exists public.guest_custom_mockup_bindings (
  design_id uuid not null references public.custom_designs(id) on delete cascade,
  side text not null check (side in ('front', 'back')),
  path text not null references public.guest_custom_upload_grants(path),
  created_at timestamptz not null default now(),
  primary key (design_id, side),
  unique (design_id, path)
);

alter table public.guest_custom_upload_grants enable row level security;
alter table public.guest_custom_mockup_bindings enable row level security;
revoke all on table public.guest_custom_upload_grants from anon, authenticated;
revoke all on table public.guest_custom_mockup_bindings from anon, authenticated;
revoke all on table public.guest_custom_upload_grants from public;
revoke all on table public.guest_custom_mockup_bindings from public;
grant select, insert, update, delete on table public.guest_custom_upload_grants to service_role;
grant select, insert, update, delete on table public.guest_custom_mockup_bindings to service_role;

create policy "deny_client_guest_custom_upload_grants"
  on public.guest_custom_upload_grants as restrictive for all
  to anon, authenticated using (false) with check (false);
create policy "deny_client_guest_custom_mockup_bindings"
  on public.guest_custom_mockup_bindings as restrictive for all
  to anon, authenticated using (false) with check (false);

comment on table public.guest_custom_upload_grants is
  'Server-only expiring and revocable SHA-256 ownership proofs, scoped to an upload path and purpose.';
comment on table public.guest_custom_mockup_bindings is
  'Server-approved immutable front/back guest garment mockup paths; never production file paths.';
