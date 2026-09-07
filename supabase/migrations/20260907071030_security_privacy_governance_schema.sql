begin;

alter table public.store_settings
  add column if not exists privacy_settings jsonb not null default '{
    "policyVersion":"2026-09-07",
    "customerUploadRetentionDays":180,
    "supportTicketRetentionMonths":24,
    "securityLogRetentionMonths":24,
    "marketingConsentRecordRetention":"while-active-and-as-required-for-compliance",
    "transactionRecordRetention":"as-required-by-tax-accounting-and-legal-obligations",
    "privacyContactEmail":"hello@gdpclothing.ca"
  }'::jsonb;

create table if not exists public.marketing_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  status text not null check (status in ('subscribed','unsubscribed')),
  source text not null,
  consent_text_version text not null default '2026-09-07',
  policy_version text not null default '2026-09-07',
  created_at timestamptz not null default now()
);
create index if not exists marketing_consents_email_created_idx on public.marketing_consents (lower(email), created_at desc);
create index if not exists marketing_consents_user_created_idx on public.marketing_consents (user_id, created_at desc);
alter table public.marketing_consents enable row level security;
revoke all on public.marketing_consents from anon, authenticated;
grant select on public.marketing_consents to authenticated;
drop policy if exists marketing_consents_owner_read on public.marketing_consents;
create policy marketing_consents_owner_read on public.marketing_consents for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists marketing_consents_admin_all on public.marketing_consents;
create policy marketing_consents_admin_all on public.marketing_consents for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create table if not exists public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  order_id uuid references public.orders(id) on delete set null,
  policy_key text not null,
  policy_version text not null,
  source text not null,
  accepted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists policy_acceptances_user_idx on public.policy_acceptances (user_id, accepted_at desc);
create index if not exists policy_acceptances_order_idx on public.policy_acceptances (order_id, accepted_at desc);
alter table public.policy_acceptances enable row level security;
revoke all on public.policy_acceptances from anon, authenticated;
grant select on public.policy_acceptances to authenticated;
drop policy if exists policy_acceptances_owner_read on public.policy_acceptances;
create policy policy_acceptances_owner_read on public.policy_acceptances for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists policy_acceptances_admin_all on public.policy_acceptances;
create policy policy_acceptances_admin_all on public.policy_acceptances for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  request_type text not null check (request_type in ('access','export','correction','deletion','privacy_question')),
  status text not null default 'open' check (status in ('open','in_review','completed','declined')),
  details text,
  response_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists privacy_requests_user_created_idx on public.privacy_requests (user_id, created_at desc);
alter table public.privacy_requests enable row level security;
grant select, insert on public.privacy_requests to authenticated;
revoke all on public.privacy_requests from anon;
drop policy if exists privacy_requests_owner_read on public.privacy_requests;
create policy privacy_requests_owner_read on public.privacy_requests for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists privacy_requests_owner_insert on public.privacy_requests;
create policy privacy_requests_owner_insert on public.privacy_requests for insert to authenticated with check (user_id = (select auth.uid()) and status = 'open');
drop policy if exists privacy_requests_admin_all on public.privacy_requests;
create policy privacy_requests_admin_all on public.privacy_requests for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create table if not exists public.security_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  severity text not null default 'low' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','contained','investigating','resolved','closed')),
  occurred_at timestamptz,
  detected_at timestamptz not null default now(),
  affected_systems text[] not null default '{}',
  personal_information_involved boolean not null default false,
  rrosh_assessment text,
  notification_required boolean,
  containment_notes text,
  root_cause text,
  remediation text,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.security_incidents enable row level security;
revoke all on public.security_incidents from anon;
grant select, insert, update on public.security_incidents to authenticated;
drop policy if exists security_incidents_admin_all on public.security_incidents;
create policy security_incidents_admin_all on public.security_incidents for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.custom_designs drop constraint if exists custom_designs_rights_before_cart;
alter table public.custom_designs
  add constraint custom_designs_rights_before_cart
  check (status <> 'in_cart' or (customer_confirmed_rights = true and approval_policy_acknowledged = true));

commit;
