begin;

create or replace function private.finance_get_cash_flow_statement_impl(
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
  v_period_to date := coalesce(p_period_to, (now() at time zone 'America/Regina')::date);
  v_period_from date := coalesce(p_period_from, date_trunc('month', coalesce(p_period_to, (now() at time zone 'America/Regina')::date)::timestamp)::date);
  v_cutover public.finance_opening_balance_cutovers;
  v_first_activity date;
  v_last_activity date;
  v_failure_count integer := 0;
  v_ledger_debits numeric(18,2) := 0;
  v_ledger_credits numeric(18,2) := 0;
  v_ledger_difference numeric(18,2) := 0;
  v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  if v_period_from > v_period_to then
    raise exception 'cash flow period start must be on or before period end' using errcode='22023';
  end if;
  if v_period_to > v_today then
    raise exception 'cash flow period cannot end in the future' using errcode='22023';
  end if;

  select min(entry_date),max(entry_date)
    into v_first_activity,v_last_activity
  from public.finance_journal_entries
  where source_type not in ('opening_balance','opening_reversal');

  select * into v_cutover
  from public.finance_opening_balance_cutovers
  where status='posted'
  order by posted_at desc nulls last,updated_at desc
  limit 1;

  select count(*)::integer into v_failure_count
  from public.finance_ledger_posting_failures
  where resolved_at is null;

  select
    round(coalesce(sum(l.debit),0),2),
    round(coalesce(sum(l.credit),0),2)
    into v_ledger_debits,v_ledger_credits
  from public.finance_journal_lines l
  join public.finance_journal_entries e on e.id=l.entry_id
  where e.entry_date<=v_period_to
    and e.status in ('posted','reversed');
  v_ledger_difference:=round(v_ledger_debits-v_ledger_credits,2);

  with cash_account_balances as (
    select
      a.id,a.code,a.name,a.system_key,a.sort_order,
      round(coalesce(sum(case when e.entry_date<v_period_from then l.debit-l.credit else 0 end),0),2)::numeric(18,2) beginning_balance,
      round(coalesce(sum(case when e.entry_date<=v_period_to then l.debit-l.credit else 0 end),0),2)::numeric(18,2) ending_balance
    from public.finance_accounts a
    left join public.finance_journal_lines l on l.account_id=a.id
    left join public.finance_journal_entries e on e.id=l.entry_id and e.status in ('posted','reversed')
    where a.active and a.system_key in ('cash_on_hand','operating_bank')
    group by a.id,a.code,a.name,a.system_key,a.sort_order
  ), cash_moving_journals as (
    select
      e.id,e.entry_number,e.entry_date,e.reference,e.memo,e.source_type,e.status,
      round(sum(case when a.system_key in ('cash_on_hand','operating_bank') then l.debit-l.credit else 0 end),2)::numeric(18,2) cash_change
    from public.finance_journal_entries e
    join public.finance_journal_lines l on l.entry_id=e.id
    join public.finance_accounts a on a.id=l.account_id
    where e.entry_date between v_period_from and v_period_to
      and e.status in ('posted','reversed')
      and e.source_type not in ('opening_balance','opening_reversal')
    group by e.id,e.entry_number,e.entry_date,e.reference,e.memo,e.source_type,e.status
    having abs(round(sum(case when a.system_key in ('cash_on_hand','operating_bank') then l.debit-l.credit else 0 end),2))>=0.01
  ), flow_rows as (
    select
      j.id,j.entry_number,j.entry_date,j.reference,j.memo,j.source_type,j.cash_change,
      sp.source_domain,sp.posting_kind,sp.source_snapshot,
      case
        when sp.source_domain='expense' and lower(coalesce(sp.source_snapshot->>'category',''))='equipment' then 'investing'
        when sp.source_domain is not null then 'operating'
        when mc.class_count=1 then mc.single_class
        else 'unclassified'
      end as category,
      case
        when sp.source_domain='manual_sale' then case when sp.posting_kind='reversal' then 'Reversal · customer receipts' else 'Customer receipts' end
        when sp.source_domain='stripe_payout' then case when sp.posting_kind='reversal' then 'Reversal · Stripe payout deposits' else 'Stripe payout deposits' end
        when sp.source_domain='expense' and lower(coalesce(sp.source_snapshot->>'category',''))='equipment' then case when sp.posting_kind='reversal' then 'Reversal · equipment purchases' else 'Equipment purchases' end
        when sp.source_domain='expense' then case when sp.posting_kind='reversal' then 'Reversal · operating/vendor payments' else 'Operating/vendor payments' end
        when sp.source_domain is not null then case when sp.posting_kind='reversal' then concat('Reversal · ',replace(sp.source_domain,'_',' ')) else initcap(replace(sp.source_domain,'_',' ')) end
        when mc.class_count=1 and mc.single_class='financing' then 'Financing cash movement'
        when mc.class_count=1 and mc.single_class='investing' then 'Investing cash movement'
        when mc.class_count=1 and mc.single_class='operating' then 'Operating cash movement'
        else 'Unclassified cash movement'
      end as activity_label
    from cash_moving_journals j
    left join public.finance_ledger_source_postings sp on sp.journal_entry_id=j.id
    left join lateral (
      select count(distinct x.classification)::integer as class_count,min(x.classification) as single_class
      from (
        select case
          when a.system_key in ('equipment','accumulated_depreciation') then 'investing'
          when a.system_key in ('owner_contributions','owner_draws','retained_earnings') then 'financing'
          else 'operating'
        end as classification
        from public.finance_journal_lines l
        join public.finance_accounts a on a.id=l.account_id
        where l.entry_id=j.id
          and a.system_key not in ('cash_on_hand','operating_bank')
          and abs(l.debit-l.credit)>=0.01
      ) x
    ) mc on true
  ), metrics as (
    select
      round(coalesce((select sum(beginning_balance) from cash_account_balances),0),2)::numeric(18,2) beginning_cash,
      round(coalesce((select sum(ending_balance) from cash_account_balances),0),2)::numeric(18,2) ending_cash,
      round(coalesce(sum(cash_change) filter (where category='operating'),0),2)::numeric(18,2) operating_cash_flow,
      round(coalesce(sum(cash_change) filter (where category='investing'),0),2)::numeric(18,2) investing_cash_flow,
      round(coalesce(sum(cash_change) filter (where category='financing'),0),2)::numeric(18,2) financing_cash_flow,
      round(coalesce(sum(cash_change) filter (where category='unclassified'),0),2)::numeric(18,2) unclassified_cash_flow,
      count(*) filter (where category='unclassified')::integer unclassified_count
    from flow_rows
  ), structural as (
    select round(coalesce(sum(case when a.system_key in ('cash_on_hand','operating_bank') then l.debit-l.credit else 0 end),0),2)::numeric(18,2) amount
    from public.finance_journal_entries e
    join public.finance_journal_lines l on l.entry_id=e.id
    join public.finance_accounts a on a.id=l.account_id
    where e.entry_date between v_period_from and v_period_to
      and e.status in ('posted','reversed')
      and e.source_type in ('opening_balance','opening_reversal')
  ), final_metrics as (
    select
      m.*,
      s.amount structural_adjustment,
      round(m.operating_cash_flow+m.investing_cash_flow+m.financing_cash_flow+m.unclassified_cash_flow,2)::numeric(18,2) net_cash_flow,
      round(m.ending_cash-m.beginning_cash-s.amount-m.operating_cash_flow-m.investing_cash_flow-m.financing_cash_flow-m.unclassified_cash_flow,2)::numeric(18,2) reconciliation_difference
    from metrics m cross join structural s
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'scope',jsonb_build_object(
      'periodFrom',v_period_from,
      'periodTo',v_period_to,
      'currency','CAD',
      'method','direct_gl_cash_accounts',
      'cashAccounts',jsonb_build_array('cash_on_hand','operating_bank'),
      'stripeClearingIncluded',false
    ),
    'readiness',jsonb_build_object(
      'openingCutoverPosted',(v_cutover.id is not null and v_cutover.status='posted'),
      'openingCutoverDate',case when v_cutover.id is null then null else v_cutover.cutover_date end,
      'periodStartsAfterCutover',(v_cutover.id is not null and v_cutover.cutover_date<v_period_from),
      'firstOperationalActivityDate',v_first_activity,
      'lastOperationalActivityDate',v_last_activity,
      'unresolvedSourceFailures',v_failure_count,
      'sourceComplete',(v_failure_count=0),
      'ledgerBalanced',(v_ledger_difference=0),
      'ledgerDifference',v_ledger_difference,
      'unclassifiedMovementCount',(select unclassified_count from final_metrics),
      'unclassifiedMovementAmount',(select unclassified_cash_flow from final_metrics),
      'structuralCashAdjustment',(select structural_adjustment from final_metrics),
      'reconciliationDifference',(select reconciliation_difference from final_metrics),
      'reconciled',(select abs(reconciliation_difference)<0.01 from final_metrics),
      'authoritative',(
        v_cutover.id is not null
        and v_cutover.status='posted'
        and v_cutover.cutover_date<v_period_from
        and v_failure_count=0
        and v_ledger_difference=0
        and (select unclassified_count=0 from final_metrics)
        and (select abs(structural_adjustment)<0.01 from final_metrics)
        and (select abs(reconciliation_difference)<0.01 from final_metrics)
      )
    ),
    'ledger',jsonb_build_object(
      'totalDebitsThroughPeriod',v_ledger_debits,
      'totalCreditsThroughPeriod',v_ledger_credits,
      'difference',v_ledger_difference
    ),
    'cashFlow',jsonb_build_object(
      'beginningCash',(select beginning_cash from final_metrics),
      'operating',(select operating_cash_flow from final_metrics),
      'investing',(select investing_cash_flow from final_metrics),
      'financing',(select financing_cash_flow from final_metrics),
      'unclassified',(select unclassified_cash_flow from final_metrics),
      'structuralAdjustment',(select structural_adjustment from final_metrics),
      'netCashFlow',(select net_cash_flow from final_metrics),
      'endingCash',(select ending_cash from final_metrics),
      'reconciliationDifference',(select reconciliation_difference from final_metrics)
    ),
    'cashComposition',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,'code',code,'name',name,'systemKey',system_key,
        'beginningBalance',beginning_balance,'endingBalance',ending_balance,
        'change',round(ending_balance-beginning_balance,2)
      ) order by sort_order,code)
      from cash_account_balances
    ),'[]'::jsonb),
    'activities',jsonb_build_object(
      'operating',coalesce((select jsonb_agg(jsonb_build_object(
        'journalEntryId',id,'entryNumber',entry_number,'date',entry_date,'reference',reference,
        'memo',memo,'sourceType',source_type,'sourceDomain',source_domain,'label',activity_label,'amount',cash_change
      ) order by entry_date,entry_number) from flow_rows where category='operating'),'[]'::jsonb),
      'investing',coalesce((select jsonb_agg(jsonb_build_object(
        'journalEntryId',id,'entryNumber',entry_number,'date',entry_date,'reference',reference,
        'memo',memo,'sourceType',source_type,'sourceDomain',source_domain,'label',activity_label,'amount',cash_change
      ) order by entry_date,entry_number) from flow_rows where category='investing'),'[]'::jsonb),
      'financing',coalesce((select jsonb_agg(jsonb_build_object(
        'journalEntryId',id,'entryNumber',entry_number,'date',entry_date,'reference',reference,
        'memo',memo,'sourceType',source_type,'sourceDomain',source_domain,'label',activity_label,'amount',cash_change
      ) order by entry_date,entry_number) from flow_rows where category='financing'),'[]'::jsonb),
      'unclassified',coalesce((select jsonb_agg(jsonb_build_object(
        'journalEntryId',id,'entryNumber',entry_number,'date',entry_date,'reference',reference,
        'memo',memo,'sourceType',source_type,'sourceDomain',source_domain,'label',activity_label,'amount',cash_change
      ) order by entry_date,entry_number) from flow_rows where category='unclassified'),'[]'::jsonb)
    ),
    'policy',jsonb_build_object(
      'cashDefinition','Cash on Hand + Operating Bank',
      'stripeClearingTreatment','Excluded until settled to Operating Bank',
      'openingBalanceTreatment','Opening-balance and opening-reversal journals are structural adjustments, not cash-flow activities',
      'unknownClassificationTreatment','Cash-moving journals with mixed or ambiguous classifications remain unclassified and block authoritative status'
    )
  ) into v_result
  from final_metrics;

  return v_result;
end;
$$;

revoke all on function private.finance_get_cash_flow_statement_impl(date,date) from public,anon;
grant execute on function private.finance_get_cash_flow_statement_impl(date,date) to authenticated,service_role;

create or replace function public.get_admin_cash_flow_statement(
  p_period_from date default null,
  p_period_to date default null
) returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog
as $$
  select private.finance_get_cash_flow_statement_impl(p_period_from,p_period_to);
$$;

revoke all on function public.get_admin_cash_flow_statement(date,date) from public,anon;
grant execute on function public.get_admin_cash_flow_statement(date,date) to authenticated,service_role;

commit;
