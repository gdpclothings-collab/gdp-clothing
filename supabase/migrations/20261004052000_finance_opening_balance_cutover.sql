begin;

alter table public.finance_journal_entries
  drop constraint if exists finance_journal_entries_source_type_check;
alter table public.finance_journal_entries
  add constraint finance_journal_entries_source_type_check
  check (source_type in ('manual','reversal','source','source_reversal','opening_balance','opening_reversal'));

create table if not exists public.finance_opening_balance_cutovers (
  id uuid primary key default gen_random_uuid(),
  cutover_date date not null,
  status text not null default 'draft' check (status in ('draft','posted','reversed')),
  notes text,
  lines jsonb not null default '[]'::jsonb check (jsonb_typeof(lines)='array'),
  total_debits numeric(16,2) not null default 0 check (total_debits>=0),
  total_credits numeric(16,2) not null default 0 check (total_credits>=0),
  journal_entry_id uuid unique references public.finance_journal_entries(id) on delete restrict,
  reversal_entry_id uuid unique references public.finance_journal_entries(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  reversed_at timestamptz,
  reversal_reason text,
  constraint finance_opening_balance_cutovers_notes_len check (notes is null or char_length(notes)<=1500),
  constraint finance_opening_balance_cutovers_reverse_reason_len check (reversal_reason is null or char_length(reversal_reason) between 1 and 500),
  constraint finance_opening_balance_cutovers_state_chk check (
    (status='draft' and journal_entry_id is null and reversal_entry_id is null and posted_at is null and posted_by is null and reversed_at is null and reversed_by is null and reversal_reason is null)
    or
    (status='posted' and journal_entry_id is not null and reversal_entry_id is null and posted_at is not null and posted_by is not null and reversed_at is null and reversed_by is null and reversal_reason is null)
    or
    (status='reversed' and journal_entry_id is not null and reversal_entry_id is not null and posted_at is not null and posted_by is not null and reversed_at is not null and reversed_by is not null and nullif(trim(reversal_reason),'') is not null)
  )
);

create table if not exists public.finance_opening_balance_events (
  id bigint generated always as identity primary key,
  cutover_id uuid not null references public.finance_opening_balance_cutovers(id) on delete restrict,
  event_type text not null check (event_type in ('created','updated','posted','reversed')),
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists finance_opening_balance_one_draft_idx
  on public.finance_opening_balance_cutovers ((status)) where status='draft';
create unique index if not exists finance_opening_balance_one_posted_idx
  on public.finance_opening_balance_cutovers ((status)) where status='posted';
create index if not exists finance_opening_balance_cutovers_created_by_idx on public.finance_opening_balance_cutovers(created_by);
create index if not exists finance_opening_balance_cutovers_updated_by_idx on public.finance_opening_balance_cutovers(updated_by);
create index if not exists finance_opening_balance_cutovers_posted_by_idx on public.finance_opening_balance_cutovers(posted_by) where posted_by is not null;
create index if not exists finance_opening_balance_cutovers_reversed_by_idx on public.finance_opening_balance_cutovers(reversed_by) where reversed_by is not null;
create index if not exists finance_opening_balance_events_cutover_idx on public.finance_opening_balance_events(cutover_id,created_at desc,id desc);
create index if not exists finance_opening_balance_events_created_by_idx on public.finance_opening_balance_events(created_by) where created_by is not null;

alter table public.finance_opening_balance_cutovers enable row level security;
alter table public.finance_opening_balance_events enable row level security;

revoke all on table public.finance_opening_balance_cutovers from public,anon;
revoke all on table public.finance_opening_balance_events from public,anon;
revoke insert,update,delete on table public.finance_opening_balance_cutovers from authenticated;
revoke insert,update,delete on table public.finance_opening_balance_events from authenticated;
grant select on table public.finance_opening_balance_cutovers to authenticated;
grant select on table public.finance_opening_balance_events to authenticated;
grant all on table public.finance_opening_balance_cutovers to service_role;
grant all on table public.finance_opening_balance_events to service_role;

drop policy if exists finance_opening_balance_cutovers_admin_select on public.finance_opening_balance_cutovers;
create policy finance_opening_balance_cutovers_admin_select on public.finance_opening_balance_cutovers
  for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_opening_balance_events_admin_select on public.finance_opening_balance_events;
create policy finance_opening_balance_events_admin_select on public.finance_opening_balance_events
  for select to authenticated using ((select public.is_admin_step_up_authorized()));

create or replace function private.finance_validate_opening_balance_lines(
  p_lines jsonb,
  p_require_balanced boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_line jsonb;
  v_account public.finance_accounts;
  v_account_id uuid;
  v_side text;
  v_amount numeric(16,2);
  v_note text;
  v_count integer:=0;
  v_total_debits numeric(16,2):=0;
  v_total_credits numeric(16,2):=0;
  v_seen uuid[]:='{}'::uuid[];
  v_normalized jsonb:='[]'::jsonb;
begin
  if p_lines is null or jsonb_typeof(p_lines)<>'array' then
    raise exception 'opening balance lines must be an array' using errcode='22023';
  end if;
  if jsonb_array_length(p_lines)>50 then
    raise exception 'opening balance supports at most 50 account lines' using errcode='22023';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    begin
      v_account_id:=(v_line->>'accountId')::uuid;
      v_side:=lower(trim(coalesce(v_line->>'side','')));
      v_amount:=round(coalesce(nullif(v_line->>'amount','')::numeric,0),2);
    exception when others then
      raise exception 'opening balance line contains an invalid account or amount' using errcode='22023';
    end;
    v_note:=nullif(trim(coalesce(v_line->>'note','')),'');
    if v_side not in ('debit','credit') then
      raise exception 'opening balance line side must be debit or credit' using errcode='22023';
    end if;
    if v_amount::text='NaN' or v_amount<=0 then
      raise exception 'opening balance line amount must be greater than zero' using errcode='22023';
    end if;
    if v_note is not null and char_length(v_note)>240 then
      raise exception 'opening balance line note is too long' using errcode='22001';
    end if;
    if v_account_id=any(v_seen) then
      raise exception 'each opening balance account can appear only once' using errcode='22023';
    end if;

    select * into v_account
    from public.finance_accounts
    where id=v_account_id and active and account_type in ('asset','liability','equity');
    if v_account.id is null then
      raise exception 'opening balances may use active balance-sheet accounts only' using errcode='22023';
    end if;

    v_seen:=array_append(v_seen,v_account_id);
    v_count:=v_count+1;
    if v_side='debit' then
      v_total_debits:=round(v_total_debits+v_amount,2);
    else
      v_total_credits:=round(v_total_credits+v_amount,2);
    end if;
    v_normalized:=v_normalized || jsonb_build_array(jsonb_build_object(
      'accountId',v_account_id,
      'side',v_side,
      'amount',v_amount,
      'note',v_note
    ));
  end loop;

  if p_require_balanced then
    if v_count<2 then
      raise exception 'opening balance requires at least two non-zero account lines' using errcode='22023';
    end if;
    if v_total_debits<=0 or v_total_credits<=0 or v_total_debits<>v_total_credits then
      raise exception 'opening balance debits and credits must be equal and greater than zero' using errcode='22023';
    end if;
  end if;

  return jsonb_build_object(
    'lines',v_normalized,
    'lineCount',v_count,
    'totalDebits',v_total_debits,
    'totalCredits',v_total_credits,
    'difference',round(v_total_debits-v_total_credits,2),
    'balanced',(v_total_debits=v_total_credits and v_total_debits>0)
  );
end;
$$;

create or replace function private.finance_get_opening_balance_cutover_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_current public.finance_opening_balance_cutovers;
  v_earliest date;
  v_inventory_units bigint:=0;
  v_costed_units bigint:=0;
  v_known_inventory numeric(16,2):=0;
  v_negative_inventory integer:=0;
  v_open_ar numeric(16,2):=0;
  v_open_ap numeric(16,2):=0;
  v_unresolved_failures integer:=0;
  v_pre_cutover_new_entries integer:=0;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;

  select min(entry_date) into v_earliest
  from public.finance_journal_entries
  where source_type not in ('opening_balance','opening_reversal');

  select * into v_current
  from public.finance_opening_balance_cutovers
  where status in ('draft','posted')
  order by case when status='posted' then 0 else 1 end,updated_at desc
  limit 1;

  select
    coalesce(sum(greatest(coalesce(il.available,0)+coalesce(il.committed,0),0)),0),
    coalesce(sum(case when coalesce(pv.cost_per_item,p.cost_per_item) is not null and coalesce(pv.cost_per_item,p.cost_per_item)>0 then greatest(coalesce(il.available,0)+coalesce(il.committed,0),0) else 0 end),0),
    round(coalesce(sum(greatest(coalesce(il.available,0)+coalesce(il.committed,0),0)*coalesce(pv.cost_per_item,p.cost_per_item,0)),0),2),
    count(*) filter (where coalesce(il.available,0)+coalesce(il.committed,0)<0)
  into v_inventory_units,v_costed_units,v_known_inventory,v_negative_inventory
  from public.inventory_levels il
  join public.product_variants pv on pv.id=il.variant_id
  join public.products p on p.id=pv.product_id;

  select round(coalesce(sum(greatest(i.total-coalesce((
    select sum(p.amount) from public.finance_customer_invoice_payments p
    where p.invoice_id=i.id and p.status='active'
  ),0),0)),0),2)
  into v_open_ar
  from public.finance_customer_invoices i
  where i.status in ('open','partially_paid');

  select round(coalesce(sum(greatest((b.amount+b.gst_hst_tax+b.pst_tax)-coalesce((
    select sum(a.amount+a.gst_hst_tax+a.pst_tax) from public.finance_vendor_credit_applications a
    where a.bill_id=b.id and a.status='active'
  ),0),0)),0),2)
  into v_open_ap
  from public.finance_vendor_bills b
  where b.status='open';

  select count(*) into v_unresolved_failures
  from public.finance_ledger_posting_failures
  where resolved_at is null;

  if v_current.id is not null and v_current.status='posted' then
    select count(*) into v_pre_cutover_new_entries
    from public.finance_journal_entries e
    where e.source_type not in ('opening_balance','opening_reversal')
      and e.entry_date<=v_current.cutover_date
      and e.created_at>v_current.posted_at;
  end if;

  return jsonb_build_object(
    'generatedAt',now(),
    'accounts',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'code',a.code,'name',a.name,'accountType',a.account_type,
        'normalBalance',a.normal_balance,'systemKey',a.system_key,'sortOrder',a.sort_order
      ) order by a.sort_order,a.code)
      from public.finance_accounts a
      where a.active and a.account_type in ('asset','liability','equity')
    ),'[]'::jsonb),
    'current',case when v_current.id is null then null else to_jsonb(v_current) end,
    'history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'cutoverDate',c.cutover_date,'status',c.status,'notes',c.notes,
        'lines',c.lines,'totalDebits',c.total_debits,'totalCredits',c.total_credits,
        'journalEntryId',c.journal_entry_id,'reversalEntryId',c.reversal_entry_id,
        'createdAt',c.created_at,'updatedAt',c.updated_at,'postedAt',c.posted_at,
        'reversedAt',c.reversed_at,'reversalReason',c.reversal_reason
      ) order by c.created_at desc)
      from public.finance_opening_balance_cutovers c
    ),'[]'::jsonb),
    'ledger',jsonb_build_object(
      'earliestActivityDate',v_earliest,
      'latestAllowedCutoverDate',case when v_earliest is null then (now() at time zone 'America/Regina')::date else v_earliest-1 end,
      'unresolvedSourceFailures',v_unresolved_failures,
      'preCutoverNewEntryCount',v_pre_cutover_new_entries,
      'cutoverHealthy',(v_unresolved_failures=0 and v_pre_cutover_new_entries=0)
    ),
    'references',jsonb_build_object(
      'inventory',jsonb_build_object(
        'physicalUnits',v_inventory_units,
        'costedUnits',v_costed_units,
        'knownValue',v_known_inventory,
        'negativeLevelCount',v_negative_inventory,
        'coverageComplete',(v_inventory_units=v_costed_units and v_negative_inventory=0)
      ),
      'openAccountsReceivable',v_open_ar,
      'openAccountsPayable',v_open_ap
    )
  );
end;
$$;

create or replace function private.finance_save_opening_balance_cutover_impl(
  p_cutover_date date,
  p_notes text,
  p_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_cutover public.finance_opening_balance_cutovers;
  v_validation jsonb;
  v_today date:=(now() at time zone 'America/Regina')::date;
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  if p_cutover_date is null then raise exception 'cutover date is required' using errcode='22023'; end if;
  if p_cutover_date>v_today then raise exception 'cutover date cannot be in the future' using errcode='22023'; end if;
  if v_notes is not null and char_length(v_notes)>1500 then raise exception 'cutover notes are too long' using errcode='22001'; end if;
  if exists(select 1 from public.finance_opening_balance_cutovers where status='posted') then
    raise exception 'an opening balance cutover is already posted; reverse it before creating another' using errcode='22023';
  end if;

  v_validation:=private.finance_validate_opening_balance_lines(coalesce(p_lines,'[]'::jsonb),false);

  select * into v_cutover from public.finance_opening_balance_cutovers where status='draft' for update;
  if v_cutover.id is null then
    insert into public.finance_opening_balance_cutovers(
      cutover_date,status,notes,lines,total_debits,total_credits,created_by,created_at,updated_by,updated_at
    ) values(
      p_cutover_date,'draft',v_notes,v_validation->'lines',
      (v_validation->>'totalDebits')::numeric,(v_validation->>'totalCredits')::numeric,
      auth.uid(),now(),auth.uid(),now()
    ) returning * into v_cutover;
    insert into public.finance_opening_balance_events(cutover_id,event_type,details,created_by)
    values(v_cutover.id,'created',jsonb_build_object('cutoverDate',p_cutover_date,'lineCount',(v_validation->>'lineCount')::integer),auth.uid());
  else
    update public.finance_opening_balance_cutovers
    set cutover_date=p_cutover_date,notes=v_notes,lines=v_validation->'lines',
        total_debits=(v_validation->>'totalDebits')::numeric,
        total_credits=(v_validation->>'totalCredits')::numeric,
        updated_by=auth.uid(),updated_at=now()
    where id=v_cutover.id returning * into v_cutover;
    insert into public.finance_opening_balance_events(cutover_id,event_type,details,created_by)
    values(v_cutover.id,'updated',jsonb_build_object('cutoverDate',p_cutover_date,'lineCount',(v_validation->>'lineCount')::integer),auth.uid());
  end if;

  return jsonb_build_object('cutover',to_jsonb(v_cutover),'validation',v_validation);
end;
$$;

create or replace function private.finance_post_opening_balance_cutover_impl(p_cutover_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_cutover public.finance_opening_balance_cutovers;
  v_journal public.finance_journal_entries;
  v_validation jsonb;
  v_line jsonb;
  v_line_order integer:=0;
  v_earliest date;
  v_failures integer:=0;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  if p_cutover_id is null then raise exception 'opening balance cutover is required' using errcode='22023'; end if;

  select * into v_cutover from public.finance_opening_balance_cutovers where id=p_cutover_id for update;
  if v_cutover.id is null then raise exception 'opening balance cutover not found' using errcode='P0002'; end if;
  if v_cutover.status<>'draft' then raise exception 'only a draft opening balance can be posted' using errcode='22023'; end if;
  if exists(select 1 from public.finance_opening_balance_cutovers where status='posted' and id<>v_cutover.id) then
    raise exception 'an opening balance cutover is already posted' using errcode='22023';
  end if;

  v_validation:=private.finance_validate_opening_balance_lines(v_cutover.lines,true);

  select min(entry_date) into v_earliest
  from public.finance_journal_entries
  where source_type not in ('opening_balance','opening_reversal');
  if v_earliest is not null and v_cutover.cutover_date>=v_earliest then
    raise exception 'cutover date must be before the first existing ledger activity date (%)',v_earliest using errcode='22023';
  end if;

  select count(*) into v_failures from public.finance_ledger_posting_failures where resolved_at is null;
  if v_failures>0 then
    raise exception 'resolve all source-to-ledger posting failures before posting opening balances' using errcode='22023';
  end if;

  insert into public.finance_journal_entries(
    entry_date,reference,memo,source_type,status,created_by,created_at,posted_at
  ) values(
    v_cutover.cutover_date,'OPENING',concat('Opening balance cutover as of ',v_cutover.cutover_date::text),
    'opening_balance','posted',auth.uid(),now(),now()
  ) returning * into v_journal;

  for v_line in select value from jsonb_array_elements(v_validation->'lines') loop
    v_line_order:=v_line_order+1;
    insert into public.finance_journal_lines(entry_id,account_id,description,debit,credit,line_order)
    values(
      v_journal.id,
      (v_line->>'accountId')::uuid,
      coalesce(nullif(v_line->>'note',''),'Opening balance'),
      case when v_line->>'side'='debit' then (v_line->>'amount')::numeric else 0 end,
      case when v_line->>'side'='credit' then (v_line->>'amount')::numeric else 0 end,
      v_line_order
    );
  end loop;

  update public.finance_opening_balance_cutovers
  set status='posted',lines=v_validation->'lines',
      total_debits=(v_validation->>'totalDebits')::numeric,
      total_credits=(v_validation->>'totalCredits')::numeric,
      journal_entry_id=v_journal.id,posted_by=auth.uid(),posted_at=now(),updated_by=auth.uid(),updated_at=now()
  where id=v_cutover.id returning * into v_cutover;

  insert into public.finance_opening_balance_events(cutover_id,event_type,details,created_by)
  values(v_cutover.id,'posted',jsonb_build_object('journalEntryId',v_journal.id,'entryNumber',v_journal.entry_number,'total',v_cutover.total_debits),auth.uid());

  return jsonb_build_object('cutover',to_jsonb(v_cutover),'journal',to_jsonb(v_journal));
end;
$$;

create or replace function private.finance_reverse_opening_balance_cutover_impl(
  p_cutover_id uuid,
  p_reversal_date date,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_cutover public.finance_opening_balance_cutovers;
  v_original public.finance_journal_entries;
  v_reversal public.finance_journal_entries;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_today date:=(now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  if p_cutover_id is null or p_reversal_date is null or v_reason is null then
    raise exception 'cutover, reversal date and reason are required' using errcode='22023';
  end if;
  if p_reversal_date>v_today then raise exception 'reversal date cannot be in the future' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'reversal reason is too long' using errcode='22001'; end if;

  select * into v_cutover from public.finance_opening_balance_cutovers where id=p_cutover_id for update;
  if v_cutover.id is null then raise exception 'opening balance cutover not found' using errcode='P0002'; end if;
  if v_cutover.status<>'posted' or v_cutover.journal_entry_id is null then
    raise exception 'only the active posted opening balance can be reversed' using errcode='22023';
  end if;
  if p_reversal_date<v_cutover.cutover_date then
    raise exception 'reversal date cannot be before the opening balance date' using errcode='22023';
  end if;

  select * into v_original from public.finance_journal_entries where id=v_cutover.journal_entry_id for update;
  if v_original.id is null or v_original.source_type<>'opening_balance' or v_original.status<>'posted' then
    raise exception 'opening balance journal is unavailable for reversal' using errcode='22023';
  end if;

  insert into public.finance_journal_entries(
    entry_date,reference,memo,source_type,status,reversal_of_entry_id,created_by,created_at,posted_at
  ) values(
    p_reversal_date,concat('REV-OPENING-',v_original.entry_number),
    concat('Reversal of opening balance journal #',v_original.entry_number,': ',v_reason),
    'opening_reversal','posted',v_original.id,auth.uid(),now(),now()
  ) returning * into v_reversal;

  insert into public.finance_journal_lines(entry_id,account_id,description,debit,credit,line_order)
  select v_reversal.id,l.account_id,coalesce(l.description,concat('Reversal of opening balance journal #',v_original.entry_number)),l.credit,l.debit,l.line_order
  from public.finance_journal_lines l
  where l.entry_id=v_original.id
  order by l.line_order;

  update public.finance_journal_entries
  set status='reversed',reversed_by_entry_id=v_reversal.id,reversal_reason=v_reason,reversed_at=now(),reversed_by=auth.uid()
  where id=v_original.id;

  update public.finance_opening_balance_cutovers
  set status='reversed',reversal_entry_id=v_reversal.id,reversal_reason=v_reason,
      reversed_by=auth.uid(),reversed_at=now(),updated_by=auth.uid(),updated_at=now()
  where id=v_cutover.id returning * into v_cutover;

  insert into public.finance_opening_balance_events(cutover_id,event_type,details,created_by)
  values(v_cutover.id,'reversed',jsonb_build_object('reversalEntryId',v_reversal.id,'entryNumber',v_reversal.entry_number,'reason',v_reason),auth.uid());

  return jsonb_build_object('cutover',to_jsonb(v_cutover),'reversal',to_jsonb(v_reversal));
end;
$$;

create or replace function private.finance_guard_opening_cutover_date()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_cutover_date date;
begin
  if new.source_type in ('opening_balance','opening_reversal') then return new; end if;
  select cutover_date into v_cutover_date
  from public.finance_opening_balance_cutovers
  where status='posted'
  order by posted_at desc
  limit 1;
  if v_cutover_date is not null and new.entry_date<=v_cutover_date then
    raise exception 'journal date is on or before the active opening-balance cutover (%); reverse the cutover before backdating ledger activity',v_cutover_date using errcode='22023';
  end if;
  return new;
end;
$$;

drop trigger if exists finance_journal_entries_opening_cutover_guard on public.finance_journal_entries;
create trigger finance_journal_entries_opening_cutover_guard
before insert on public.finance_journal_entries
for each row execute function private.finance_guard_opening_cutover_date();

revoke all on function private.finance_validate_opening_balance_lines(jsonb,boolean) from public,anon,authenticated;
revoke all on function private.finance_guard_opening_cutover_date() from public,anon,authenticated;
grant execute on function private.finance_validate_opening_balance_lines(jsonb,boolean) to service_role;
grant execute on function private.finance_guard_opening_cutover_date() to service_role;

revoke all on function private.finance_get_opening_balance_cutover_impl() from public,anon;
revoke all on function private.finance_save_opening_balance_cutover_impl(date,text,jsonb) from public,anon;
revoke all on function private.finance_post_opening_balance_cutover_impl(uuid) from public,anon;
revoke all on function private.finance_reverse_opening_balance_cutover_impl(uuid,date,text) from public,anon;
grant execute on function private.finance_get_opening_balance_cutover_impl() to authenticated,service_role;
grant execute on function private.finance_save_opening_balance_cutover_impl(date,text,jsonb) to authenticated,service_role;
grant execute on function private.finance_post_opening_balance_cutover_impl(uuid) to authenticated,service_role;
grant execute on function private.finance_reverse_opening_balance_cutover_impl(uuid,date,text) to authenticated,service_role;

create or replace function public.get_admin_opening_balance_cutover()
returns jsonb language sql stable security invoker set search_path=pg_catalog
as $$ select private.finance_get_opening_balance_cutover_impl(); $$;

create or replace function public.save_admin_opening_balance_cutover(p_cutover_date date,p_notes text,p_lines jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$ select private.finance_save_opening_balance_cutover_impl(p_cutover_date,p_notes,p_lines); $$;

create or replace function public.post_admin_opening_balance_cutover(p_cutover_id uuid)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$ select private.finance_post_opening_balance_cutover_impl(p_cutover_id); $$;

create or replace function public.reverse_admin_opening_balance_cutover(p_cutover_id uuid,p_reversal_date date,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog
as $$ select private.finance_reverse_opening_balance_cutover_impl(p_cutover_id,p_reversal_date,p_reason); $$;

revoke all on function public.get_admin_opening_balance_cutover() from public,anon;
revoke all on function public.save_admin_opening_balance_cutover(date,text,jsonb) from public,anon;
revoke all on function public.post_admin_opening_balance_cutover(uuid) from public,anon;
revoke all on function public.reverse_admin_opening_balance_cutover(uuid,date,text) from public,anon;
grant execute on function public.get_admin_opening_balance_cutover() to authenticated,service_role;
grant execute on function public.save_admin_opening_balance_cutover(date,text,jsonb) to authenticated,service_role;
grant execute on function public.post_admin_opening_balance_cutover(uuid) to authenticated,service_role;
grant execute on function public.reverse_admin_opening_balance_cutover(uuid,date,text) to authenticated,service_role;

commit;
