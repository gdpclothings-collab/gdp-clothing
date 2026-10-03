begin;

create or replace function public.get_admin_finance_reports(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_prev_from timestamptz default null,
  p_prev_to timestamptz default null,
  p_months integer default 12
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_months integer := greatest(1, least(24, coalesce(p_months, 12)));
  v_current_finance jsonb;
  v_current_stripe jsonb;
  v_previous_finance jsonb;
  v_previous_stripe jsonb;
  v_current_finance_metrics jsonb;
  v_current_stripe_metrics jsonb;
  v_previous_finance_metrics jsonb;
  v_previous_stripe_metrics jsonb;
  v_current jsonb;
  v_previous jsonb := null;
  v_monthly jsonb := '[]'::jsonb;
  v_expense_breakdown jsonb := '[]'::jsonb;
  v_tax_summary jsonb;
  v_month_start_local timestamp;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_month_finance jsonb;
  v_month_stripe jsonb;
  v_fin jsonb;
  v_stripe jsonb;
  v_gross_sales numeric;
  v_discounts numeric;
  v_net_sales numeric;
  v_shipping numeric;
  v_tax numeric;
  v_paid_revenue numeric;
  v_paid_orders numeric;
  v_cogs numeric;
  v_cogs_total numeric;
  v_cogs_configured numeric;
  v_gross_profit numeric;
  v_refunds numeric;
  v_expenses numeric;
  v_fees numeric;
  v_fee_expected numeric;
  v_fee_captured numeric;
  v_cogs_complete boolean;
  v_fees_complete boolean;
  v_net_profit numeric;
  v_profit_base numeric;
  v_net_margin numeric;
  v_expense_tax numeric;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  v_current_finance := public.get_admin_finance_snapshot(p_from, p_to, 25);
  v_current_stripe := public.get_admin_stripe_finance_snapshot(p_from, p_to, 25);
  v_current_finance_metrics := coalesce(v_current_finance->'metrics', '{}'::jsonb);
  v_current_stripe_metrics := coalesce(v_current_stripe->'metrics', '{}'::jsonb);

  v_gross_sales := coalesce((v_current_finance_metrics->>'grossSales')::numeric, 0);
  v_discounts := coalesce((v_current_finance_metrics->>'discounts')::numeric, 0);
  v_net_sales := v_gross_sales - v_discounts;
  v_shipping := coalesce((v_current_finance_metrics->>'shippingCollected')::numeric, 0);
  v_tax := coalesce((v_current_finance_metrics->>'taxCollected')::numeric, 0);
  v_paid_revenue := coalesce((v_current_finance_metrics->>'paidRevenue')::numeric, 0);
  v_paid_orders := coalesce((v_current_finance_metrics->>'paidOrders')::numeric, 0);
  v_cogs := coalesce((v_current_finance_metrics->>'cogs')::numeric, 0);
  v_cogs_total := coalesce((v_current_finance_metrics->>'cogsTotalItems')::numeric, 0);
  v_cogs_configured := coalesce((v_current_finance_metrics->>'cogsConfiguredItems')::numeric, 0);
  v_gross_profit := (v_current_finance_metrics->>'grossProfit')::numeric;
  v_refunds := coalesce((v_current_finance_metrics->>'recordedRefunds')::numeric, 0);
  v_expenses := coalesce((v_current_finance_metrics->>'expenses')::numeric, 0);
  v_fees := coalesce((v_current_stripe_metrics->>'processorFees')::numeric, 0);
  v_fee_expected := coalesce((v_current_stripe_metrics->>'stripeFeeExpectedOrders')::numeric, 0);
  v_fee_captured := coalesce((v_current_stripe_metrics->>'stripeFeeCapturedOrders')::numeric, 0);
  v_cogs_complete := v_cogs_total = v_cogs_configured;
  v_fees_complete := v_fee_expected = v_fee_captured;
  v_profit_base := v_net_sales + v_shipping;
  v_net_profit := case
    when v_cogs_complete and v_fees_complete and v_gross_profit is not null
      then v_gross_profit + v_shipping - v_refunds - v_expenses - v_fees
    else null
  end;
  v_net_margin := case
    when v_net_profit is not null and v_profit_base > 0
      then round((v_net_profit / v_profit_base) * 100, 1)
    else null
  end;

  v_current := jsonb_build_object(
    'grossSales', v_gross_sales,
    'discounts', v_discounts,
    'netMerchandiseSales', v_net_sales,
    'shippingCollected', v_shipping,
    'taxCollected', v_tax,
    'paidRevenue', v_paid_revenue,
    'paidOrders', v_paid_orders,
    'cogs', v_cogs,
    'grossProfit', v_gross_profit,
    'grossMarginPercent', (v_current_finance_metrics->>'grossMarginPercent')::numeric,
    'recordedRefunds', v_refunds,
    'expenses', v_expenses,
    'processorFees', v_fees,
    'netProfit', v_net_profit,
    'netMarginPercent', v_net_margin,
    'cogsComplete', v_cogs_complete,
    'stripeFeesComplete', v_fees_complete,
    'complete', v_cogs_complete and v_fees_complete
  );

  if p_prev_from is not null or p_prev_to is not null then
    v_previous_finance := public.get_admin_finance_snapshot(p_prev_from, p_prev_to, 25);
    v_previous_stripe := public.get_admin_stripe_finance_snapshot(p_prev_from, p_prev_to, 25);
    v_previous_finance_metrics := coalesce(v_previous_finance->'metrics', '{}'::jsonb);
    v_previous_stripe_metrics := coalesce(v_previous_stripe->'metrics', '{}'::jsonb);

    v_gross_sales := coalesce((v_previous_finance_metrics->>'grossSales')::numeric, 0);
    v_discounts := coalesce((v_previous_finance_metrics->>'discounts')::numeric, 0);
    v_net_sales := v_gross_sales - v_discounts;
    v_shipping := coalesce((v_previous_finance_metrics->>'shippingCollected')::numeric, 0);
    v_tax := coalesce((v_previous_finance_metrics->>'taxCollected')::numeric, 0);
    v_paid_revenue := coalesce((v_previous_finance_metrics->>'paidRevenue')::numeric, 0);
    v_paid_orders := coalesce((v_previous_finance_metrics->>'paidOrders')::numeric, 0);
    v_cogs := coalesce((v_previous_finance_metrics->>'cogs')::numeric, 0);
    v_cogs_total := coalesce((v_previous_finance_metrics->>'cogsTotalItems')::numeric, 0);
    v_cogs_configured := coalesce((v_previous_finance_metrics->>'cogsConfiguredItems')::numeric, 0);
    v_gross_profit := (v_previous_finance_metrics->>'grossProfit')::numeric;
    v_refunds := coalesce((v_previous_finance_metrics->>'recordedRefunds')::numeric, 0);
    v_expenses := coalesce((v_previous_finance_metrics->>'expenses')::numeric, 0);
    v_fees := coalesce((v_previous_stripe_metrics->>'processorFees')::numeric, 0);
    v_fee_expected := coalesce((v_previous_stripe_metrics->>'stripeFeeExpectedOrders')::numeric, 0);
    v_fee_captured := coalesce((v_previous_stripe_metrics->>'stripeFeeCapturedOrders')::numeric, 0);
    v_cogs_complete := v_cogs_total = v_cogs_configured;
    v_fees_complete := v_fee_expected = v_fee_captured;
    v_profit_base := v_net_sales + v_shipping;
    v_net_profit := case
      when v_cogs_complete and v_fees_complete and v_gross_profit is not null
        then v_gross_profit + v_shipping - v_refunds - v_expenses - v_fees
      else null
    end;
    v_net_margin := case
      when v_net_profit is not null and v_profit_base > 0
        then round((v_net_profit / v_profit_base) * 100, 1)
      else null
    end;

    v_previous := jsonb_build_object(
      'grossSales', v_gross_sales,
      'discounts', v_discounts,
      'netMerchandiseSales', v_net_sales,
      'shippingCollected', v_shipping,
      'taxCollected', v_tax,
      'paidRevenue', v_paid_revenue,
      'paidOrders', v_paid_orders,
      'cogs', v_cogs,
      'grossProfit', v_gross_profit,
      'grossMarginPercent', (v_previous_finance_metrics->>'grossMarginPercent')::numeric,
      'recordedRefunds', v_refunds,
      'expenses', v_expenses,
      'processorFees', v_fees,
      'netProfit', v_net_profit,
      'netMarginPercent', v_net_margin,
      'cogsComplete', v_cogs_complete,
      'stripeFeesComplete', v_fees_complete,
      'complete', v_cogs_complete and v_fees_complete
    );
  end if;

  for v_month_start_local in
    select generate_series(
      date_trunc('month', now() at time zone 'America/Regina') - ((v_months - 1) * interval '1 month'),
      date_trunc('month', now() at time zone 'America/Regina'),
      interval '1 month'
    )
  loop
    v_month_start := v_month_start_local at time zone 'America/Regina';
    v_month_end := (v_month_start_local + interval '1 month') at time zone 'America/Regina';
    v_month_finance := public.get_admin_finance_snapshot(v_month_start, v_month_end, 25);
    v_month_stripe := public.get_admin_stripe_finance_snapshot(v_month_start, v_month_end, 25);
    v_fin := coalesce(v_month_finance->'metrics', '{}'::jsonb);
    v_stripe := coalesce(v_month_stripe->'metrics', '{}'::jsonb);

    v_gross_sales := coalesce((v_fin->>'grossSales')::numeric, 0);
    v_discounts := coalesce((v_fin->>'discounts')::numeric, 0);
    v_net_sales := v_gross_sales - v_discounts;
    v_shipping := coalesce((v_fin->>'shippingCollected')::numeric, 0);
    v_tax := coalesce((v_fin->>'taxCollected')::numeric, 0);
    v_paid_revenue := coalesce((v_fin->>'paidRevenue')::numeric, 0);
    v_paid_orders := coalesce((v_fin->>'paidOrders')::numeric, 0);
    v_cogs := coalesce((v_fin->>'cogs')::numeric, 0);
    v_cogs_total := coalesce((v_fin->>'cogsTotalItems')::numeric, 0);
    v_cogs_configured := coalesce((v_fin->>'cogsConfiguredItems')::numeric, 0);
    v_gross_profit := (v_fin->>'grossProfit')::numeric;
    v_refunds := coalesce((v_fin->>'recordedRefunds')::numeric, 0);
    v_expenses := coalesce((v_fin->>'expenses')::numeric, 0);
    v_fees := coalesce((v_stripe->>'processorFees')::numeric, 0);
    v_fee_expected := coalesce((v_stripe->>'stripeFeeExpectedOrders')::numeric, 0);
    v_fee_captured := coalesce((v_stripe->>'stripeFeeCapturedOrders')::numeric, 0);
    v_cogs_complete := v_cogs_total = v_cogs_configured;
    v_fees_complete := v_fee_expected = v_fee_captured;
    v_profit_base := v_net_sales + v_shipping;
    v_net_profit := case
      when v_cogs_complete and v_fees_complete and v_gross_profit is not null
        then v_gross_profit + v_shipping - v_refunds - v_expenses - v_fees
      else null
    end;
    v_net_margin := case
      when v_net_profit is not null and v_profit_base > 0
        then round((v_net_profit / v_profit_base) * 100, 1)
      else null
    end;

    v_monthly := v_monthly || jsonb_build_array(jsonb_build_object(
      'month', to_char(v_month_start_local, 'YYYY-MM'),
      'monthStart', v_month_start,
      'grossSales', v_gross_sales,
      'discounts', v_discounts,
      'netMerchandiseSales', v_net_sales,
      'shippingCollected', v_shipping,
      'taxCollected', v_tax,
      'paidRevenue', v_paid_revenue,
      'paidOrders', v_paid_orders,
      'cogs', v_cogs,
      'grossProfit', v_gross_profit,
      'recordedRefunds', v_refunds,
      'expenses', v_expenses,
      'processorFees', v_fees,
      'netProfit', v_net_profit,
      'netMarginPercent', v_net_margin,
      'cogsComplete', v_cogs_complete,
      'stripeFeesComplete', v_fees_complete,
      'complete', v_cogs_complete and v_fees_complete
    ));
  end loop;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.total desc, x.category), '[]'::jsonb)
  into v_expense_breakdown
  from (
    select
      e.category,
      count(*)::integer as entries,
      coalesce(sum(e.amount), 0) as amount,
      coalesce(sum(e.tax), 0) as tax,
      coalesce(sum(e.amount + e.tax), 0) as total
    from public.finance_expenses e
    where (p_from is null or e.occurred_on >= (p_from at time zone 'America/Regina')::date)
      and (p_to is null or e.occurred_on < (p_to at time zone 'America/Regina')::date)
    group by e.category
  ) x;

  select coalesce(sum(e.tax), 0)
  into v_expense_tax
  from public.finance_expenses e
  where (p_from is null or e.occurred_on >= (p_from at time zone 'America/Regina')::date)
    and (p_to is null or e.occurred_on < (p_to at time zone 'America/Regina')::date);

  v_tax_summary := jsonb_build_object(
    'salesTaxCollected', coalesce((v_current_finance_metrics->>'taxCollected')::numeric, 0),
    'expenseTaxRecorded', coalesce(v_expense_tax, 0),
    'differenceInformational', coalesce((v_current_finance_metrics->>'taxCollected')::numeric, 0) - coalesce(v_expense_tax, 0),
    'combinedTaxLedger', true,
    'filingReady', false
  );

  return jsonb_build_object(
    'generatedAt', now(),
    'reportVersion', 1,
    'current', v_current,
    'previous', v_previous,
    'monthlyPnl', v_monthly,
    'expenseBreakdown', v_expense_breakdown,
    'taxSummary', v_tax_summary
  );
end;
$$;

revoke all on function public.get_admin_finance_reports(timestamptz, timestamptz, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.get_admin_finance_reports(timestamptz, timestamptz, timestamptz, timestamptz, integer) to authenticated;

comment on function public.get_admin_finance_reports(timestamptz, timestamptz, timestamptz, timestamptz, integer) is
  'AAL2/admin-only aggregated finance reporting for period comparison, trailing monthly P&L, expense categories, and operational combined-tax summaries. Reuses the secured Finance and Stripe snapshots so accounting definitions remain consistent.';

commit;
