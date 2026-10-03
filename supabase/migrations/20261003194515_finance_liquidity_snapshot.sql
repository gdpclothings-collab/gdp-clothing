create or replace function private.finance_get_liquidity_snapshot_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  return (
    with latest_bank as (
      select id, period_start, period_end, statement_closing_balance, closed_at
      from public.finance_bank_statement_reconciliations
      where status='closed'
      order by period_end desc, closed_at desc nulls last
      limit 1
    ), bank_after as (
      select
        coalesce(sum(amount) filter (where direction='credit'),0)::numeric as credits,
        coalesce(sum(amount) filter (where direction='debit'),0)::numeric as debits,
        count(*)::integer as entry_count,
        coalesce(count(*) filter (where match_status='review'),0)::integer as review_count,
        coalesce(count(*) filter (where match_status='unclassified'),0)::integer as unclassified_count,
        max(occurred_on) as latest_entry_date
      from public.finance_bank_entries b
      where b.status='active'
        and exists (select 1 from latest_bank lb where b.occurred_on > lb.period_end)
    ), latest_closed_cash as (
      select id,business_date,actual_cash,expected_cash,variance,closed_at
      from public.finance_cash_reconciliations
      where status='closed'
      order by business_date desc, closed_at desc nulls last
      limit 1
    ), latest_open_cash as (
      select r.*
      from public.finance_cash_reconciliations r
      where r.status='open'
      order by r.business_date desc, r.created_at desc
      limit 1
    ), open_cash_live as (
      select r.id,r.business_date,
        round(r.opening_cash
          + coalesce(s.cash_sales,0)
          + coalesce(a.cash_in,0)
          - coalesce(a.cash_refunds,0)
          - coalesce(a.cash_out,0)
          - coalesce(e.cash_expenses,0),2) as expected_cash
      from latest_open_cash r
      left join lateral (
        select coalesce(sum(ms.total),0) cash_sales
        from public.finance_manual_sales ms
        where ms.status='paid' and ms.payment_method='cash'
          and (ms.occurred_at at time zone 'America/Regina')::date=r.business_date
      ) s on true
      left join lateral (
        select coalesce(sum(fe.amount+fe.tax),0) cash_expenses
        from public.finance_expenses fe
        where fe.occurred_on=r.business_date
          and lower(trim(coalesce(fe.payment_method,'')))='cash'
      ) e on true
      left join lateral (
        select
          coalesce(sum(ca.amount) filter (where ca.adjustment_type='refund'),0) cash_refunds,
          coalesce(sum(ca.amount) filter (where ca.adjustment_type='cash_in'),0) cash_in,
          coalesce(sum(ca.amount) filter (where ca.adjustment_type='cash_out'),0) cash_out
        from public.finance_cash_adjustments ca
        where ca.reconciliation_id=r.id
      ) a on true
    ), recent_bank as (
      select period_start,period_end,opening_balance,credit_snapshot,debit_snapshot,statement_closing_balance,closed_at
      from public.finance_bank_statement_reconciliations
      where status='closed'
      order by period_end desc, closed_at desc nulls last
      limit 12
    ), recent_cash as (
      select business_date,opening_cash,expected_cash,actual_cash,variance,closed_at
      from public.finance_cash_reconciliations
      where status='closed'
      order by business_date desc, closed_at desc nulls last
      limit 31
    ), position as (
      select
        lb.statement_closing_balance as bank_verified_balance,
        lb.period_end as bank_verified_through,
        ba.credits as post_close_credits,
        ba.debits as post_close_debits,
        ba.entry_count as post_close_entry_count,
        ba.review_count as post_close_review_count,
        ba.unclassified_count as post_close_unclassified_count,
        ba.latest_entry_date,
        case when lb.id is null then null else round(lb.statement_closing_balance + ba.credits - ba.debits,2) end as bank_book_estimate,
        case when oc.id is not null then oc.expected_cash else cc.actual_cash end as cash_position,
        case when oc.id is not null then 'open_expected' when cc.id is not null then 'closed_actual' else 'unavailable' end as cash_source,
        case when oc.id is not null then oc.business_date else cc.business_date end as cash_as_of,
        cc.actual_cash as latest_closed_cash,
        cc.business_date as latest_closed_cash_date,
        cc.variance as latest_closed_cash_variance,
        oc.expected_cash as open_cash_expected,
        oc.business_date as open_cash_date
      from (select 1) x
      left join latest_bank lb on true
      left join bank_after ba on true
      left join latest_closed_cash cc on true
      left join open_cash_live oc on true
    )
    select jsonb_build_object(
      'generatedAt', now(),
      'bank', jsonb_build_object(
        'verifiedBalance', bank_verified_balance,
        'verifiedThrough', bank_verified_through,
        'postCloseCredits', coalesce(post_close_credits,0),
        'postCloseDebits', coalesce(post_close_debits,0),
        'postCloseNet', coalesce(post_close_credits,0)-coalesce(post_close_debits,0),
        'postCloseEntryCount', coalesce(post_close_entry_count,0),
        'reviewCount', coalesce(post_close_review_count,0),
        'unclassifiedCount', coalesce(post_close_unclassified_count,0),
        'latestEntryDate', latest_entry_date,
        'bookBalanceEstimate', bank_book_estimate
      ),
      'cash', jsonb_build_object(
        'positionEstimate', cash_position,
        'source', cash_source,
        'asOfDate', cash_as_of,
        'latestClosedActual', latest_closed_cash,
        'latestClosedDate', latest_closed_cash_date,
        'latestClosedVariance', latest_closed_cash_variance,
        'openExpected', open_cash_expected,
        'openDate', open_cash_date
      ),
      'liquidity', jsonb_build_object(
        'complete', bank_book_estimate is not null and cash_position is not null,
        'estimatedTotal', case when bank_book_estimate is not null and cash_position is not null then round(bank_book_estimate+cash_position,2) else null end,
        'partialTotal', round(coalesce(bank_book_estimate,0)+coalesce(cash_position,0),2)
      ),
      'recentBankStatements', coalesce((select jsonb_agg(to_jsonb(r) order by r.period_end desc) from recent_bank r),'[]'::jsonb),
      'recentCashCloses', coalesce((select jsonb_agg(to_jsonb(r) order by r.business_date desc) from recent_cash r),'[]'::jsonb)
    ) from position
  );
end;
$$;

revoke all on function private.finance_get_liquidity_snapshot_impl() from public, anon;
grant execute on function private.finance_get_liquidity_snapshot_impl() to authenticated, service_role;

create or replace function public.get_admin_liquidity_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select private.finance_get_liquidity_snapshot_impl();
$$;

revoke all on function public.get_admin_liquidity_snapshot() from public, anon;
grant execute on function public.get_admin_liquidity_snapshot() to authenticated, service_role;
