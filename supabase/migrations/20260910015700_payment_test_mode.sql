-- Shopify-style Stripe test mode with strict order and audit separation.

alter table public.store_settings
  add column if not exists payment_mode text not null default 'live'
    check (payment_mode in ('live', 'test')),
  add column if not exists test_inventory_workflow boolean not null default false;

alter table public.orders
  add column if not exists payment_mode text not null default 'live'
    check (payment_mode in ('live', 'test')),
  add column if not exists test_inventory_workflow boolean not null default false;

create index if not exists orders_payment_mode_created_at_idx
  on public.orders (payment_mode, created_at desc);

create table if not exists public.payment_mode_audit_log (
  id bigint generated always as identity primary key,
  changed_by uuid references auth.users(id) on delete set null,
  previous_mode text not null check (previous_mode in ('live', 'test')),
  new_mode text not null check (new_mode in ('live', 'test')),
  test_inventory_workflow boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.payment_mode_audit_log enable row level security;

create policy "payment_mode_audit_admin_read"
on public.payment_mode_audit_log for select
to authenticated
using (private.is_admin());

create or replace function private.audit_payment_mode_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if old.payment_mode is distinct from new.payment_mode
     or old.test_inventory_workflow is distinct from new.test_inventory_workflow then
    insert into public.payment_mode_audit_log (
      changed_by, previous_mode, new_mode, test_inventory_workflow
    ) values (
      auth.uid(), old.payment_mode, new.payment_mode, new.test_inventory_workflow
    );
  end if;
  return new;
end;
$$;

revoke all on function private.audit_payment_mode_change() from public;
grant execute on function private.audit_payment_mode_change() to authenticated;

drop trigger if exists store_settings_payment_mode_audit on public.store_settings;
create trigger store_settings_payment_mode_audit
after update of payment_mode, test_inventory_workflow on public.store_settings
for each row execute function private.audit_payment_mode_change();
