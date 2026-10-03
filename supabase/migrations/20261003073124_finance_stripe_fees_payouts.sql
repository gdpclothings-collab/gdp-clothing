begin;

create table if not exists public.finance_stripe_balance_transactions (
  stripe_balance_transaction_id text primary key,
  order_id uuid references public.orders(id) on delete set null,
  stripe_source_id text,
  stripe_payment_intent_id text,
  transaction_type text not null,
  reporting_category text,
  amount numeric(14,2) not null default 0,
  fee numeric(14,2) not null default 0,
  net numeric(14,2) not null default 0,
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  payment_mode text not null default 'live' check (payment_mode in ('live', 'test')),
  stripe_created_at timestamptz not null,
  available_on timestamptz,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.finance_stripe_balance_transactions is
  'Server-captured Stripe balance transactions used for actual processor fee reporting. No card, bank, or customer payment credentials are stored.';

create index if not exists finance_stripe_balance_transactions_order_idx
  on public.finance_stripe_balance_transactions(order_id);
create index if not exists finance_stripe_balance_transactions_created_idx
  on public.finance_stripe_balance_transactions(stripe_created_at desc);
create index if not exists finance_stripe_balance_transactions_pi_idx
  on public.finance_stripe_balance_transactions(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.finance_stripe_balance_transactions enable row level security;
revoke all on table public.finance_stripe_balance_transactions from public, anon, authenticated;
grant select on table public.finance_stripe_balance_transactions to authenticated;

drop policy if exists finance_stripe_balance_transactions_admin_select on public.finance_stripe_balance_transactions;
create policy finance_stripe_balance_transactions_admin_select
  on public.finance_stripe_balance_transactions
  for select
  to authenticated
  using (public.is_admin_step_up_authorized());

create table if not exists public.finance_stripe_payouts (
  stripe_payout_id text primary key,
  stripe_balance_transaction_id text,
  amount numeric(14,2) not null default 0,
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  status text not null,
  method text,
  payout_type text,
  automatic boolean not null default false,
  arrival_date date,
  failure_code text,
  payment_mode text not null default 'live' check (payment_mode in ('live', 'test')),
  stripe_created_at timestamptz not null,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.finance_stripe_payouts is
  'Server-captured Stripe payout reconciliation data. Bank destination details are intentionally not stored.';

create index if not exists finance_stripe_payouts_created_idx
  on public.finance_stripe_payouts(stripe_created_at desc);
create index if not exists finance_stripe_payouts_status_idx
  on public.finance_stripe_payouts(status, stripe_created_at desc);

alter table public.finance_stripe_payouts enable row level security;
revoke all on table public.finance_stripe_payouts from public, anon, authenticated;
grant select on table public.finance_stripe_payouts to authenticated;

drop policy if exists finance_stripe_payouts_admin_select on public.finance_stripe_payouts;
create policy finance_stripe_payouts_admin_select
  on public.finance_stripe_payouts
  for select
  to authenticated
  using (public.is_admin_step_up_authorized());

create or replace function public.get_admin_stripe_finance_snapshot(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_limit integer := greatest(25, least(1000, coalesce(p_limit, 250)));
  v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  with
  paid_orders as (
    select o.id, o.order_number, o.stripe_payment_intent_id, o.created_at
    from public.orders o
    where coalesce(o.payment_mode, 'live') = 'live'
      and o.payment_status in ('paid', 'refunded', 'partially_refunded')
      and (p_from is null or o.created_at >= p_from)
      and (p_to is null or o.created_at < p_to)
  ),
  filtered_balance as (
    select b.*
    from public.finance_stripe_balance_transactions b
    where b.payment_mode = 'live'
      and (p_from is null or b.stripe_created_at >= p_from)
      and (p_to is null or b.stripe_created_at < p_to)
  ),
  order_fee_rows as (
    select
      b.order_id,
      coalesce(sum(b.fee), 0) as stripe_fee,
      coalesce(sum(b.amount), 0) as stripe_gross,
      coalesce(sum(b.net), 0) as stripe_net,
      max(b.stripe_created_at) as last_stripe_transaction_at
    from filtered_balance b
    where b.order_id is not null
    group by b.order_id
  ),
  charge_fee_orders as (
    select distinct b.order_id
    from filtered_balance b
    where b.order_id is not null
      and b.transaction_type in ('charge', 'payment')
  ),
  filtered_payouts as (
    select p.*
    from public.finance_stripe_payouts p
    where p.payment_mode = 'live'
      and (p_from is null or p.stripe_created_at >= p_from)
      and (p_to is null or p.stripe_created_at < p_to)
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'processorFees', coalesce((select sum(fee) from filtered_balance), 0),
      'stripeGross', coalesce((select sum(amount) from filtered_balance), 0),
      'stripeNet', coalesce((select sum(net) from filtered_balance), 0),
      'stripeBalanceTransactions', coalesce((select count(*) from filtered_balance), 0),
      'stripeFeeExpectedOrders', coalesce((select count(*) from paid_orders where stripe_payment_intent_id is not null), 0),
      'stripeFeeCapturedOrders', coalesce((select count(*) from charge_fee_orders), 0),
      'stripeFeeCoveragePercent', case
        when coalesce((select count(*) from paid_orders where stripe_payment_intent_id is not null), 0) = 0 then 100
        else round(
          least(
            1::numeric,
            coalesce((select count(*) from charge_fee_orders), 0)::numeric
            / nullif((select count(*) from paid_orders where stripe_payment_intent_id is not null), 0)::numeric
          ) * 100,
          1
        )
      end,
      'paidPayoutCount', coalesce((select count(*) from filtered_payouts where status = 'paid'), 0),
      'paidPayoutAmount', coalesce((select sum(amount) from filtered_payouts where status = 'paid'), 0),
      'pendingPayoutCount', coalesce((select count(*) from filtered_payouts where status in ('pending', 'in_transit')), 0),
      'failedPayoutCount', coalesce((select count(*) from filtered_payouts where status in ('failed', 'canceled')), 0),
      'stripeLastSyncedAt', greatest(
        coalesce((select max(updated_at) from public.finance_stripe_balance_transactions where payment_mode = 'live'), '-infinity'::timestamptz),
        coalesce((select max(updated_at) from public.finance_stripe_payouts where payment_mode = 'live'), '-infinity'::timestamptz)
      )
    ),
    'feesByOrder', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.order_number)
      from (
        select
          po.id as order_id,
          po.order_number,
          coalesce(ofr.stripe_fee, 0) as stripe_fee,
          coalesce(ofr.stripe_gross, 0) as stripe_gross,
          coalesce(ofr.stripe_net, 0) as stripe_net,
          (cfo.order_id is not null) as fee_captured,
          ofr.last_stripe_transaction_at
        from paid_orders po
        left join order_fee_rows ofr on ofr.order_id = po.id
        left join charge_fee_orders cfo on cfo.order_id = po.id
      ) x
    ), '[]'::jsonb),
    'balanceTransactions', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.stripe_created_at desc)
      from (
        select
          stripe_balance_transaction_id,
          order_id,
          stripe_source_id,
          stripe_payment_intent_id,
          transaction_type,
          reporting_category,
          amount,
          fee,
          net,
          currency,
          stripe_created_at,
          available_on,
          updated_at
        from filtered_balance
        order by stripe_created_at desc
        limit v_limit
      ) x
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.stripe_created_at desc)
      from (
        select
          stripe_payout_id,
          stripe_balance_transaction_id,
          amount,
          currency,
          status,
          method,
          payout_type,
          automatic,
          arrival_date,
          failure_code,
          stripe_created_at,
          updated_at
        from filtered_payouts
        order by stripe_created_at desc
        limit v_limit
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_stripe_finance_snapshot(timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.get_admin_stripe_finance_snapshot(timestamptz, timestamptz, integer) to authenticated;

comment on function public.get_admin_stripe_finance_snapshot(timestamptz, timestamptz, integer) is
  'AAL2/admin-only actual Stripe fee and payout reporting. Processor fees come from Stripe balance transactions; payouts are reconciliation cash movements and are not treated as profit expenses.';

commit;