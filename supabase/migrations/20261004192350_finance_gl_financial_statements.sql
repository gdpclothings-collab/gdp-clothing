begin;

create or replace function private.finance_get_financial_statements_impl(
  p_as_of date default null,
  p_period_from date default null,
  p_period_to date default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_today date := (now() at time zone 'America/Regina')::date;
  v_as_of date := coalesce(p_as_of, (now() at time zone 'America/Regina')::date);
  v_period_to date := coalesce(p_period_to, coalesce(p_as_of, (now() at time zone 'America/Regina')::date));
  v_period_from date := coalesce(p_period_from, date_trunc('month', coalesce(p_period_to, coalesce(p_as_of, (now() at time zone 'America/Regina')::date))::timestamp)::date);
  v_cutover public.finance_opening_balance_cutovers;
  v_first_activity date;
  v_last_activity date;
  v_failure_count integer := 0;
  v_pending_cogs integer := 0;
  v_inventory_units bigint := 0;
  v_costed_units bigint := 0;
  v_known_inventory numeric(16,2) := 0;
  v_negative_inventory integer := 0;
  v_ledger_debits numeric(18,2) := 0;
  v_ledger_credits numeric(18,2) := 0;
  v_ledger_difference numeric(18,2) := 0;
  v_source_complete boolean := false;
  v_period_covered boolean := false;
  v_balance_sheet_authoritative boolean := false;
  v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  if v_as_of > v_today then
    raise exception 'statement as-of date cannot be in the future' using errcode='22023';
  end if;
  if v_period_from > v_period_to then
    raise exception 'statement period start must be on or before period end' using errcode='22023';
  end if;
  if v_period_to > v_as_of then
    raise exception 'profit and loss period cannot end after the balance-sheet as-of date' using errcode='22023';
  end if;

  select min(entry_date), max(entry_date)
    into v_first_activity, v_last_activity
  from public.finance_journal_entries
  where source_type not in ('opening_balance','opening_reversal');

  select * into v_cutover
  from public.finance_opening_balance_cutovers
  where status='posted'
  order by posted_at desc nulls last, updated_at desc
  limit 1;

  select count(*)::integer into v_failure_count
  from public.finance_ledger_posting_failures
  where resolved_at is null;

  select count(*)::integer into v_pending_cogs
  from public.orders o
  where coalesce(o.payment_mode,'live')='live'
    and o.payment_status in ('paid','refunded','partially_refunded')
    and exists(
      select 1
      from public.order_items oi
      left join public.finance_order_item_costs c on c.order_item_id=oi.id
      where oi.order_id=o.id and not coalesce(c.is_configured,false)
    );

  select
    coalesce(sum(greatest(coalesce(il.available,0)+coalesce(il.committed,0),0)),0),
    coalesce(sum(case when coalesce(pv.cost_per_item,p.cost_per_item) is not null and coalesce(pv.cost_per_item,p.cost_per_item)>0 then greatest(coalesce(il.available,0)+coalesce(il.committed,0),0) else 0 end),0),
    round(coalesce(sum(greatest(coalesce(il.available,0)+coalesce(il.committed,0),0)*coalesce(pv.cost_per_item,p.cost_per_item,0)),0),2),
    count(*) filter (where coalesce(il.available,0)+coalesce(il.committed,0)<0)
    into v_inventory_units,v_costed_units,v_known_inventory,v_negative_inventory
  from public.inventory_levels il
  join public.product_variants pv on pv.id=il.variant_id
  join public.products p on p.id=pv.product_id;

  select
    round(coalesce(sum(l.debit),0),2),
    round(coalesce(sum(l.credit),0),2)
    into v_ledger_debits,v_ledger_credits
  from public.finance_journal_lines l
  join public.finance_journal_entries e on e.id=l.entry_id
  where e.entry_date<=v_as_of and e.status in ('posted','reversed');

  v_ledger_difference := round(v_ledger_debits-v_ledger_credits,2);
  v_source_complete := (v_failure_count=0 and v_pending_cogs=0);
  v_period_covered := (
    v_first_activity is not null
    and v_period_from>=v_first_activity
  );
  v_balance_sheet_authoritative := (
    v_cutover.id is not null
    and v_cutover.status='posted'
    and v_cutover.cutover_date<=v_as_of
    and v_source_complete
    and v_ledger_difference=0
  );

  with bs_movement as (
    select
      l.account_id,
      round(coalesce(sum(l.debit),0),2)::numeric(16,2) debits,
      round(coalesce(sum(l.credit),0),2)::numeric(16,2) credits
    from public.finance_journal_lines l
    join public.finance_journal_entries e on e.id=l.entry_id
    where e.entry_date<=v_as_of and e.status in ('posted','reversed')
    group by l.account_id
  ), bs_accounts as (
    select
      a.id,a.code,a.name,a.account_type,a.normal_balance,a.system_key,a.sort_order,
      coalesce(m.debits,0)::numeric(16,2) debits,
      coalesce(m.credits,0)::numeric(16,2) credits,
      case
        when a.account_type='asset' then round(coalesce(m.debits,0)-coalesce(m.credits,0),2)
        when a.account_type in ('liability','equity') then round(coalesce(m.credits,0)-coalesce(m.debits,0),2)
        else 0
      end::numeric(16,2) balance
    from public.finance_accounts a
    left join bs_movement m on m.account_id=a.id
    where a.active and a.account_type in ('asset','liability','equity')
  ), cumulative_earnings as (
    select round(coalesce(sum(
      case
        when a.account_type='revenue' then l.credit-l.debit
        when a.account_type='expense' then l.credit-l.debit
        else 0
      end
    ),0),2)::numeric(16,2) amount
    from public.finance_journal_lines l
    join public.finance_journal_entries e on e.id=l.entry_id
    join public.finance_accounts a on a.id=l.account_id
    where e.entry_date<=v_as_of
      and e.status in ('posted','reversed')
      and a.account_type in ('revenue','expense')
  ), pl_movement as (
    select
      l.account_id,
      round(coalesce(sum(l.debit),0),2)::numeric(16,2) debits,
      round(coalesce(sum(l.credit),0),2)::numeric(16,2) credits
    from public.finance_journal_lines l
    join public.finance_journal_entries e on e.id=l.entry_id
    where e.entry_date between v_period_from and v_period_to
      and e.status in ('posted','reversed')
    group by l.account_id
  ), pl_accounts as (
    select
      a.id,a.code,a.name,a.account_type,a.normal_balance,a.system_key,a.sort_order,
      coalesce(m.debits,0)::numeric(16,2) debits,
      coalesce(m.credits,0)::numeric(16,2) credits,
      case
        when a.account_type='revenue' then round(coalesce(m.credits,0)-coalesce(m.debits,0),2)
        else round(coalesce(m.debits,0)-coalesce(m.credits,0),2)
      end::numeric(16,2) balance
    from public.finance_accounts a
    left join pl_movement m on m.account_id=a.id
    where a.active and a.account_type in ('revenue','expense')
  ), bs_totals as (
    select
      round(coalesce(sum(balance) filter (where account_type='asset'),0),2)::numeric(16,2) total_assets,
      round(coalesce(sum(balance) filter (where account_type='liability'),0),2)::numeric(16,2) total_liabilities,
      round(coalesce(sum(balance) filter (where account_type='equity'),0),2)::numeric(16,2) equity_accounts
    from bs_accounts
  ), pl_totals as (
    select
      round(coalesce(sum(balance) filter (where account_type='revenue'),0),2)::numeric(16,2) net_revenue,
      round(coalesce(sum(balance) filter (where account_type='expense' and system_key='cost_of_goods_sold'),0),2)::numeric(16,2) cogs,
      round(coalesce(sum(balance) filter (where account_type='expense' and coalesce(system_key,'')<>'cost_of_goods_sold'),0),2)::numeric(16,2) operating_expenses,
      round(coalesce(sum(balance) filter (where account_type='expense'),0),2)::numeric(16,2) total_expenses
    from pl_accounts
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'scope',jsonb_build_object(
      'asOf',v_as_of,
      'periodFrom',v_period_from,
      'periodTo',v_period_to,
      'currency','CAD',
      'accountingBasis','accrual_gl'
    ),
    'readiness',jsonb_build_object(
      'openingCutoverPosted',(v_cutover.id is not null and v_cutover.status='posted'),
      'openingCutoverDate',case when v_cutover.id is null then null else v_cutover.cutover_date end,
      'firstOperationalActivityDate',v_first_activity,
      'lastOperationalActivityDate',v_last_activity,
      'unresolvedSourceFailures',v_failure_count,
      'pendingCogsOrders',v_pending_cogs,
      'sourceComplete',v_source_complete,
      'ledgerBalanced',(v_ledger_difference=0),
      'ledgerDifference',v_ledger_difference,
      'profitAndLossPeriodCovered',v_period_covered,
      'profitAndLossAuthoritative',(v_source_complete and v_period_covered and v_ledger_difference=0),
      'balanceSheetAuthoritative',v_balance_sheet_authoritative,
      'inventoryReference',jsonb_build_object(
        'physicalUnits',v_inventory_units,
        'costedUnits',v_costed_units,
        'knownValue',v_known_inventory,
        'negativeLevelCount',v_negative_inventory,
        'coverageComplete',(v_inventory_units=v_costed_units and v_negative_inventory=0)
      )
    ),
    'ledger',jsonb_build_object(
      'totalDebits',v_ledger_debits,
      'totalCredits',v_ledger_credits,
      'difference',v_ledger_difference
    ),
    'balanceSheet',jsonb_build_object(
      'assets',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'normalBalance',normal_balance,'systemKey',system_key,'debits',debits,'credits',credits,'balance',balance) order by sort_order,code) from bs_accounts where account_type='asset'),'[]'::jsonb),
      'liabilities',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'normalBalance',normal_balance,'systemKey',system_key,'debits',debits,'credits',credits,'balance',balance) order by sort_order,code) from bs_accounts where account_type='liability'),'[]'::jsonb),
      'equity',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'normalBalance',normal_balance,'systemKey',system_key,'debits',debits,'credits',credits,'balance',balance) order by sort_order,code) from bs_accounts where account_type='equity'),'[]'::jsonb),
      'currentEarnings',(select amount from cumulative_earnings),
      'totalAssets',(select total_assets from bs_totals),
      'totalLiabilities',(select total_liabilities from bs_totals),
      'equityAccountTotal',(select equity_accounts from bs_totals),
      'totalEquity',round((select equity_accounts from bs_totals)+(select amount from cumulative_earnings),2),
      'liabilitiesAndEquity',round((select total_liabilities from bs_totals)+(select equity_accounts from bs_totals)+(select amount from cumulative_earnings),2),
      'difference',round((select total_assets from bs_totals)-(select total_liabilities from bs_totals)-(select equity_accounts from bs_totals)-(select amount from cumulative_earnings),2),
      'balanced',round((select total_assets from bs_totals)-(select total_liabilities from bs_totals)-(select equity_accounts from bs_totals)-(select amount from cumulative_earnings),2)=0
    ),
    'profitAndLoss',jsonb_build_object(
      'revenue',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'normalBalance',normal_balance,'systemKey',system_key,'debits',debits,'credits',credits,'balance',balance) order by sort_order,code) from pl_accounts where account_type='revenue'),'[]'::jsonb),
      'costOfGoodsSold',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'normalBalance',normal_balance,'systemKey',system_key,'debits',debits,'credits',credits,'balance',balance) order by sort_order,code) from pl_accounts where account_type='expense' and system_key='cost_of_goods_sold'),'[]'::jsonb),
      'operatingExpenses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'normalBalance',normal_balance,'systemKey',system_key,'debits',debits,'credits',credits,'balance',balance) order by sort_order,code) from pl_accounts where account_type='expense' and coalesce(system_key,'')<>'cost_of_goods_sold'),'[]'::jsonb),
      'netRevenue',(select net_revenue from pl_totals),
      'cogs',(select cogs from pl_totals),
      'grossProfit',round((select net_revenue from pl_totals)-(select cogs from pl_totals),2),
      'operatingExpenseTotal',(select operating_expenses from pl_totals),
      'totalExpenses',(select total_expenses from pl_totals),
      'netIncome',round((select net_revenue from pl_totals)-(select total_expenses from pl_totals),2)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function private.finance_get_financial_statements_impl(date,date,date) from public,anon;
grant execute on function private.finance_get_financial_statements_impl(date,date,date) to authenticated,service_role;

create or replace function public.get_admin_financial_statements(
  p_as_of date default null,
  p_period_from date default null,
  p_period_to date default null
) returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog
as $$
  select private.finance_get_financial_statements_impl(p_as_of,p_period_from,p_period_to);
$$;

revoke all on function public.get_admin_financial_statements(date,date,date) from public,anon;
grant execute on function public.get_admin_financial_statements(date,date,date) to authenticated,service_role;

commit;
