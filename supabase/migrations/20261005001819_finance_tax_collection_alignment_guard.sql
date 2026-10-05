create or replace function public.get_admin_tax_filing_controls(p_limit integer default 24)
returns jsonb
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_limit integer := greatest(1, least(100, coalesce(p_limit,24)));
  v_registrations jsonb;
  v_periods jsonb;
  v_registered_count integer := 0;
  v_ready_count integer := 0;
  v_checkout_gst boolean := false;
  v_checkout_pst boolean := false;
  v_checkout_count integer := 0;
  v_mismatch_count integer := 0;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  select
    exists (
      select 1
      from public.tax_rules tr
      cross join lateral jsonb_array_elements(coalesce(tr.config->'components', '[]'::jsonb)) component
      where tr.active
        and tr.country_code = 'CA'
        and component->>'bucket' = 'gst_hst'
        and coalesce((component->>'rate')::numeric, 0) > 0
    ),
    exists (
      select 1
      from public.tax_rules tr
      cross join lateral jsonb_array_elements(coalesce(tr.config->'components', '[]'::jsonb)) component
      where tr.active
        and tr.country_code = 'CA'
        and component->>'bucket' = 'pst'
        and coalesce((component->>'rate')::numeric, 0) > 0
    )
  into v_checkout_gst, v_checkout_pst;

  v_checkout_count := (case when v_checkout_gst then 1 else 0 end) + (case when v_checkout_pst then 1 else 0 end);

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'taxType', r.tax_type,
      'registered', r.registered,
      'accountNumberMasked', case
        when nullif(trim(r.account_number),'') is null then null
        when char_length(trim(r.account_number)) <= 4 then trim(r.account_number)
        else repeat('*', greatest(char_length(trim(r.account_number)) - 4, 0)) || right(trim(r.account_number),4)
      end,
      'hasAccountNumber', nullif(trim(r.account_number),'') is not null,
      'filingFrequency', r.filing_frequency,
      'effectiveFrom', r.effective_from,
      'notes', r.notes,
      'ready', r.registered and nullif(trim(r.account_number),'') is not null and r.filing_frequency <> 'unconfigured',
      'checkoutCollectionEnabled', case r.tax_type when 'gst_hst' then v_checkout_gst when 'pst' then v_checkout_pst else false end,
      'alignmentStatus', case
        when (case r.tax_type when 'gst_hst' then v_checkout_gst when 'pst' then v_checkout_pst else false end)
             and not r.registered then 'collecting_unregistered'
        when (case r.tax_type when 'gst_hst' then v_checkout_gst when 'pst' then v_checkout_pst else false end)
             and r.registered
             and not (nullif(trim(r.account_number),'') is not null and r.filing_frequency <> 'unconfigured') then 'registration_incomplete'
        when not (case r.tax_type when 'gst_hst' then v_checkout_gst when 'pst' then v_checkout_pst else false end)
             and r.registered then 'registered_not_collecting'
        when (case r.tax_type when 'gst_hst' then v_checkout_gst when 'pst' then v_checkout_pst else false end)
             and r.registered
             and nullif(trim(r.account_number),'') is not null
             and r.filing_frequency <> 'unconfigured' then 'aligned'
        else 'inactive_unregistered'
      end,
      'alignmentIssue', (
        ((case r.tax_type when 'gst_hst' then v_checkout_gst when 'pst' then v_checkout_pst else false end)
          and not (r.registered and nullif(trim(r.account_number),'') is not null and r.filing_frequency <> 'unconfigured'))
        or
        (not (case r.tax_type when 'gst_hst' then v_checkout_gst when 'pst' then v_checkout_pst else false end) and r.registered)
      ),
      'updatedAt', r.updated_at
    ) order by r.tax_type), '[]'::jsonb),
    count(*) filter (where r.registered)::integer,
    count(*) filter (where r.registered and nullif(trim(r.account_number),'') is not null and r.filing_frequency <> 'unconfigured')::integer,
    count(*) filter (where
      (((case r.tax_type when 'gst_hst' then v_checkout_gst when 'pst' then v_checkout_pst else false end)
        and not (r.registered and nullif(trim(r.account_number),'') is not null and r.filing_frequency <> 'unconfigured'))
       or
       (not (case r.tax_type when 'gst_hst' then v_checkout_gst when 'pst' then v_checkout_pst else false end) and r.registered))
    )::integer
  into v_registrations, v_registered_count, v_ready_count, v_mismatch_count
  from public.finance_tax_registration_settings r;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.period_start desc, x.tax_type), '[]'::jsonb)
  into v_periods
  from (
    select p.id, p.tax_type, p.period_start, p.period_end, p.due_date, p.status,
      p.tax_collected, p.tax_refunded, p.tax_credits, p.net_tax_due,
      p.unclassified_tax, p.estimated_refund_allocations, p.estimate_review_confirmed,
      p.closed_at, p.filed_at, p.filing_reference, p.reopened_at, p.reopen_reason,
      p.notes, p.created_at, p.updated_at,
      (p.status in ('closed','filed') and p.unclassified_tax = 0 and (p.estimated_refund_allocations = 0 or p.estimate_review_confirmed)) as filing_ready
    from public.finance_tax_filing_periods p
    order by p.period_start desc, p.tax_type
    limit v_limit
  ) x;

  return jsonb_build_object(
    'generatedAt', now(),
    'registrations', v_registrations,
    'periods', v_periods,
    'summary', jsonb_build_object(
      'registeredTaxTypes', v_registered_count,
      'configuredTaxTypes', v_ready_count,
      'configurationComplete', v_registered_count > 0 and v_registered_count = v_ready_count,
      'checkoutCollectionTaxTypes', v_checkout_count,
      'collectionMismatchCount', v_mismatch_count,
      'collectionAlignmentComplete', v_mismatch_count = 0
    )
  );
end;
$function$;
