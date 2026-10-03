begin;

create table if not exists public.finance_order_item_costs (
  order_item_id uuid primary key references public.order_items(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  quantity_snapshot integer not null check (quantity_snapshot > 0),
  garment_unit_cost numeric(12,2) not null default 0 check (garment_unit_cost >= 0),
  print_unit_cost numeric(12,2) not null default 0 check (print_unit_cost >= 0),
  packaging_unit_cost numeric(12,2) not null default 0 check (packaging_unit_cost >= 0),
  other_unit_cost numeric(12,2) not null default 0 check (other_unit_cost >= 0),
  currency text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  is_configured boolean not null default false,
  cost_source text not null default 'unconfigured' check (cost_source in ('variant', 'product', 'manual', 'unconfigured')),
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.finance_order_item_costs is
  'Historical COGS snapshots for GDP order items. Product/variant costs seed garment cost at order-item creation; later catalog cost changes do not rewrite historical snapshots.';

create index if not exists finance_order_item_costs_order_id_idx
  on public.finance_order_item_costs(order_id);

alter table public.finance_order_item_costs enable row level security;
revoke all on table public.finance_order_item_costs from public, anon, authenticated;
grant select on table public.finance_order_item_costs to authenticated;
grant update (garment_unit_cost, print_unit_cost, packaging_unit_cost, other_unit_cost) on table public.finance_order_item_costs to authenticated;

drop policy if exists finance_order_item_costs_admin_select on public.finance_order_item_costs;
create policy finance_order_item_costs_admin_select
  on public.finance_order_item_costs
  for select
  to authenticated
  using (public.is_admin_step_up_authorized());

drop policy if exists finance_order_item_costs_admin_update on public.finance_order_item_costs;
create policy finance_order_item_costs_admin_update
  on public.finance_order_item_costs
  for update
  to authenticated
  using (public.is_admin_step_up_authorized())
  with check (public.is_admin_step_up_authorized());

create or replace function public.capture_order_item_cost_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_variant_cost numeric(12,2);
  v_product_cost numeric(12,2);
  v_cost numeric(12,2);
  v_source text := 'unconfigured';
  v_configured boolean := false;
begin
  if new.variant_id is not null then
    select pv.cost_per_item into v_variant_cost
    from public.product_variants pv
    where pv.id = new.variant_id;
  end if;

  if new.product_id is not null then
    select p.cost_per_item into v_product_cost
    from public.products p
    where p.id = new.product_id;
  end if;

  if v_variant_cost is not null then
    v_cost := greatest(v_variant_cost, 0);
    v_source := 'variant';
    v_configured := true;
  elsif v_product_cost is not null then
    v_cost := greatest(v_product_cost, 0);
    v_source := 'product';
    v_configured := true;
  else
    v_cost := 0;
  end if;

  insert into public.finance_order_item_costs (
    order_item_id,
    order_id,
    quantity_snapshot,
    garment_unit_cost,
    is_configured,
    cost_source
  ) values (
    new.id,
    new.order_id,
    greatest(coalesce(new.quantity, 1), 1),
    v_cost,
    v_configured,
    v_source
  )
  on conflict (order_item_id) do nothing;

  return new;
end;
$$;

revoke all on function public.capture_order_item_cost_snapshot() from public, anon, authenticated;

drop trigger if exists order_items_capture_finance_cogs on public.order_items;
create trigger order_items_capture_finance_cogs
  after insert on public.order_items
  for each row
  execute function public.capture_order_item_cost_snapshot();

create or replace function public.mark_order_item_cogs_manual()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.is_configured := true;
  new.cost_source := 'manual';
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.mark_order_item_cogs_manual() from public, anon, authenticated;

drop trigger if exists finance_order_item_costs_mark_manual on public.finance_order_item_costs;
create trigger finance_order_item_costs_mark_manual
  before update of garment_unit_cost, print_unit_cost, packaging_unit_cost, other_unit_cost
  on public.finance_order_item_costs
  for each row
  execute function public.mark_order_item_cogs_manual();

insert into public.finance_order_item_costs (
  order_item_id,
  order_id,
  quantity_snapshot,
  garment_unit_cost,
  is_configured,
  cost_source,
  captured_at
)
select
  oi.id,
  oi.order_id,
  greatest(coalesce(oi.quantity, 1), 1),
  greatest(coalesce(pv.cost_per_item, p.cost_per_item, 0), 0),
  (pv.cost_per_item is not null or p.cost_per_item is not null),
  case
    when pv.cost_per_item is not null then 'variant'
    when p.cost_per_item is not null then 'product'
    else 'unconfigured'
  end,
  coalesce(oi.created_at, now())
from public.order_items oi
left join public.product_variants pv on pv.id = oi.variant_id
left join public.products p on p.id = oi.product_id
on conflict (order_item_id) do nothing;

create or replace function public.get_admin_finance_snapshot(
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
  sales_cost_items as (
    select
      oi.id as order_item_id,
      oi.order_id,
      so.order_number,
      so.created_at as order_created_at,
      oi.name,
      oi.variant,
      oi.size,
      oi.color,
      oi.quantity,
      oi.unit_price,
      oi.is_custom,
      c.quantity_snapshot,
      c.garment_unit_cost,
      c.print_unit_cost,
      c.packaging_unit_cost,
      c.other_unit_cost,
      c.currency,
      c.is_configured,
      c.cost_source,
      c.captured_at,
      c.updated_at,
      (
        (coalesce(c.garment_unit_cost, 0)
        + coalesce(c.print_unit_cost, 0)
        + coalesce(c.packaging_unit_cost, 0)
        + coalesce(c.other_unit_cost, 0))
        * greatest(coalesce(c.quantity_snapshot, oi.quantity, 1), 1)
      )::numeric as total_cogs
    from public.order_items oi
    join sales_orders so on so.id = oi.order_id
    left join public.finance_order_item_costs c on c.order_item_id = oi.id
  ),
  order_costs as (
    select
      order_id,
      count(*) as item_count,
      count(*) filter (where is_configured) as configured_item_count,
      coalesce(sum(total_cogs) filter (where is_configured), 0) as cogs
    from sales_cost_items
    group by order_id
  ),
  filtered_refunds as (
    select r.*, o.order_number
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
    select d.*, o.order_number
    from public.payment_disputes d
    left join public.orders o on o.id = d.order_id
    where d.payment_mode = 'live'
      and (p_from is null or d.created_at >= p_from)
      and (p_to is null or d.created_at < p_to)
  ),
  cogs_summary as (
    select
      count(*) as total_items,
      count(*) filter (where is_configured) as configured_items,
      coalesce(sum(total_cogs) filter (where is_configured), 0) as configured_cogs,
      coalesce(sum(garment_unit_cost * greatest(coalesce(quantity_snapshot, quantity, 1), 1)) filter (where is_configured), 0) as garment_cogs,
      coalesce(sum(print_unit_cost * greatest(coalesce(quantity_snapshot, quantity, 1), 1)) filter (where is_configured), 0) as print_cogs,
      coalesce(sum(packaging_unit_cost * greatest(coalesce(quantity_snapshot, quantity, 1), 1)) filter (where is_configured), 0) as packaging_cogs,
      coalesce(sum(other_unit_cost * greatest(coalesce(quantity_snapshot, quantity, 1), 1)) filter (where is_configured), 0) as other_cogs
    from sales_cost_items
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'grossSales', coalesce((select sum(subtotal) from sales_orders), 0),
      'discounts', coalesce((select sum(discount) from sales_orders), 0),
      'shippingCollected', coalesce((select sum(shipping) from sales_orders), 0),
      'taxCollected', coalesce((select sum(tax) from sales_orders), 0),
      'paidRevenue', coalesce((select sum(total) from sales_orders), 0),
      'paidOrders', coalesce((select count(*) from sales_orders), 0),
      'cogs', (select configured_cogs from cogs_summary),
      'garmentCogs', (select garment_cogs from cogs_summary),
      'printCogs', (select print_cogs from cogs_summary),
      'packagingCogs', (select packaging_cogs from cogs_summary),
      'otherCogs', (select other_cogs from cogs_summary),
      'cogsTotalItems', (select total_items from cogs_summary),
      'cogsConfiguredItems', (select configured_items from cogs_summary),
      'cogsCoveragePercent', case
        when (select total_items from cogs_summary) = 0 then 100
        else round(((select configured_items from cogs_summary)::numeric / (select total_items from cogs_summary)::numeric) * 100, 1)
      end,
      'grossProfit', case
        when (select total_items from cogs_summary) = (select configured_items from cogs_summary)
          then coalesce((select sum(subtotal - discount) from sales_orders), 0) - (select configured_cogs from cogs_summary)
        else null
      end,
      'grossMarginPercent', case
        when (select total_items from cogs_summary) = (select configured_items from cogs_summary)
          and coalesce((select sum(subtotal - discount) from sales_orders), 0) > 0
          then round((
            (coalesce((select sum(subtotal - discount) from sales_orders), 0) - (select configured_cogs from cogs_summary))
            / coalesce(nullif((select sum(subtotal - discount) from sales_orders), 0), 1)
          ) * 100, 1)
        else null
      end,
      'recordedRefunds', coalesce((
        select sum(amount) from filtered_refunds
        where lower(coalesce(status, '')) in ('processed', 'succeeded', 'completed', 'paid', 'refunded')
      ), 0),
      'pendingRefunds', coalesce((
        select sum(amount) from filtered_refunds
        where lower(coalesce(status, 'pending')) in ('pending', 'requested', 'processing')
      ), 0),
      'refundOrders', coalesce((
        select count(*) from filtered_orders
        where payment_status in ('refunded', 'partially_refunded')
          or status in ('refunded', 'partially_refunded')
      ), 0),
      'expenses', coalesce((select sum(amount + tax) from filtered_expenses), 0),
      'openDisputeCount', coalesce((
        select count(*) from filtered_disputes
        where lower(coalesce(status, '')) not in ('won', 'lost', 'warning_closed')
      ), 0),
      'openDisputeAmount', coalesce((
        select sum(amount)::numeric / 100 from filtered_disputes
        where lower(coalesce(status, '')) not in ('won', 'lost', 'warning_closed')
      ), 0),
      'testPaidOrdersExcluded', coalesce((
        select count(*) from public.orders o
        where o.payment_status = 'paid'
          and o.payment_mode = 'test'
          and (p_from is null or o.created_at >= p_from)
          and (p_to is null or o.created_at < p_to)
      ), 0),
      'testPaidRevenueExcluded', coalesce((
        select sum(o.total) from public.orders o
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
          o.created_at,
          coalesce(oc.cogs, 0) as cogs,
          coalesce(oc.item_count, 0) as cogs_item_count,
          coalesce(oc.configured_item_count, 0) as cogs_configured_item_count,
          case
            when coalesce(oc.item_count, 0) > 0 and oc.item_count = oc.configured_item_count
              then (o.subtotal - o.discount) - coalesce(oc.cogs, 0)
            else null
          end as gross_profit
        from filtered_orders o
        left join order_costs oc on oc.order_id = o.id
        order by o.created_at desc
        limit v_limit
      ) t
    ), '[]'::jsonb),
    'costItems', coalesce((
      select jsonb_agg(to_jsonb(ci) order by ci.order_created_at desc, ci.order_item_id)
      from (
        select
          order_item_id,
          order_id,
          order_number,
          order_created_at,
          name,
          variant,
          size,
          color,
          quantity,
          unit_price,
          is_custom,
          quantity_snapshot,
          coalesce(garment_unit_cost, 0) as garment_unit_cost,
          coalesce(print_unit_cost, 0) as print_unit_cost,
          coalesce(packaging_unit_cost, 0) as packaging_unit_cost,
          coalesce(other_unit_cost, 0) as other_unit_cost,
          coalesce(currency, 'CAD') as currency,
          coalesce(is_configured, false) as is_configured,
          coalesce(cost_source, 'unconfigured') as cost_source,
          total_cogs,
          captured_at,
          updated_at
        from sales_cost_items
        order by order_created_at desc, order_item_id
        limit least(v_limit * 4, 4000)
      ) ci
    ), '[]'::jsonb),
    'refunds', coalesce((
      select jsonb_agg(to_jsonb(rf) order by rf.created_at desc)
      from (
        select id, order_id, order_number, amount, status, provider, provider_refund_id, reason, processed_at, created_at
        from filtered_refunds
        order by created_at desc
        limit v_limit
      ) rf
    ), '[]'::jsonb),
    'disputes', coalesce((
      select jsonb_agg(to_jsonb(ds) order by ds.created_at desc)
      from (
        select stripe_dispute_id, order_id, order_number, status, reason,
          (amount::numeric / 100) as amount, upper(currency) as currency,
          evidence_due_by, evidence_past_due, created_at, updated_at
        from filtered_disputes
        order by created_at desc
        limit v_limit
      ) ds
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(to_jsonb(ex) order by ex.occurred_on desc, ex.created_at desc)
      from (
        select id, occurred_on, vendor, category, description, amount, tax, currency, payment_method, receipt_path, notes, created_at, updated_at
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
  'AAL2/admin-only finance snapshot with immutable order-item COGS snapshots. Gross profit is emitted only when every sold line item in the selected period has configured COGS.';

commit;
