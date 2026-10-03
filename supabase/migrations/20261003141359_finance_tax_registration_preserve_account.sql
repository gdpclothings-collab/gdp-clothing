begin;

create or replace function public.upsert_admin_tax_registration(
  p_tax_type text,
  p_registered boolean,
  p_account_number text default null,
  p_filing_frequency text default 'unconfigured',
  p_effective_from date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_tax_type text := lower(trim(coalesce(p_tax_type,'')));
  v_frequency text := lower(trim(coalesce(p_filing_frequency,'unconfigured')));
  v_account text := nullif(upper(trim(coalesce(p_account_number,''))), '');
  v_existing public.finance_tax_registration_settings;
  v_row public.finance_tax_registration_settings;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if v_tax_type not in ('gst_hst','pst') then
    raise exception 'invalid tax type' using errcode = '22023';
  end if;
  if v_frequency not in ('unconfigured','monthly','quarterly','annual','other') then
    raise exception 'invalid filing frequency' using errcode = '22023';
  end if;
  if char_length(coalesce(p_notes,'')) > 1000 then
    raise exception 'notes are too long' using errcode = '22001';
  end if;

  select * into v_existing
  from public.finance_tax_registration_settings
  where tax_type = v_tax_type;

  if coalesce(p_registered,false) and v_account is null then
    v_account := nullif(trim(v_existing.account_number),'');
  end if;

  if coalesce(p_registered,false) and (v_account is null or v_frequency = 'unconfigured') then
    raise exception 'registered tax types require an account number and filing frequency' using errcode = '22023';
  end if;

  insert into public.finance_tax_registration_settings (
    tax_type, registered, account_number, filing_frequency, effective_from, notes,
    created_by, updated_by, created_at, updated_at
  ) values (
    v_tax_type, coalesce(p_registered,false), case when coalesce(p_registered,false) then v_account else null end,
    case when coalesce(p_registered,false) then v_frequency else 'unconfigured' end,
    case when coalesce(p_registered,false) then p_effective_from else null end,
    nullif(trim(coalesce(p_notes,'')), ''), auth.uid(), auth.uid(), now(), now()
  )
  on conflict (tax_type) do update set
    registered = excluded.registered,
    account_number = excluded.account_number,
    filing_frequency = excluded.filing_frequency,
    effective_from = excluded.effective_from,
    notes = excluded.notes,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'taxType', v_row.tax_type,
    'registered', v_row.registered,
    'hasAccountNumber', nullif(trim(v_row.account_number),'') is not null,
    'accountNumberMasked', case
      when nullif(trim(v_row.account_number),'') is null then null
      when char_length(trim(v_row.account_number)) <= 4 then trim(v_row.account_number)
      else repeat('*', greatest(char_length(trim(v_row.account_number)) - 4, 0)) || right(trim(v_row.account_number),4)
    end,
    'filingFrequency', v_row.filing_frequency,
    'effectiveFrom', v_row.effective_from,
    'notes', v_row.notes,
    'ready', v_row.registered and nullif(trim(v_row.account_number),'') is not null and v_row.filing_frequency <> 'unconfigured',
    'updatedAt', v_row.updated_at
  );
end;
$$;

revoke all on function public.upsert_admin_tax_registration(text,boolean,text,text,date,text) from public, anon;
grant execute on function public.upsert_admin_tax_registration(text,boolean,text,text,date,text) to authenticated;

commit;
