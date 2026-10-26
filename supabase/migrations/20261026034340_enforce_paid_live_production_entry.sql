-- Enforce paid-LIVE verification at the production-entry boundary, regardless
-- of which authorized admin screen performs the update. No existing rows are
-- rewritten; already-running orders retain their refund/correction workflow.
begin;

create or replace function public.enforce_paid_live_production_entry()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  entering_production boolean := false;
begin
  if tg_op = 'INSERT' then
    entering_production := new.production_status <> 'not_started';
  else
    entering_production := old.production_status = 'not_started'
      and new.production_status <> 'not_started';
  end if;

  if entering_production and new.payment_status is distinct from 'paid' then
    raise exception using
      errcode = '23514',
      message = 'Production Blocked: payment must be verified paid before production entry.';
  end if;

  if entering_production and new.payment_mode is distinct from 'live' then
    raise exception using
      errcode = '23514',
      message = 'QA Only: only Live Mode orders may enter production.';
  end if;

  -- Do not allow a historical test queue entry to advance to printing either.
  if tg_op = 'UPDATE'
     and new.production_status <> 'not_started'
     and old.production_status is distinct from new.production_status
     and new.payment_mode is distinct from 'live' then
    raise exception using
      errcode = '23514',
      message = 'QA Only: Test Mode production stages cannot advance.';
  end if;

  -- Changing an already-active order from Live to Test must not turn a real
  -- production order into a test order without an explicit production reset.
  if tg_op = 'UPDATE'
     and new.production_status <> 'not_started'
     and old.payment_mode is distinct from new.payment_mode
     and new.payment_mode is distinct from 'live' then
    raise exception using
      errcode = '23514',
      message = 'QA Only: Test Mode cannot be assigned to an active production order.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_paid_live_production_entry() from public, anon, authenticated;

drop trigger if exists orders_enforce_paid_live_production_entry on public.orders;
create trigger orders_enforce_paid_live_production_entry
before insert or update of production_status, payment_status, payment_mode
on public.orders
for each row execute function public.enforce_paid_live_production_entry();

commit;
