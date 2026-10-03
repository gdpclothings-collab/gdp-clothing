begin;

create table public.finance_manual_sales (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  customer_name text,
  reference text,
  payment_method text not null default 'cash'
    check (payment_method in ('cash','e_transfer','debit','credit_card','cheque','other')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0 and discount <= subtotal),
  shipping numeric(12,2) not null default 0 check (shipping >= 0),
  gst_hst_tax numeric(12,2) not null default 0 check (gst_hst_tax >= 0),
  pst_tax numeric(12,2) not null default 0 check (pst_tax >= 0),
  cogs numeric(12,2) not null check (cogs >= 0),
  total numeric(12,2) generated always as (
    round((subtotal - discount + shipping + gst_hst_tax + pst_tax)::numeric, 2)
  ) stored,
  currency text not null default 'CAD' check (currency = 'CAD'),
  tax_jurisdiction text not null default 'CA-SK',
  notes text,
  status text not null default 'paid' check (status in ('paid','void')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  constraint finance_manual_sales_customer_name_len check (customer_name is null or char_length(customer_name) <= 160),
  constraint finance_manual_sales_reference_len check (reference is null or char_length(reference) <= 100),
  constraint finance_manual_sales_notes_len check (notes is null or char_length(notes) <= 1000),
  constraint finance_manual_sales_void_reason_len check (void_reason is null or char_length(void_reason) <= 500),
  constraint finance_manual_sales_void_shape check (
    (status = 'paid' and voided_at is null and voided_by is null and void_reason is null)
    or
    (status = 'void' and voided_at is not null and void_reason is not null and char_length(trim(void_reason)) > 0)
  )
);

create index finance_manual_sales_occurred_at_idx
  on public.finance_manual_sales (occurred_at desc);
create index finance_manual_sales_status_occurred_at_idx
  on public.finance_manual_sales (status, occurred_at desc);
create index finance_manual_sales_payment_method_occurred_at_idx
  on public.finance_manual_sales (payment_method, occurred_at desc);
create index finance_manual_sales_created_by_idx
  on public.finance_manual_sales (created_by);
create index finance_manual_sales_voided_by_idx
  on public.finance_manual_sales (voided_by);

alter table public.finance_manual_sales enable row level security;

create policy finance_manual_sales_admin_select
on public.finance_manual_sales
for select
to authenticated
using ((select public.is_admin_step_up_authorized()));

create policy finance_manual_sales_admin_insert
on public.finance_manual_sales
for insert
to authenticated
with check ((select public.is_admin_step_up_authorized()));

create policy finance_manual_sales_admin_update
on public.finance_manual_sales
for update
to authenticated
using ((select public.is_admin_step_up_authorized()))
with check ((select public.is_admin_step_up_authorized()));

revoke all on public.finance_manual_sales from public, anon;
grant select, insert on public.finance_manual_sales to authenticated;
grant update (status, voided_at, voided_by, void_reason) on public.finance_manual_sales to authenticated;
grant all on public.finance_manual_sales to service_role;

create or replace function public.create_admin_manual_sale(
  p_occurred_at timestamptz,
  p_customer_name text,
  p_reference text,
  p_payment_method text,
  p_subtotal numeric,
  p_discount numeric,
  p_shipping numeric,
  p_gst_hst_tax numeric,
  p_pst_tax numeric,
  p_cogs numeric,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_payment_method text := lower(trim(coalesce(p_payment_method, 'cash')));
  v_customer_name text := nullif(trim(coalesce(p_customer_name, '')), '');
  v_reference text := nullif(trim(coalesce(p_reference, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_subtotal numeric := round(coalesce(p_subtotal, 0), 2);
  v_discount numeric := round(coalesce(p_discount, 0), 2);
  v_shipping numeric := round(coalesce(p_shipping, 0), 2);
  v_gst numeric := round(coalesce(p_gst_hst_tax, 0), 2);
  v_pst numeric := round(coalesce(p_pst_tax, 0), 2);
  v_cogs numeric := round(coalesce(p_cogs, -1), 2);
  v_row public.finance_manual_sales;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  if v_payment_method not in ('cash','e_transfer','debit','credit_card','cheque','other') then
    raise exception 'invalid manual sale payment method' using errcode = '22023';
  end if;

  if v_subtotal < 0 or v_discount < 0 or v_discount > v_subtotal
     or v_shipping < 0 or v_gst < 0 or v_pst < 0 or v_cogs < 0 then
    raise exception 'manual sale amounts are invalid' using errcode = '22023';
  end if;

  if (v_subtotal - v_discount + v_shipping + v_gst + v_pst) <= 0 then
    raise exception 'manual sale total must be greater than zero' using errcode = '22023';
  end if;

  if char_length(coalesce(v_customer_name,'')) > 160
     or char_length(coalesce(v_reference,'')) > 100
     or char_length(coalesce(v_notes,'')) > 1000 then
    raise exception 'manual sale text field is too long' using errcode = '22001';
  end if;

  insert into public.finance_manual_sales (
    occurred_at, customer_name, reference, payment_method,
    subtotal, discount, shipping, gst_hst_tax, pst_tax, cogs,
    notes, created_by
  )
  values (
    coalesce(p_occurred_at, now()), v_customer_name, v_reference, v_payment_method,
    v_subtotal, v_discount, v_shipping, v_gst, v_pst, v_cogs,
    v_notes, auth.uid()
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.void_admin_manual_sale(
  p_sale_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
  v_row public.finance_manual_sales;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'void reason is required' using errcode = '22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'void reason is too long' using errcode = '22001';
  end if;

  select * into v_row
  from public.finance_manual_sales
  where id = p_sale_id
  for update;

  if v_row.id is null then
    raise exception 'manual sale not found' using errcode = 'P0002';
  end if;
  if v_row.status = 'void' then
    raise exception 'manual sale is already void' using errcode = '22023';
  end if;

  update public.finance_manual_sales
  set status = 'void',
      voided_at = now(),
      voided_by = auth.uid(),
      void_reason = v_reason
  where id = p_sale_id
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.get_admin_manual_sales(
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

  with filtered as (
    select *
    from public.finance_manual_sales s
    where (p_from is null or s.occurred_at >= p_from)
      and (p_to is null or s.occurred_at < p_to)
  ),
  paid as (
    select * from filtered where status = 'paid'
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'metrics', jsonb_build_object(
      'paidSales', (select count(*) from paid),
      'paidRevenue', coalesce((select sum(total) from paid), 0),
      'merchandiseSales', coalesce((select sum(subtotal - discount) from paid), 0),
      'shippingCollected', coalesce((select sum(shipping) from paid), 0),
      'taxCollected', coalesce((select sum(gst_hst_tax + pst_tax) from paid), 0),
      'gstHstCollected', coalesce((select sum(gst_hst_tax) from paid), 0),
      'pstCollected', coalesce((select sum(pst_tax) from paid), 0),
      'cogs', coalesce((select sum(cogs) from paid), 0),
      'grossProfit', coalesce((select sum((subtotal - discount) - cogs) from paid), 0),
      'cashRevenue', coalesce((select sum(total) from paid where payment_method = 'cash'), 0),
      'eTransferRevenue', coalesce((select sum(total) from paid where payment_method = 'e_transfer'), 0),
      'voidedSales', (select count(*) from filtered where status = 'void')
    ),
    'sales', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.occurred_at desc, x.created_at desc)
      from (
        select id, occurred_at, customer_name, reference, payment_method,
          subtotal, discount, shipping, gst_hst_tax, pst_tax, cogs, total,
          currency, tax_jurisdiction, notes, status, created_at,
          voided_at, void_reason
        from filtered
        order by occurred_at desc, created_at desc
        limit v_limit
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.create_admin_manual_sale(timestamptz,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) from public, anon;
revoke all on function public.void_admin_manual_sale(uuid,text) from public, anon;
revoke all on function public.get_admin_manual_sales(timestamptz,timestamptz,integer) from public, anon;
grant execute on function public.create_admin_manual_sale(timestamptz,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text) to authenticated, service_role;
grant execute on function public.void_admin_manual_sale(uuid,text) to authenticated, service_role;
grant execute on function public.get_admin_manual_sales(timestamptz,timestamptz,integer) to authenticated, service_role;

alter function public.get_admin_finance_snapshot(timestamptz,timestamptz,integer)
  rename to get_admin_finance_snapshot_orders_only;

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
  v_limit integer := greatest(25, least(1000, coalesce(p_limit,250)));
  v_base jsonb;
  v_metrics jsonb;
  v_manual_rows jsonb := '[]'::jsonb;
  v_manual_count integer := 0;
  v_manual_gross numeric := 0;
  v_manual_discounts numeric := 0;
  v_manual_shipping numeric := 0;
  v_manual_tax numeric := 0;
  v_manual_revenue numeric := 0;
  v_manual_cogs numeric := 0;
  v_base_gross numeric := 0;
  v_base_discounts numeric := 0;
  v_base_cogs numeric := 0;
  v_base_total_items numeric := 0;
  v_base_configured_items numeric := 0;
  v_total_items numeric := 0;
  v_configured_items numeric := 0;
  v_net_merch numeric := 0;
  v_gross_profit numeric := 0;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  v_base := public.get_admin_finance_snapshot_orders_only(p_from, p_to, p_limit);
  v_metrics := coalesce(v_base->'metrics', '{}'::jsonb);

  select
    count(*)::integer,
    coalesce(sum(s.subtotal),0),
    coalesce(sum(s.discount),0),
    coalesce(sum(s.shipping),0),
    coalesce(sum(s.gst_hst_tax + s.pst_tax),0),
    coalesce(sum(s.total),0),
    coalesce(sum(s.cogs),0)
  into
    v_manual_count, v_manual_gross, v_manual_discounts, v_manual_shipping,
    v_manual_tax, v_manual_revenue, v_manual_cogs
  from public.finance_manual_sales s
  where s.status = 'paid'
    and (p_from is null or s.occurred_at >= p_from)
    and (p_to is null or s.occurred_at < p_to);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc), '[]'::jsonb)
  into v_manual_rows
  from (
    select id, occurred_at, customer_name, reference, payment_method,
      subtotal, discount, shipping, gst_hst_tax, pst_tax, cogs, total,
      tax_jurisdiction, notes, status
    from public.finance_manual_sales s
    where (p_from is null or s.occurred_at >= p_from)
      and (p_to is null or s.occurred_at < p_to)
    order by s.occurred_at desc, s.created_at desc
    limit v_limit
  ) x;

  v_base_gross := coalesce((v_metrics->>'grossSales')::numeric,0);
  v_base_discounts := coalesce((v_metrics->>'discounts')::numeric,0);
  v_base_cogs := coalesce((v_metrics->>'cogs')::numeric,0);
  v_base_total_items := coalesce((v_metrics->>'cogsTotalItems')::numeric,0);
  v_base_configured_items := coalesce((v_metrics->>'cogsConfiguredItems')::numeric,0);
  v_total_items := v_base_total_items + v_manual_count;
  v_configured_items := v_base_configured_items + v_manual_count;
  v_net_merch := (v_base_gross + v_manual_gross) - (v_base_discounts + v_manual_discounts);

  if v_total_items = v_configured_items then
    v_gross_profit := v_net_merch - (v_base_cogs + v_manual_cogs);
  else
    v_gross_profit := null;
  end if;

  v_metrics := v_metrics || jsonb_build_object(
    'grossSales', v_base_gross + v_manual_gross,
    'discounts', v_base_discounts + v_manual_discounts,
    'shippingCollected', coalesce((v_metrics->>'shippingCollected')::numeric,0) + v_manual_shipping,
    'taxCollected', coalesce((v_metrics->>'taxCollected')::numeric,0) + v_manual_tax,
    'paidRevenue', coalesce((v_metrics->>'paidRevenue')::numeric,0) + v_manual_revenue,
    'cogs', v_base_cogs + v_manual_cogs,
    'otherCogs', coalesce((v_metrics->>'otherCogs')::numeric,0) + v_manual_cogs,
    'manualCogs', v_manual_cogs,
    'cogsTotalItems', v_total_items,
    'cogsConfiguredItems', v_configured_items,
    'cogsCoveragePercent', case
      when v_total_items = 0 then 100
      else round((v_configured_items / v_total_items) * 100, 1)
    end,
    'grossProfit', v_gross_profit,
    'grossMarginPercent', case
      when v_gross_profit is not null and v_net_merch > 0
        then round((v_gross_profit / v_net_merch) * 100, 1)
      else null
    end,
    'manualSalesCount', v_manual_count,
    'manualSalesRevenue', v_manual_revenue,
    'recordedSalesCount', coalesce((v_metrics->>'paidOrders')::numeric,0) + v_manual_count
  );

  return jsonb_set(v_base, '{metrics}', v_metrics, true)
    || jsonb_build_object('manualSales', v_manual_rows);
end;
$$;

revoke all on function public.get_admin_finance_snapshot_orders_only(timestamptz,timestamptz,integer) from public, anon;
revoke all on function public.get_admin_finance_snapshot(timestamptz,timestamptz,integer) from public, anon;
grant execute on function public.get_admin_finance_snapshot_orders_only(timestamptz,timestamptz,integer) to authenticated, service_role;
grant execute on function public.get_admin_finance_snapshot(timestamptz,timestamptz,integer) to authenticated, service_role;

alter function public.get_admin_tax_center(timestamptz,timestamptz,integer)
  rename to get_admin_tax_center_orders_only;

create or replace function public.get_admin_tax_center(
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
  v_base jsonb;
  v_summary jsonb;
  v_manual_sales jsonb := '[]'::jsonb;
  v_gst numeric := 0;
  v_pst numeric := 0;
  v_tax numeric := 0;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  v_base := public.get_admin_tax_center_orders_only(p_from, p_to, p_limit);
  v_summary := coalesce(v_base->'summary','{}'::jsonb);

  select
    coalesce(sum(s.gst_hst_tax),0),
    coalesce(sum(s.pst_tax),0),
    coalesce(sum(s.gst_hst_tax + s.pst_tax),0)
  into v_gst, v_pst, v_tax
  from public.finance_manual_sales s
  where s.status = 'paid'
    and (p_from is null or s.occurred_at >= p_from)
    and (p_to is null or s.occurred_at < p_to);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc), '[]'::jsonb)
  into v_manual_sales
  from (
    select id, occurred_at, reference, payment_method, subtotal, discount, shipping,
      (gst_hst_tax + pst_tax) as tax, gst_hst_tax, pst_tax, tax_jurisdiction, total
    from public.finance_manual_sales s
    where s.status = 'paid'
      and (p_from is null or s.occurred_at >= p_from)
      and (p_to is null or s.occurred_at < p_to)
    order by s.occurred_at desc, s.created_at desc
    limit greatest(25, least(1000, coalesce(p_limit,250)))
  ) x;

  v_summary := v_summary || jsonb_build_object(
    'salesTaxTotal', coalesce((v_summary->>'salesTaxTotal')::numeric,0) + v_tax,
    'gstHstCollected', coalesce((v_summary->>'gstHstCollected')::numeric,0) + v_gst,
    'gstHstNetCollected', coalesce((v_summary->>'gstHstNetCollected')::numeric,0) + v_gst,
    'gstHstEstimateBeforeAdjustments', coalesce((v_summary->>'gstHstEstimateBeforeAdjustments')::numeric,0) + v_gst,
    'pstCollected', coalesce((v_summary->>'pstCollected')::numeric,0) + v_pst,
    'pstNetCollected', coalesce((v_summary->>'pstNetCollected')::numeric,0) + v_pst,
    'manualSalesTaxTotal', v_tax,
    'manualGstHstCollected', v_gst,
    'manualPstCollected', v_pst
  );

  return jsonb_set(v_base, '{summary}', v_summary, true)
    || jsonb_build_object('manualSales', v_manual_sales);
end;
$$;

revoke all on function public.get_admin_tax_center_orders_only(timestamptz,timestamptz,integer) from public, anon;
revoke all on function public.get_admin_tax_center(timestamptz,timestamptz,integer) from public, anon;
grant execute on function public.get_admin_tax_center_orders_only(timestamptz,timestamptz,integer) to authenticated, service_role;
grant execute on function public.get_admin_tax_center(timestamptz,timestamptz,integer) to authenticated, service_role;

commit;
