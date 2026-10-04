begin;

create or replace function private.finance_guard_accounting_period_date()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_close public.finance_accounting_period_closes;
begin
  select * into v_close
  from public.finance_accounting_period_closes c
  where c.status='closed'
    and new.entry_date between c.period_start and c.period_end
  order by c.period_end desc
  limit 1;

  if v_close.id is not null then
    raise exception 'accounting period % through % is closed; reopen the period before posting or backdating ledger activity',v_close.period_start,v_close.period_end using errcode='P2601';
  end if;

  return new;
end;
$$;

create or replace function private.finance_manual_sale_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_manual_sale_source(new.id);
  exception
    when sqlstate 'P2601' then raise;
    when others then
      perform private.finance_record_ledger_failure('manual_sale',new.id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_expense_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_expense_source(new.id);
  exception
    when sqlstate 'P2601' then raise;
    when others then
      perform private.finance_record_ledger_failure('expense',new.id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_order_cost_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_order_cogs_source(new.order_id);
  exception
    when sqlstate 'P2601' then raise;
    when others then
      perform private.finance_record_ledger_failure('order_cogs',new.order_id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_order_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_order_revenue_source(new.id);
  exception
    when sqlstate 'P2601' then raise;
    when others then
      perform private.finance_record_ledger_failure('online_order',new.id::text,'sync',sqlerrm);
  end;
  begin
    perform private.finance_sync_order_cogs_source(new.id);
  exception
    when sqlstate 'P2601' then raise;
    when others then
      perform private.finance_record_ledger_failure('order_cogs',new.id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_refund_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_refund_source(new.id);
  exception
    when sqlstate 'P2601' then raise;
    when others then
      perform private.finance_record_ledger_failure('refund',new.id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_stripe_balance_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_stripe_fee_source(new.stripe_balance_transaction_id);
  exception
    when sqlstate 'P2601' then raise;
    when others then
      perform private.finance_record_ledger_failure('stripe_fee',new.stripe_balance_transaction_id,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_stripe_payout_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_stripe_payout_source(new.stripe_payout_id);
  exception
    when sqlstate 'P2601' then raise;
    when others then
      perform private.finance_record_ledger_failure('stripe_payout',new.stripe_payout_id,'sync',sqlerrm);
  end;
  return new;
end;
$$;

revoke all on function private.finance_guard_accounting_period_date() from public,anon,authenticated;
revoke all on function private.finance_manual_sale_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_expense_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_order_cost_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_order_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_refund_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_stripe_balance_ledger_trigger() from public,anon,authenticated;
revoke all on function private.finance_stripe_payout_ledger_trigger() from public,anon,authenticated;

grant execute on function private.finance_guard_accounting_period_date() to service_role;
grant execute on function private.finance_manual_sale_ledger_trigger() to service_role;
grant execute on function private.finance_expense_ledger_trigger() to service_role;
grant execute on function private.finance_order_cost_ledger_trigger() to service_role;
grant execute on function private.finance_order_ledger_trigger() to service_role;
grant execute on function private.finance_refund_ledger_trigger() to service_role;
grant execute on function private.finance_stripe_balance_ledger_trigger() to service_role;
grant execute on function private.finance_stripe_payout_ledger_trigger() to service_role;

commit;
