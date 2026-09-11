create table if not exists public.ai_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  free_credit_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('welcome_verified_email','purchase','generation','refund','admin_adjustment','promo')),
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists ai_credit_ledger_user_created_idx
  on public.ai_credit_ledger (user_id, created_at desc);

alter table public.ai_credit_accounts enable row level security;
alter table public.ai_credit_ledger enable row level security;

revoke all on public.ai_credit_accounts from anon;
revoke all on public.ai_credit_ledger from anon;
grant select on public.ai_credit_accounts to authenticated;
grant select on public.ai_credit_ledger to authenticated;

create policy "customers_read_own_ai_credit_account"
  on public.ai_credit_accounts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "admins_read_ai_credit_accounts"
  on public.ai_credit_accounts
  for select
  to authenticated
  using ((select private.is_admin()));

create policy "customers_read_own_ai_credit_ledger"
  on public.ai_credit_ledger
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "admins_read_ai_credit_ledger"
  on public.ai_credit_ledger
  for select
  to authenticated
  using ((select private.is_admin()));

create or replace function private.grant_verified_customer_ai_credit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_granted_user_id uuid;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  insert into public.ai_credit_accounts (user_id, balance, free_credit_granted_at)
  values (new.id, 1, now())
  on conflict (user_id) do nothing
  returning user_id into v_granted_user_id;

  if v_granted_user_id is not null then
    insert into public.ai_credit_ledger (user_id, delta, reason, metadata)
    values (
      new.id,
      1,
      'welcome_verified_email',
      jsonb_build_object('source', 'verified_customer_signup')
    );
  end if;

  return new;
end;
$$;

revoke all on function private.grant_verified_customer_ai_credit() from public;

drop trigger if exists on_auth_user_verified_ai_credit on auth.users;
create trigger on_auth_user_verified_ai_credit
  after insert or update of email_confirmed_at on auth.users
  for each row
  execute function private.grant_verified_customer_ai_credit();

with granted as (
  insert into public.ai_credit_accounts (user_id, balance, free_credit_granted_at)
  select id, 1, coalesce(email_confirmed_at, now())
  from auth.users
  where email_confirmed_at is not null
  on conflict (user_id) do nothing
  returning user_id
)
insert into public.ai_credit_ledger (user_id, delta, reason, metadata)
select user_id, 1, 'welcome_verified_email', jsonb_build_object('source', 'verified_customer_backfill')
from granted;
