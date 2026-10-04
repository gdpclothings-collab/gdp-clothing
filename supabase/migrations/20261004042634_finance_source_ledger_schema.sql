begin;

alter table public.finance_journal_entries
  drop constraint if exists finance_journal_entries_source_type_check;
alter table public.finance_journal_entries
  add constraint finance_journal_entries_source_type_check
  check (source_type in ('manual','reversal','source','source_reversal'));

create table if not exists public.finance_ledger_source_postings (
  id uuid primary key default gen_random_uuid(),
  source_domain text not null,
  source_record_id text not null,
  source_event_key text not null,
  posting_kind text not null check (posting_kind in ('post','reversal')),
  journal_entry_id uuid not null unique references public.finance_journal_entries(id) on delete restrict,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint finance_ledger_source_postings_domain_len check (char_length(source_domain) between 1 and 80),
  constraint finance_ledger_source_postings_record_len check (char_length(source_record_id) between 1 and 200),
  constraint finance_ledger_source_postings_event_len check (char_length(source_event_key) between 1 and 240),
  unique(source_domain,source_record_id,source_event_key)
);

create table if not exists public.finance_ledger_posting_failures (
  id bigint generated always as identity primary key,
  source_domain text not null,
  source_record_id text not null,
  failure_key text not null,
  error_message text not null,
  attempt_count integer not null default 1 check (attempt_count > 0),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint finance_ledger_posting_failures_domain_len check (char_length(source_domain) between 1 and 80),
  constraint finance_ledger_posting_failures_record_len check (char_length(source_record_id) between 1 and 200),
  constraint finance_ledger_posting_failures_key_len check (char_length(failure_key) between 1 and 120),
  constraint finance_ledger_posting_failures_error_len check (char_length(error_message) between 1 and 2000),
  unique(source_domain,source_record_id,failure_key)
);

create index if not exists finance_ledger_source_postings_source_idx
  on public.finance_ledger_source_postings(source_domain,source_record_id,created_at desc);
create index if not exists finance_ledger_source_postings_kind_idx
  on public.finance_ledger_source_postings(posting_kind,created_at desc);
create index if not exists finance_ledger_posting_failures_open_idx
  on public.finance_ledger_posting_failures(last_failed_at desc)
  where resolved_at is null;

alter table public.finance_ledger_source_postings enable row level security;
alter table public.finance_ledger_posting_failures enable row level security;

revoke all on table public.finance_ledger_source_postings from public,anon;
revoke all on table public.finance_ledger_posting_failures from public,anon;
revoke insert,update,delete on table public.finance_ledger_source_postings from authenticated;
revoke insert,update,delete on table public.finance_ledger_posting_failures from authenticated;
grant select on table public.finance_ledger_source_postings to authenticated;
grant select on table public.finance_ledger_posting_failures to authenticated;
grant all on table public.finance_ledger_source_postings to service_role;
grant all on table public.finance_ledger_posting_failures to service_role;

drop policy if exists finance_ledger_source_postings_admin_select on public.finance_ledger_source_postings;
create policy finance_ledger_source_postings_admin_select
  on public.finance_ledger_source_postings for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_ledger_posting_failures_admin_select on public.finance_ledger_posting_failures;
create policy finance_ledger_posting_failures_admin_select
  on public.finance_ledger_posting_failures for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

create or replace function private.finance_source_account_id(p_system_key text)
returns uuid
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_id uuid;
begin
  select a.id into v_id
  from public.finance_accounts a
  where a.system_key=p_system_key and a.active;
  if v_id is null then
    raise exception 'required ledger account is unavailable: %',p_system_key using errcode='22023';
  end if;
  return v_id;
end;
$$;

create or replace function private.finance_record_ledger_failure(
  p_source_domain text,
  p_source_record_id text,
  p_failure_key text,
  p_error_message text
) returns void
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  insert into public.finance_ledger_posting_failures(
    source_domain,source_record_id,failure_key,error_message,attempt_count,first_failed_at,last_failed_at,resolved_at
  ) values(
    left(coalesce(nullif(trim(p_source_domain),''),'unknown'),80),
    left(coalesce(nullif(trim(p_source_record_id),''),'unknown'),200),
    left(coalesce(nullif(trim(p_failure_key),''),'sync'),120),
    left(coalesce(nullif(trim(p_error_message),''),'unknown ledger posting error'),2000),
    1,now(),now(),null
  )
  on conflict(source_domain,source_record_id,failure_key) do update set
    error_message=excluded.error_message,
    attempt_count=public.finance_ledger_posting_failures.attempt_count+1,
    last_failed_at=now(),
    resolved_at=null;
exception when others then
  null;
end;
$$;

create or replace function private.finance_resolve_ledger_failures(
  p_source_domain text,
  p_source_record_id text
) returns void
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  update public.finance_ledger_posting_failures
  set resolved_at=now()
  where source_domain=p_source_domain
    and source_record_id=p_source_record_id
    and resolved_at is null;
end;
$$;

create or replace function private.finance_source_post_journal(
  p_source_domain text,
  p_source_record_id text,
  p_source_event_key text,
  p_entry_date date,
  p_reference text,
  p_memo text,
  p_lines jsonb,
  p_snapshot jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_existing uuid;
  v_entry public.finance_journal_entries;
  v_line jsonb;
  v_account_id uuid;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
  v_description text;
  v_total_debit numeric(16,2):=0;
  v_total_credit numeric(16,2):=0;
  v_line_order integer:=0;
  v_reference text:=nullif(trim(coalesce(p_reference,'')),'');
  v_memo text:=nullif(trim(coalesce(p_memo,'')),'');
  v_domain text:=nullif(trim(coalesce(p_source_domain,'')),'');
  v_record text:=nullif(trim(coalesce(p_source_record_id,'')),'');
  v_event text:=nullif(trim(coalesce(p_source_event_key,'')),'');
begin
  if v_domain is null or v_record is null or v_event is null then
    raise exception 'source ledger provenance is required' using errcode='22023';
  end if;
  if char_length(v_domain)>80 or char_length(v_record)>200 or char_length(v_event)>240 then
    raise exception 'source ledger provenance is too long' using errcode='22001';
  end if;
  if p_entry_date is null then raise exception 'source journal date is required' using errcode='22023'; end if;
  if v_memo is null then raise exception 'source journal memo is required' using errcode='22023'; end if;
  if char_length(v_memo)>500 then raise exception 'source journal memo is too long' using errcode='22001'; end if;
  if v_reference is not null and char_length(v_reference)>120 then raise exception 'source journal reference is too long' using errcode='22001'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 or jsonb_array_length(p_lines)>50 then
    raise exception 'source journal requires between 2 and 50 lines' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gdp-ledger:'||v_domain||':'||v_record,0));
  select sp.journal_entry_id into v_existing
  from public.finance_ledger_source_postings sp
  where sp.source_domain=v_domain and sp.source_record_id=v_record and sp.source_event_key=v_event;
  if v_existing is not null then return v_existing; end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_account_id:=private.finance_source_account_id(v_line->>'accountKey');
    begin
      v_debit:=round(coalesce(nullif(v_line->>'debit','')::numeric,0),2);
      v_credit:=round(coalesce(nullif(v_line->>'credit','')::numeric,0),2);
    exception when others then
      raise exception 'source journal line contains an invalid amount' using errcode='22023';
    end;
    v_description:=nullif(trim(coalesce(v_line->>'description','')),'');
    if v_debit::text='NaN' or v_credit::text='NaN' or v_debit<0 or v_credit<0 then
      raise exception 'source journal amounts must be valid non-negative numbers' using errcode='22023';
    end if;
    if not ((v_debit>0 and v_credit=0) or (v_credit>0 and v_debit=0)) then
      raise exception 'each source journal line must contain either a debit or a credit' using errcode='22023';
    end if;
    if v_description is not null and char_length(v_description)>240 then
      raise exception 'source journal line description is too long' using errcode='22001';
    end if;
    v_total_debit:=round(v_total_debit+v_debit,2);
    v_total_credit:=round(v_total_credit+v_credit,2);
  end loop;

  if v_total_debit<=0 or v_total_credit<=0 or v_total_debit<>v_total_credit then
    raise exception 'source journal debits and credits must be equal and greater than zero' using errcode='22023';
  end if;

  insert into public.finance_journal_entries(
    entry_date,reference,memo,source_type,status,created_by,created_at,posted_at
  ) values(
    p_entry_date,v_reference,v_memo,'source','posted',auth.uid(),now(),now()
  ) returning * into v_entry;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_order:=v_line_order+1;
    v_account_id:=private.finance_source_account_id(v_line->>'accountKey');
    v_debit:=round(coalesce(nullif(v_line->>'debit','')::numeric,0),2);
    v_credit:=round(coalesce(nullif(v_line->>'credit','')::numeric,0),2);
    v_description:=nullif(trim(coalesce(v_line->>'description','')),'');
    insert into public.finance_journal_lines(entry_id,account_id,description,debit,credit,line_order)
    values(v_entry.id,v_account_id,v_description,v_debit,v_credit,v_line_order);
  end loop;

  insert into public.finance_ledger_source_postings(
    source_domain,source_record_id,source_event_key,posting_kind,journal_entry_id,source_snapshot,created_at
  ) values(
    v_domain,v_record,v_event,'post',v_entry.id,coalesce(p_snapshot,'{}'::jsonb),now()
  );

  perform private.finance_resolve_ledger_failures(v_domain,v_record);
  return v_entry.id;
end;
$$;

create or replace function private.finance_source_reverse_journal(
  p_original_entry_id uuid,
  p_source_domain text,
  p_source_record_id text,
  p_source_event_key text,
  p_reversal_date date,
  p_reason text,
  p_snapshot jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_existing uuid;
  v_original public.finance_journal_entries;
  v_reversal public.finance_journal_entries;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_domain text:=nullif(trim(coalesce(p_source_domain,'')),'');
  v_record text:=nullif(trim(coalesce(p_source_record_id,'')),'');
  v_event text:=nullif(trim(coalesce(p_source_event_key,'')),'');
begin
  if p_original_entry_id is null or p_reversal_date is null or v_reason is null then
    raise exception 'source reversal journal, date and reason are required' using errcode='22023';
  end if;
  if v_domain is null or v_record is null or v_event is null then
    raise exception 'source reversal provenance is required' using errcode='22023';
  end if;
  if char_length(v_reason)>500 then raise exception 'source reversal reason is too long' using errcode='22001'; end if;

  perform pg_advisory_xact_lock(hashtextextended('gdp-ledger:'||v_domain||':'||v_record,0));
  select sp.journal_entry_id into v_existing
  from public.finance_ledger_source_postings sp
  where sp.source_domain=v_domain and sp.source_record_id=v_record and sp.source_event_key=v_event;
  if v_existing is not null then return v_existing; end if;

  select * into v_original from public.finance_journal_entries where id=p_original_entry_id for update;
  if v_original.id is null then raise exception 'source journal entry not found' using errcode='P0002'; end if;
  if v_original.source_type<>'source' then raise exception 'only source journals can be source-reversed' using errcode='22023'; end if;
  if v_original.status<>'posted' or v_original.reversed_by_entry_id is not null then
    return coalesce(v_original.reversed_by_entry_id,p_original_entry_id);
  end if;

  insert into public.finance_journal_entries(
    entry_date,reference,memo,source_type,status,reversal_of_entry_id,reversal_reason,created_by,created_at,posted_at
  ) values(
    p_reversal_date,left(concat('SRC-REV-',v_original.entry_number),120),
    left(concat('Source reversal of journal #',v_original.entry_number,': ',v_reason),500),
    'source_reversal','posted',v_original.id,v_reason,auth.uid(),now(),now()
  ) returning * into v_reversal;

  insert into public.finance_journal_lines(entry_id,account_id,description,debit,credit,line_order)
  select v_reversal.id,l.account_id,
    left(coalesce(l.description,concat('Source reversal of journal #',v_original.entry_number)),240),
    l.credit,l.debit,l.line_order
  from public.finance_journal_lines l
  where l.entry_id=v_original.id
  order by l.line_order;

  update public.finance_journal_entries
  set status='reversed',reversed_by_entry_id=v_reversal.id,reversal_reason=v_reason,reversed_at=now(),reversed_by=auth.uid()
  where id=v_original.id;

  insert into public.finance_ledger_source_postings(
    source_domain,source_record_id,source_event_key,posting_kind,journal_entry_id,source_snapshot,created_at
  ) values(
    v_domain,v_record,v_event,'reversal',v_reversal.id,coalesce(p_snapshot,'{}'::jsonb),now()
  );

  perform private.finance_resolve_ledger_failures(v_domain,v_record);
  return v_reversal.id;
end;
$$;

create or replace function private.finance_source_replace_state(
  p_source_domain text,
  p_source_record_id text,
  p_snapshot jsonb,
  p_entry_date date,
  p_reference text,
  p_memo text,
  p_lines jsonb,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_latest_posting_id uuid;
  v_latest_entry_id uuid;
  v_latest_snapshot jsonb;
  v_latest_status text;
  v_reversal_id uuid;
  v_post_id uuid;
  v_event text;
  v_has_lines boolean:=coalesce(jsonb_typeof(p_lines)='array' and jsonb_array_length(p_lines)>0,false);
begin
  perform pg_advisory_xact_lock(hashtextextended('gdp-ledger:'||p_source_domain||':'||p_source_record_id,0));

  select sp.id,sp.journal_entry_id,sp.source_snapshot,e.status
  into v_latest_posting_id,v_latest_entry_id,v_latest_snapshot,v_latest_status
  from public.finance_ledger_source_postings sp
  join public.finance_journal_entries e on e.id=sp.journal_entry_id
  where sp.source_domain=p_source_domain
    and sp.source_record_id=p_source_record_id
    and sp.posting_kind='post'
  order by sp.created_at desc,sp.id desc
  limit 1;

  if v_latest_entry_id is not null
     and v_latest_status='posted'
     and v_latest_snapshot=coalesce(p_snapshot,'{}'::jsonb)
     and v_has_lines then
    perform private.finance_resolve_ledger_failures(p_source_domain,p_source_record_id);
    return jsonb_build_object('changed',false,'journalEntryId',v_latest_entry_id);
  end if;

  if v_latest_entry_id is not null and v_latest_status='posted' then
    v_event:='replace-reversal:'||gen_random_uuid()::text;
    v_reversal_id:=private.finance_source_reverse_journal(
      v_latest_entry_id,p_source_domain,p_source_record_id,v_event,p_entry_date,
      left(coalesce(nullif(trim(p_reason),''),'Source state changed'),500),
      coalesce(p_snapshot,'{}'::jsonb)
    );
  end if;

  if v_has_lines then
    v_event:='state:'||gen_random_uuid()::text;
    v_post_id:=private.finance_source_post_journal(
      p_source_domain,p_source_record_id,v_event,p_entry_date,p_reference,p_memo,p_lines,
      coalesce(p_snapshot,'{}'::jsonb)
    );
  end if;

  perform private.finance_resolve_ledger_failures(p_source_domain,p_source_record_id);
  return jsonb_build_object(
    'changed',coalesce(v_reversal_id is not null,false) or coalesce(v_post_id is not null,false),
    'reversalEntryId',v_reversal_id,
    'journalEntryId',v_post_id
  );
end;
$$;

revoke all on function private.finance_source_account_id(text) from public,anon,authenticated;
revoke all on function private.finance_record_ledger_failure(text,text,text,text) from public,anon,authenticated;
revoke all on function private.finance_resolve_ledger_failures(text,text) from public,anon,authenticated;
revoke all on function private.finance_source_post_journal(text,text,text,date,text,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function private.finance_source_reverse_journal(uuid,text,text,text,date,text,jsonb) from public,anon,authenticated;
revoke all on function private.finance_source_replace_state(text,text,jsonb,date,text,text,jsonb,text) from public,anon,authenticated;

grant execute on function private.finance_source_account_id(text) to service_role;
grant execute on function private.finance_record_ledger_failure(text,text,text,text) to service_role;
grant execute on function private.finance_resolve_ledger_failures(text,text) to service_role;
grant execute on function private.finance_source_post_journal(text,text,text,date,text,text,jsonb,jsonb) to service_role;
grant execute on function private.finance_source_reverse_journal(uuid,text,text,text,date,text,jsonb) to service_role;
grant execute on function private.finance_source_replace_state(text,text,jsonb,date,text,text,jsonb,text) to service_role;

commit;
