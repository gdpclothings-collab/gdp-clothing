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
  'Admin-only operating expense ledger for GDP Clothing finance reporting. Amounts are stored in currency units (for example CAD dollars), consistent with orders and refunds.';

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

  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'grossSales', coalesce((
        select sum(o.subtotal)
        from public.orders o
        where o.payment_status = 'paid'
          and coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0),
      'discounts', coalesce((
        select sum(o.discount)
        from public.orders o
        where o.payment_status = 'paid'
          and coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0),
      'shippingCollected', coalesce((
        select sum(o.shipping)
        from public.orders o
        where o.payment_status = 'paid'
          and coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0),
      'taxCollected', coalesce((
        select sum(o.tax)
        from public.orders o
        where o.payment_status = 'paid'
          and coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0),
      'paidRevenue', coalesce((
        select sum(o.total)
        from public.orders o
        where o.payment_status = 'paid'
          and coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0),
      'paidOrders', coalesce((
        select count(*)
        from public.orders o
        where o.payment_status = 'paid'
          and coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0),
      'recordedRefunds', coalesce((
        select sum(r.amount)
        from public.refunds r
        join public.orders o on o.id = r.order_id
        where lower(coalesce(r.status, '')) in ('processed', 'succeeded', 'completed', 'paid', 'refunded')
          and coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or coalesce(r.processed_at, r.created_at) >= p_from)
          and (p_to is null or coalesce(r.processed_at, r.created_at) < p_to)
      ), 0),
      'pendingRefunds', coalesce((
        select sum(r.amount)
        from public.refunds r
        join public.orders o on o.id = r.order_id
        where lower(coalesce(r.status, 'pending')) in ('pending', 'requested', 'processing')
          and coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or r.created_at >= p_from)
          and (p_to is null or r.created_at < p_to)
      ), 0),
      'refundOrders', coalesce((
        select count(distinct o.id)
        from public.orders o
        where coalesce(o.payment_mode, 'live') = 'live'
          and (o.payment_status in ('refunded', 'partially_refunded') or o.status in ('refunded', 'partially_refunded'))
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0),
      'expenses', coalesce((
        select sum(e.amount + e.tax)
        from public.finance_expenses e
        where (p_from is null or e.occurred_on >= (p_from at time zone 'America/Regina')::date)
          and (p_to is null or e.occurred_on < (p_to at time zone 'America/Regina')::date)
      ), 0),
      'openDisputeCount', coalesce((
        select count(*)
        from public.payment_disputes d
        where d.payment_mode = 'live'
          and lower(coalesce(d.status, '')) not in ('won', 'lost', 'warning_closed')
          and (p_from is null or d.created_at >= p_from)
          and (p_to is null or d.created_at < p_to)
      ), 0),
      'openDisputeAmount', coalesce((
        select sum(d.amount)::numeric / 100
        from public.payment_disputes d
        where d.payment_mode = 'live'
          and lower(coalesce(d.status, '')) not in ('won', 'lost', 'warning_closed')
          and (p_from is null or d.created_at >= p_from)
          and (p_to is null or d.created_at < p_to)
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
          o.id,
          o.order_number,
          o.customer_name,
          o.customer_email,
          o.subtotal,
          o.discount,
          o.shipping,
          o.tax,
          o.total,
          o.payment_status,
          o.status,
          o.payment_mode,
          o.stripe_payment_intent_id,
          o.created_at
        from public.orders o
        where coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
        order by o.created_at desc
        limit v_limit
      ) t
    ), '[]'::jsonb),
    'refunds', coalesce((
      select jsonb_agg(to_jsonb(rf) order by rf.created_at desc)
      from (
        select
          r.id,
          r.order_id,
          o.order_number,
          r.amount,
          r.status,
          r.provider,
          r.provider_refund_id,
          r.reason,
          r.processed_at,
          r.created_at
        from public.refunds r
        join public.orders o on o.id = r.order_id
        where coalesce(o.payment_mode, 'live') = 'live'
          and (p_from is null or r.created_at >= p_from)
          and (p_to is null or r.created_at < p_to)
        order by r.created_at desc
        limit v_limit
      ) rf
    ), '[]'::jsonb),
    'disputes', coalesce((
      select jsonb_agg(to_jsonb(ds) order by ds.created_at desc)
      from (
        select
          d.stripe_dispute_id,
          d.order_id,
          o.order_number,
          d.status,
          d.reason,
          (d.amount::numeric / 100) as amount,
          upper(d.currency) as currency,
          d.evidence_due_by,
          d.evidence_past_due,
          d.created_at,
          d.updated_at
        from public.payment_disputes d
        left join public.orders o on o.id = d.order_id
        where d.payment_mode = 'live'
          and (p_from is null or d.created_at >= p_from)
          and (p_to is null or d.created_at < p_to)
        order by d.created_at desc
        limit v_limit
      ) ds
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(to_jsonb(ex) order by ex.occurred_on desc, ex.created_at desc)
      from (
        select
          e.id,
          e.occurred_on,
          e.vendor,
          e.category,
          e.description,
          e.amount,
          e.tax,
          e.currency,
          e.payment_method,
          e.receipt_path,
          e.notes,
          e.created_at,
          e.updated_at
        from public.finance_expenses e
        where (p_from is null or e.occurred_on >= (p_from at time zone 'America/Regina')::date)
          and (p_to is null or e.occurred_on < (p_to at time zone 'America/Regina')::date)
        order by e.occurred_on desc, e.created_at desc
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
  'AAL2/admin-only finance snapshot. Excludes Stripe test-mode orders from live reporting and exposes disputes without granting direct table access.';

commit;
