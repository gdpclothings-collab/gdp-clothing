begin;

create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null default current_date,
  vendor text,
  category text not null default 'miscellaneous' check (
    category in (
      'garments',
      'dtf_transfers',
      'ink',
      'packaging',
      'shipping',
      'local_delivery',
      'advertising',
      'website_hosting',
      'domain',
      'software',
      'equipment',
      'supplies',
      'merchant_fees',
      'miscellaneous'
    )
  ),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  payment_method text,
  receipt_path text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.finance_expenses is
  'Admin-only operating expense ledger for GDP Clothing finance reporting. Amounts use currency units consistent with orders and refunds.';

create index if not exists finance_expenses_occurred_on_idx
  on public.finance_expenses (occurred_on desc, created_at desc);
create index if not exists finance_expenses_category_idx
  on public.finance_expenses (category, occurred_on desc);

alter table public.finance_expenses enable row level security;

revoke all on table public.finance_expenses from public, anon;
grant select, insert, update, delete on table public.finance_expenses to authenticated;

drop policy if exists finance_expenses_admin_select on public.finance_expenses;
create policy finance_expenses_admin_select
  on public.finance_expenses
  for select
  to authenticated
  using (public.is_admin_step_up_authorized());

drop policy if exists finance_expenses_admin_insert on public.finance_expenses;
create policy finance_expenses_admin_insert
  on public.finance_expenses
  for insert
  to authenticated
  with check (
    public.is_admin_step_up_authorized()
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists finance_expenses_admin_update on public.finance_expenses;
create policy finance_expenses_admin_update
  on public.finance_expenses
  for update
  to authenticated
  using (public.is_admin_step_up_authorized())
  with check (public.is_admin_step_up_authorized());

drop policy if exists finance_expenses_admin_delete on public.finance_expenses;
create policy finance_expenses_admin_delete
  on public.finance_expenses
  for delete
  to authenticated
  using (public.is_admin_step_up_authorized());

create or replace function public.get_admin_finance_snapshot(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 250
)
returns jsonb
language plpgsql
stable
security definer
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
  filtered_orders as (
    select o.*
    from public.orders o
    where coalesce(o.payment_mode, 'live') = 'live'
      and (p_from is null or o.created_at >= p_from)
      and (p_to is null or o.created_at < p_to)
  ),
  sales_orders as (
    select o.*
    from filtered_orders o
    where o.payment_status in ('paid', 'refunded', 'partially_refunded')
  ),
  filtered_refunds as (
    select
      r.*,
      o.order_number
    from public.refunds r
    join public.orders o on o.id = r.order_id
    where coalesce(o.payment_mode, 'live') = 'live'
      and (p_from is null or coalesce(r.processed_at, r.created_at) >= p_from)
      and (p_to is null or coalesce(r.processed_at, r.created_at) < p_to)
  ),
  filtered_expenses as (
    select e.*
    from public.finance_expenses e
    where (p_from is null or e.occurred_on >= (p_from at time zone 'America/Regina')::date)
      and (p_to is null or e.occurred_on < (p_to at time zone 'America/Regina')::date)
  ),
  filtered_disputes as (
    select
      d.*,
      o.order_number
    from public.payment_disputes d
    left join public.orders o on o.id = d.order_id
    where d.payment_mode = 'live'
      and (p_from is null or d.created_at >= p_from)
      and (p_to is null or d.created_at < p_to)
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'grossSales', coalesce((select sum(subtotal) from sales_orders), 0),
      'discounts', coalesce((select sum(discount) from sales_orders), 0),
      'shippingCollected', coalesce((select sum(shipping) from sales_orders), 0),
      'taxCollected', coalesce((select sum(tax) from sales_orders), 0),
      'paidRevenue', coalesce((select sum(total) from sales_orders), 0),
      'paidOrders', coalesce((select count(*) from sales_orders), 0),
      'recordedRefunds', coalesce((
        select sum(amount)
        from filtered_refunds
        where lower(coalesce(status, '')) in ('processed', 'succeeded', 'completed', 'paid', 'refunded')
      ), 0),
      'pendingRefunds', coalesce((
        select sum(amount)
        from filtered_refunds
        where lower(coalesce(status, 'pending')) in ('pending', 'requested', 'processing')
      ), 0),
      'refundOrders', coalesce((
        select count(*)
        from filtered_orders
        where payment_status in ('refunded', 'partially_refunded')
          or status in ('refunded', 'partially_refunded')
      ), 0),
      'expenses', coalesce((select sum(amount + tax) from filtered_expenses), 0),
      'openDisputeCount', coalesce((
        select count(*)
        from filtered_disputes
        where lower(coalesce(status, '')) not in ('won', 'lost', 'warning_closed')
      ), 0),
      'openDisputeAmount', coalesce((
        select sum(amount)::numeric / 100
        from filtered_disputes
        where lower(coalesce(status, '')) not in ('won', 'lost', 'warning_closed')
      ), 0),
      'testPaidOrdersExcluded', coalesce((
        select count(*)
        from public.orders o
        where o.payment_status = 'paid'
          and o.payment_mode = 'test'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0),
      'testPaidRevenueExcluded', coalesce((
        select sum(o.total)
        from public.orders o
        where o.payment_status = 'paid'
          and o.payment_mode = 'test'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0)
    ),
    'transactions', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at desc)
      from (
        select
          id,
          order_number,
          customer_name,
          customer_email,
          subtotal,
          discount,
          shipping,
          tax,
          total,
          payment_status,
          status,
          payment_mode,
          stripe_payment_intent_id,
          created_at
        from filtered_orders
        order by created_at desc
        limit v_limit
      ) t
    ), '[]'::jsonb),
    'refunds', coalesce((
      select jsonb_agg(to_jsonb(rf) order by rf.created_at desc)
      from (
        select
          id,
          order_id,
          order_number,
          amount,
          status,
          provider,
          provider_refund_id,
          reason,
          processed_at,
          created_at
        from filtered_refunds
        order by created_at desc
        limit v_limit
      ) rf
    ), '[]'::jsonb),
    'disputes', coalesce((
      select jsonb_agg(to_jsonb(ds) order by ds.created_at desc)
      from (
        select
          stripe_dispute_id,
          order_id,
          order_number,
          status,
          reason,
          (amount::numeric / 100) as amount,
          upper(currency) as currency,
          evidence_due_by,
          evidence_past_due,
          created_at,
          updated_at
        from filtered_disputes
        order by created_at desc
        limit v_limit
      ) ds
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(to_jsonb(ex) order by ex.occurred_on desc, ex.created_at desc)
      from (
        select
          id,
          occurred_on,
          vendor,
          category,
          description,
          amount,
          tax,
          currency,
          payment_method,
          receipt_path,
          notes,
          created_at,
          updated_at
        from filtered_expenses
        order by occurred_on desc, created_at desc
        limit v_limit
      ) ex
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_finance_snapshot(timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.get_admin_finance_snapshot(timestamptz, timestamptz, integer) to authenticated;

comment on function public.get_admin_finance_snapshot(timestamptz, timestamptz, integer) is
  'AAL2/admin-only finance snapshot. Excludes Stripe test-mode orders from live reporting, preserves refunded orders in historical sales, and exposes disputes without granting direct table access.';

commit;
