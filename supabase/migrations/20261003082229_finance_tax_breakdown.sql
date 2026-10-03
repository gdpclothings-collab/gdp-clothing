begin;

alter table public.orders
  add column if not exists gst_hst_tax numeric(12,2) not null default 0,
  add column if not exists pst_tax numeric(12,2) not null default 0,
  add column if not exists tax_jurisdiction text,
  add column if not exists tax_breakdown jsonb not null default '{}'::jsonb;

alter table public.orders
  drop constraint if exists orders_gst_hst_tax_nonnegative,
  add constraint orders_gst_hst_tax_nonnegative check (gst_hst_tax >= 0),
  drop constraint if exists orders_pst_tax_nonnegative,
  add constraint orders_pst_tax_nonnegative check (pst_tax >= 0);

alter table public.finance_expenses
  add column if not exists gst_hst_tax numeric(12,2) not null default 0,
  add column if not exists pst_tax numeric(12,2) not null default 0,
  add column if not exists gst_hst_itc_eligible boolean not null default false;

alter table public.finance_expenses
  drop constraint if exists finance_expenses_gst_hst_tax_nonnegative,
  add constraint finance_expenses_gst_hst_tax_nonnegative check (gst_hst_tax >= 0),
  drop constraint if exists finance_expenses_pst_tax_nonnegative,
  add constraint finance_expenses_pst_tax_nonnegative check (pst_tax >= 0);

alter table public.refunds
  add column if not exists gst_hst_tax numeric(12,2) not null default 0,
  add column if not exists pst_tax numeric(12,2) not null default 0,
  add column if not exists tax_allocation_method text;

alter table public.refunds
  drop constraint if exists refunds_gst_hst_tax_nonnegative,
  add constraint refunds_gst_hst_tax_nonnegative check (gst_hst_tax >= 0),
  drop constraint if exists refunds_pst_tax_nonnegative,
  add constraint refunds_pst_tax_nonnegative check (pst_tax >= 0);

update public.tax_rules
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'components', jsonb_build_array(
    jsonb_build_object('code','GST','bucket','gst_hst','rate',0.05,'tax_shipping',true),
    jsonb_build_object('code','PST','bucket','pst','rate',0.06,'tax_shipping',false)
  ),
  'effective_from', '2026-10-03',
  'shipping_note', 'Saskatchewan-origin separately stated delivery is excluded from PST; GST still applies.'
)
where country_code = 'CA' and region_code = 'SK' and active = true;

update public.tax_rules
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'components', jsonb_build_array(
    jsonb_build_object('code','HST','bucket','gst_hst','rate',rate,'tax_shipping',tax_shipping)
  ),
  'effective_from', '2026-10-03'
)
where country_code = 'CA' and region_code in ('NB','NL','NS','ON','PE') and active = true;

update public.tax_rules
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'components', jsonb_build_array(
    jsonb_build_object('code','GST','bucket','gst_hst','rate',rate,'tax_shipping',tax_shipping)
  ),
  'effective_from', '2026-10-03'
)
where country_code = 'CA' and region_code is null and active = true;

create or replace function public.finance_expense_tax_defaults()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_expected numeric;
begin
  new.gst_hst_tax := greatest(0, coalesce(new.gst_hst_tax, 0));
  new.pst_tax := greatest(0, coalesce(new.pst_tax, 0));
  new.tax := greatest(0, coalesce(new.tax, 0));

  if new.gst_hst_tax > 0 or new.pst_tax > 0 then
    new.tax := round(new.gst_hst_tax + new.pst_tax, 2);
    return new;
  end if;

  if new.amount > 0 and new.tax > 0 then
    v_expected := round(new.amount * 0.11, 2);
    if abs(new.tax - v_expected) <= 0.02 then
      new.gst_hst_tax := round(new.amount * 0.05, 2);
      new.pst_tax := greatest(0, round(new.tax - new.gst_hst_tax, 2));
      return new;
    end if;

    v_expected := round(new.amount * 0.05, 2);
    if abs(new.tax - v_expected) <= 0.02 then
      new.gst_hst_tax := new.tax;
      return new;
    end if;

    v_expected := round(new.amount * 0.06, 2);
    if abs(new.tax - v_expected) <= 0.02 then
      new.pst_tax := new.tax;
      return new;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.finance_expense_tax_defaults() from public, anon, authenticated;

drop trigger if exists finance_expense_tax_defaults_trigger on public.finance_expenses;
create trigger finance_expense_tax_defaults_trigger
before insert or update of amount, tax, gst_hst_tax, pst_tax
on public.finance_expenses
for each row execute function public.finance_expense_tax_defaults();

create or replace function public.refund_tax_defaults()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_total numeric;
  v_gst_hst numeric;
  v_pst numeric;
  v_ratio numeric;
begin
  new.gst_hst_tax := greatest(0, coalesce(new.gst_hst_tax, 0));
  new.pst_tax := greatest(0, coalesce(new.pst_tax, 0));

  if new.gst_hst_tax > 0 or new.pst_tax > 0 or new.order_id is null or coalesce(new.amount,0) <= 0 then
    if new.tax_allocation_method is null and (new.gst_hst_tax > 0 or new.pst_tax > 0) then
      new.tax_allocation_method := 'explicit';
    end if;
    return new;
  end if;

  select o.total, o.gst_hst_tax, o.pst_tax
  into v_total, v_gst_hst, v_pst
  from public.orders o
  where o.id = new.order_id;

  if coalesce(v_total,0) <= 0 or (coalesce(v_gst_hst,0) + coalesce(v_pst,0)) <= 0 then
    return new;
  end if;

  v_ratio := least(1, greatest(0, new.amount / v_total));
  new.gst_hst_tax := round(coalesce(v_gst_hst,0) * v_ratio, 2);
  new.pst_tax := round(coalesce(v_pst,0) * v_ratio, 2);
  new.tax_allocation_method := case when v_ratio >= 0.9999 then 'full_refund' else 'proportional_estimate' end;
  return new;
end;
$$;

revoke all on function public.refund_tax_defaults() from public, anon, authenticated;

drop trigger if exists refund_tax_defaults_trigger on public.refunds;
create trigger refund_tax_defaults_trigger
before insert or update of order_id, amount, gst_hst_tax, pst_tax
on public.refunds
for each row execute function public.refund_tax_defaults();

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
  v_limit integer := greatest(25, least(1000, coalesce(p_limit,250)));
  v_sales_gst_hst numeric := 0;
  v_sales_pst numeric := 0;
  v_sales_tax numeric := 0;
  v_refund_gst_hst numeric := 0;
  v_refund_pst numeric := 0;
  v_expense_gst_hst numeric := 0;
  v_expense_pst numeric := 0;
  v_itc_gst_hst numeric := 0;
  v_unclassified_sales numeric := 0;
  v_unclassified_expenses numeric := 0;
  v_unclassified_refunds numeric := 0;
  v_estimated_refund_count integer := 0;
  v_sales jsonb := '[]'::jsonb;
  v_expenses jsonb := '[]'::jsonb;
  v_refunds jsonb := '[]'::jsonb;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  select
    coalesce(sum(o.gst_hst_tax),0),
    coalesce(sum(o.pst_tax),0),
    coalesce(sum(o.tax),0),
    coalesce(sum(greatest(0, o.tax - o.gst_hst_tax - o.pst_tax)),0)
  into v_sales_gst_hst, v_sales_pst, v_sales_tax, v_unclassified_sales
  from public.orders o
  where o.payment_mode = 'live'
    and o.payment_status = 'paid'
    and (p_from is null or o.created_at >= p_from)
    and (p_to is null or o.created_at < p_to);

  select
    coalesce(sum(r.gst_hst_tax),0),
    coalesce(sum(r.pst_tax),0),
    coalesce(sum(greatest(0, least(r.amount, o.tax) - r.gst_hst_tax - r.pst_tax)) filter (where r.status in ('processed','completed','succeeded')),0),
    count(*) filter (where r.status in ('processed','completed','succeeded') and r.tax_allocation_method = 'proportional_estimate')::integer
  into v_refund_gst_hst, v_refund_pst, v_unclassified_refunds, v_estimated_refund_count
  from public.refunds r
  join public.orders o on o.id = r.order_id
  where o.payment_mode = 'live'
    and r.status in ('processed','completed','succeeded')
    and (p_from is null or coalesce(r.processed_at,r.created_at) >= p_from)
    and (p_to is null or coalesce(r.processed_at,r.created_at) < p_to);

  select
    coalesce(sum(e.gst_hst_tax),0),
    coalesce(sum(e.pst_tax),0),
    coalesce(sum(e.gst_hst_tax) filter (where e.gst_hst_itc_eligible),0),
    coalesce(sum(greatest(0, e.tax - e.gst_hst_tax - e.pst_tax)),0)
  into v_expense_gst_hst, v_expense_pst, v_itc_gst_hst, v_unclassified_expenses
  from public.finance_expenses e
  where (p_from is null or e.occurred_on >= (p_from at time zone 'America/Regina')::date)
    and (p_to is null or e.occurred_on < (p_to at time zone 'America/Regina')::date);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into v_sales
  from (
    select o.id, o.order_number, o.created_at, o.subtotal, o.discount, o.shipping,
      o.tax, o.gst_hst_tax, o.pst_tax, o.tax_jurisdiction, o.tax_breakdown
    from public.orders o
    where o.payment_mode = 'live' and o.payment_status = 'paid'
      and (p_from is null or o.created_at >= p_from)
      and (p_to is null or o.created_at < p_to)
    order by o.created_at desc
    limit v_limit
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_on desc, x.created_at desc), '[]'::jsonb)
  into v_expenses
  from (
    select e.id, e.occurred_on, e.vendor, e.category, e.description, e.amount, e.tax,
      e.gst_hst_tax, e.pst_tax, e.gst_hst_itc_eligible, e.currency, e.created_at
    from public.finance_expenses e
    where (p_from is null or e.occurred_on >= (p_from at time zone 'America/Regina')::date)
      and (p_to is null or e.occurred_on < (p_to at time zone 'America/Regina')::date)
    order by e.occurred_on desc, e.created_at desc
    limit v_limit
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.refund_date desc), '[]'::jsonb)
  into v_refunds
  from (
    select r.id, o.order_number, r.amount, r.status, r.gst_hst_tax, r.pst_tax,
      r.tax_allocation_method, coalesce(r.processed_at,r.created_at) as refund_date
    from public.refunds r
    join public.orders o on o.id = r.order_id
    where o.payment_mode = 'live'
      and (p_from is null or coalesce(r.processed_at,r.created_at) >= p_from)
      and (p_to is null or coalesce(r.processed_at,r.created_at) < p_to)
    order by coalesce(r.processed_at,r.created_at) desc
    limit v_limit
  ) x;

  return jsonb_build_object(
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'salesTaxTotal', v_sales_tax,
      'gstHstCollected', v_sales_gst_hst,
      'gstHstRefunded', v_refund_gst_hst,
      'gstHstNetCollected', v_sales_gst_hst - v_refund_gst_hst,
      'gstHstExpenseRecorded', v_expense_gst_hst,
      'gstHstPotentialItc', v_itc_gst_hst,
      'gstHstEstimateBeforeAdjustments', v_sales_gst_hst - v_refund_gst_hst - v_itc_gst_hst,
      'pstCollected', v_sales_pst,
      'pstRefunded', v_refund_pst,
      'pstNetCollected', v_sales_pst - v_refund_pst,
      'pstExpensePaid', v_expense_pst,
      'unclassifiedSalesTax', v_unclassified_sales,
      'unclassifiedExpenseTax', v_unclassified_expenses,
      'unclassifiedRefundTax', v_unclassified_refunds,
      'estimatedRefundAllocations', v_estimated_refund_count,
      'breakdownComplete', (v_unclassified_sales + v_unclassified_expenses + v_unclassified_refunds) = 0,
      'filingReady', false
    ),
    'rates', jsonb_build_object(
      'saskatchewan', jsonb_build_object(
        'gst', 0.05,
        'pst', 0.06,
        'gstShippingTaxable', true,
        'pstShippingTaxableForSaskatchewanOrigin', false,
        'effectiveFrom', '2026-10-03'
      )
    ),
    'sales', v_sales,
    'expenses', v_expenses,
    'refunds', v_refunds
  );
end;
$$;

revoke all on function public.get_admin_tax_center(timestamptz,timestamptz,integer) from public, anon;
grant execute on function public.get_admin_tax_center(timestamptz,timestamptz,integer) to authenticated;

create or replace function public.update_admin_expense_tax(
  p_expense_id uuid,
  p_gst_hst_tax numeric,
  p_pst_tax numeric,
  p_itc_eligible boolean default false
)
returns public.finance_expenses
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_row public.finance_expenses;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_gst_hst_tax is null or p_pst_tax is null or p_gst_hst_tax < 0 or p_pst_tax < 0 then
    raise exception 'tax amounts must be non-negative' using errcode = '22003';
  end if;

  update public.finance_expenses
  set gst_hst_tax = round(p_gst_hst_tax,2),
      pst_tax = round(p_pst_tax,2),
      tax = round(p_gst_hst_tax + p_pst_tax,2),
      gst_hst_itc_eligible = coalesce(p_itc_eligible,false),
      updated_at = now()
  where id = p_expense_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'expense not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke all on function public.update_admin_expense_tax(uuid,numeric,numeric,boolean) from public, anon;
grant execute on function public.update_admin_expense_tax(uuid,numeric,numeric,boolean) to authenticated;

comment on function public.get_admin_tax_center(timestamptz,timestamptz,integer) is
  'AAL2 admin-only GST/HST and PST operational tax ledger. FilingReady remains false until registration numbers, filing-period controls, and review workflow are configured.';

commit;
