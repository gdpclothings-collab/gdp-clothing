begin;

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  normal_balance text not null check (normal_balance in ('debit','credit')),
  system_key text unique,
  active boolean not null default true,
  manual_posting_allowed boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_accounts_code_len check (char_length(code) between 1 and 20),
  constraint finance_accounts_name_len check (char_length(name) between 1 and 120)
);

insert into public.finance_accounts(code,name,account_type,normal_balance,system_key,manual_posting_allowed,sort_order)
values
  ('1000','Cash on Hand','asset','debit','cash_on_hand',true,1000),
  ('1010','Operating Bank','asset','debit','operating_bank',true,1010),
  ('1020','Stripe Clearing','asset','debit','stripe_clearing',true,1020),
  ('1100','Accounts Receivable','asset','debit','accounts_receivable',true,1100),
  ('1200','Inventory','asset','debit','inventory',true,1200),
  ('1300','Prepaid & Other Current Assets','asset','debit','other_current_assets',true,1300),
  ('1500','Equipment','asset','debit','equipment',true,1500),
  ('1590','Accumulated Depreciation','asset','credit','accumulated_depreciation',true,1590),
  ('2000','Accounts Payable','liability','credit','accounts_payable',true,2000),
  ('2100','GST/HST Payable','liability','credit','gst_hst_payable',true,2100),
  ('2110','PST Payable','liability','credit','pst_payable',true,2110),
  ('2200','Other Current Liabilities','liability','credit','other_current_liabilities',true,2200),
  ('3000','Owner Contributions','equity','credit','owner_contributions',true,3000),
  ('3100','Owner Draws','equity','debit','owner_draws',true,3100),
  ('3200','Retained Earnings','equity','credit','retained_earnings',true,3200),
  ('4000','Merchandise Sales','revenue','credit','merchandise_sales',true,4000),
  ('4010','Shipping Revenue','revenue','credit','shipping_revenue',true,4010),
  ('4090','Discounts & Promotions','revenue','debit','discounts_promotions',true,4090),
  ('4100','Sales Returns & Refunds','revenue','debit','sales_returns_refunds',true,4100),
  ('5000','Cost of Goods Sold','expense','debit','cost_of_goods_sold',true,5000),
  ('6000','Advertising','expense','debit','advertising_expense',true,6000),
  ('6010','Merchant / Stripe Fees','expense','debit','merchant_fees',true,6010),
  ('6020','Shipping & Delivery','expense','debit','shipping_delivery_expense',true,6020),
  ('6030','Software & Hosting','expense','debit','software_hosting_expense',true,6030),
  ('6040','Supplies & Packaging','expense','debit','supplies_packaging_expense',true,6040),
  ('6050','Repairs & Maintenance','expense','debit','repairs_maintenance_expense',true,6050),
  ('6070','Professional Fees','expense','debit','professional_fees_expense',true,6070),
  ('6080','Bank Fees','expense','debit','bank_fees_expense',true,6080),
  ('6090','Miscellaneous Operating Expense','expense','debit','misc_operating_expense',true,6090)
on conflict (code) do update set
  name=excluded.name,
  account_type=excluded.account_type,
  normal_balance=excluded.normal_balance,
  system_key=excluded.system_key,
  manual_posting_allowed=excluded.manual_posting_allowed,
  sort_order=excluded.sort_order,
  updated_at=now();

create table if not exists public.finance_journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_number bigint generated always as identity unique,
  entry_date date not null,
  reference text,
  memo text not null,
  source_type text not null default 'manual' check (source_type in ('manual','reversal')),
  status text not null default 'posted' check (status in ('posted','reversed')),
  reversal_of_entry_id uuid references public.finance_journal_entries(id) on delete restrict,
  reversed_by_entry_id uuid references public.finance_journal_entries(id) on delete restrict,
  reversal_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  posted_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  constraint finance_journal_entries_reference_len check (reference is null or char_length(reference) <= 120),
  constraint finance_journal_entries_memo_len check (char_length(memo) between 1 and 500),
  constraint finance_journal_entries_reversal_reason_len check (reversal_reason is null or char_length(reversal_reason) between 1 and 500),
  constraint finance_journal_entries_no_self_reversal check (reversal_of_entry_id is null or reversal_of_entry_id <> id),
  constraint finance_journal_entries_no_self_reversed_by check (reversed_by_entry_id is null or reversed_by_entry_id <> id)
);

create table if not exists public.finance_journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.finance_journal_entries(id) on delete restrict,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  description text,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  line_order integer not null,
  created_at timestamptz not null default now(),
  constraint finance_journal_lines_one_side check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  constraint finance_journal_lines_description_len check (description is null or char_length(description) <= 240),
  unique(entry_id,line_order)
);

create index if not exists finance_accounts_type_order_idx on public.finance_accounts(account_type,sort_order,code);
create index if not exists finance_journal_entries_date_idx on public.finance_journal_entries(entry_date desc,entry_number desc);
create index if not exists finance_journal_entries_source_idx on public.finance_journal_entries(source_type,status,entry_date desc);
create index if not exists finance_journal_entries_created_by_idx on public.finance_journal_entries(created_by);
create index if not exists finance_journal_entries_reversal_of_idx on public.finance_journal_entries(reversal_of_entry_id) where reversal_of_entry_id is not null;
create index if not exists finance_journal_lines_entry_idx on public.finance_journal_lines(entry_id,line_order);
create index if not exists finance_journal_lines_account_idx on public.finance_journal_lines(account_id,entry_id);

alter table public.finance_accounts enable row level security;
alter table public.finance_journal_entries enable row level security;
alter table public.finance_journal_lines enable row level security;

revoke all on table public.finance_accounts from public,anon;
revoke all on table public.finance_journal_entries from public,anon;
revoke all on table public.finance_journal_lines from public,anon;
revoke insert,update,delete on table public.finance_accounts from authenticated;
revoke insert,update,delete on table public.finance_journal_entries from authenticated;
revoke insert,update,delete on table public.finance_journal_lines from authenticated;
grant select on table public.finance_accounts to authenticated;
grant select on table public.finance_journal_entries to authenticated;
grant select on table public.finance_journal_lines to authenticated;
grant all on table public.finance_accounts to service_role;
grant all on table public.finance_journal_entries to service_role;
grant all on table public.finance_journal_lines to service_role;

drop policy if exists finance_accounts_admin_select on public.finance_accounts;
create policy finance_accounts_admin_select on public.finance_accounts for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_journal_entries_admin_select on public.finance_journal_entries;
create policy finance_journal_entries_admin_select on public.finance_journal_entries for select to authenticated using ((select public.is_admin_step_up_authorized()));
drop policy if exists finance_journal_lines_admin_select on public.finance_journal_lines;
create policy finance_journal_lines_admin_select on public.finance_journal_lines for select to authenticated using ((select public.is_admin_step_up_authorized()));

create or replace function private.finance_record_manual_journal_impl(
  p_entry_date date,
  p_reference text,
  p_memo text,
  p_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_entry public.finance_journal_entries;
  v_line jsonb;
  v_account_id uuid;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
  v_description text;
  v_total_debit numeric(16,2):=0;
  v_total_credit numeric(16,2):=0;
  v_line_count integer:=0;
  v_reference text:=nullif(trim(coalesce(p_reference,'')),'');
  v_memo text:=nullif(trim(coalesce(p_memo,'')),'');
  v_today date:=(now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_entry_date is null then raise exception 'journal date is required' using errcode='22023'; end if;
  if p_entry_date > v_today then raise exception 'future-dated manual journals are not allowed' using errcode='22023'; end if;
  if v_memo is null then raise exception 'journal memo is required' using errcode='22023'; end if;
  if char_length(v_memo)>500 then raise exception 'journal memo is too long' using errcode='22001'; end if;
  if v_reference is not null and char_length(v_reference)>120 then raise exception 'journal reference is too long' using errcode='22001'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' then raise exception 'journal lines must be an array' using errcode='22023'; end if;
  v_line_count:=jsonb_array_length(p_lines);
  if v_line_count<2 or v_line_count>50 then raise exception 'journal requires between 2 and 50 lines' using errcode='22023'; end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    begin
      v_account_id:=(v_line->>'accountId')::uuid;
      v_debit:=round(coalesce(nullif(v_line->>'debit','')::numeric,0),2);
      v_credit:=round(coalesce(nullif(v_line->>'credit','')::numeric,0),2);
    exception when others then
      raise exception 'journal line contains an invalid account or amount' using errcode='22023';
    end;
    v_description:=nullif(trim(coalesce(v_line->>'description','')),'');
    if v_description is not null and char_length(v_description)>240 then raise exception 'journal line description is too long' using errcode='22001'; end if;
    if v_debit::text='NaN' or v_credit::text='NaN' or v_debit<0 or v_credit<0 then raise exception 'journal amounts must be valid non-negative numbers' using errcode='22023'; end if;
    if not ((v_debit>0 and v_credit=0) or (v_credit>0 and v_debit=0)) then raise exception 'each journal line must contain either a debit or a credit' using errcode='22023'; end if;
    if not exists(select 1 from public.finance_accounts a where a.id=v_account_id and a.active and a.manual_posting_allowed) then raise exception 'journal account is unavailable for manual posting' using errcode='22023'; end if;
    v_total_debit:=round(v_total_debit+v_debit,2);
    v_total_credit:=round(v_total_credit+v_credit,2);
  end loop;

  if v_total_debit<=0 or v_total_credit<=0 or v_total_debit<>v_total_credit then
    raise exception 'journal debits and credits must be equal and greater than zero' using errcode='22023';
  end if;

  insert into public.finance_journal_entries(entry_date,reference,memo,source_type,status,created_by,created_at,posted_at)
  values(p_entry_date,v_reference,v_memo,'manual','posted',auth.uid(),now(),now()) returning * into v_entry;

  v_line_count:=0;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_count:=v_line_count+1;
    v_account_id:=(v_line->>'accountId')::uuid;
    v_debit:=round(coalesce(nullif(v_line->>'debit','')::numeric,0),2);
    v_credit:=round(coalesce(nullif(v_line->>'credit','')::numeric,0),2);
    v_description:=nullif(trim(coalesce(v_line->>'description','')),'');
    insert into public.finance_journal_lines(entry_id,account_id,description,debit,credit,line_order)
    values(v_entry.id,v_account_id,v_description,v_debit,v_credit,v_line_count);
  end loop;

  return jsonb_build_object('entry',to_jsonb(v_entry),'totalDebit',v_total_debit,'totalCredit',v_total_credit,'lineCount',v_line_count);
end;
$$;

create or replace function private.finance_reverse_journal_entry_impl(
  p_entry_id uuid,
  p_reversal_date date,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_original public.finance_journal_entries;
  v_reversal public.finance_journal_entries;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_today date:=(now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_entry_id is null or p_reversal_date is null or v_reason is null then raise exception 'journal, reversal date and reason are required' using errcode='22023'; end if;
  if p_reversal_date>v_today then raise exception 'future-dated journal reversals are not allowed' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'reversal reason is too long' using errcode='22001'; end if;

  select * into v_original from public.finance_journal_entries where id=p_entry_id for update;
  if v_original.id is null then raise exception 'journal entry not found' using errcode='P0002'; end if;
  if v_original.source_type<>'manual' then raise exception 'only original manual journal entries can be reversed here' using errcode='22023'; end if;
  if v_original.status<>'posted' or v_original.reversed_by_entry_id is not null then raise exception 'journal entry is already reversed' using errcode='22023'; end if;
  if not exists(select 1 from public.finance_journal_lines where entry_id=v_original.id) then raise exception 'journal entry has no lines' using errcode='22023'; end if;

  insert into public.finance_journal_entries(entry_date,reference,memo,source_type,status,reversal_of_entry_id,created_by,created_at,posted_at)
  values(p_reversal_date,concat('REV-',v_original.entry_number),concat('Reversal of journal #',v_original.entry_number,': ',v_reason),'reversal','posted',v_original.id,auth.uid(),now(),now()) returning * into v_reversal;

  insert into public.finance_journal_lines(entry_id,account_id,description,debit,credit,line_order)
  select v_reversal.id,l.account_id,coalesce(l.description,concat('Reversal of journal #',v_original.entry_number)),l.credit,l.debit,l.line_order
  from public.finance_journal_lines l where l.entry_id=v_original.id order by l.line_order;

  update public.finance_journal_entries
  set status='reversed',reversed_by_entry_id=v_reversal.id,reversal_reason=v_reason,reversed_at=now(),reversed_by=auth.uid()
  where id=v_original.id returning * into v_original;

  return jsonb_build_object('original',to_jsonb(v_original),'reversal',to_jsonb(v_reversal));
end;
$$;

create or replace function private.finance_get_general_ledger_impl(
  p_from date default null,
  p_to date default null,
  p_limit integer default 300
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_today date:=(now() at time zone 'America/Regina')::date;
  v_from date:=coalesce(p_from,date_trunc('month',v_today::timestamp)::date);
  v_to date:=coalesce(p_to,v_today);
  v_limit integer:=greatest(25,least(1000,coalesce(p_limit,300)));
  v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if v_from>v_to then raise exception 'ledger start date must be on or before end date' using errcode='22023'; end if;
  if v_to>v_today then raise exception 'ledger end date cannot be in the future' using errcode='22023'; end if;

  with scoped_entries as (
    select e.id from public.finance_journal_entries e
    where e.entry_date between v_from and v_to and e.status in ('posted','reversed')
  ), movement as (
    select l.account_id,round(coalesce(sum(l.debit),0),2) debits,round(coalesce(sum(l.credit),0),2) credits
    from public.finance_journal_lines l join scoped_entries e on e.id=l.entry_id
    group by l.account_id
  ), trial_balance as (
    select a.id account_id,a.code,a.name,a.account_type,a.normal_balance,a.system_key,a.active,a.manual_posting_allowed,
      coalesce(m.debits,0)::numeric(16,2) debits,coalesce(m.credits,0)::numeric(16,2) credits,
      round(coalesce(m.debits,0)-coalesce(m.credits,0),2)::numeric(16,2) signed_balance,
      case when coalesce(m.debits,0)-coalesce(m.credits,0)>=0 then round(coalesce(m.debits,0)-coalesce(m.credits,0),2) else 0 end::numeric(16,2) ending_debit,
      case when coalesce(m.credits,0)-coalesce(m.debits,0)>0 then round(coalesce(m.credits,0)-coalesce(m.debits,0),2) else 0 end::numeric(16,2) ending_credit,
      a.sort_order
    from public.finance_accounts a left join movement m on m.account_id=a.id
    where a.active
  ), entry_rows as (
    select e.id,e.entry_number,e.entry_date,e.reference,e.memo,e.source_type,e.status,e.reversal_of_entry_id,e.reversed_by_entry_id,e.reversal_reason,e.created_at,e.posted_at,e.reversed_at,
      coalesce((select round(sum(l.debit),2) from public.finance_journal_lines l where l.entry_id=e.id),0)::numeric(16,2) total_debit,
      coalesce((select round(sum(l.credit),2) from public.finance_journal_lines l where l.entry_id=e.id),0)::numeric(16,2) total_credit,
      coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'lineOrder',l.line_order,'accountId',a.id,'accountCode',a.code,'accountName',a.name,'description',l.description,'debit',l.debit,'credit',l.credit) order by l.line_order)
        from public.finance_journal_lines l join public.finance_accounts a on a.id=l.account_id where l.entry_id=e.id),'[]'::jsonb) lines
    from public.finance_journal_entries e
    where e.entry_date between v_from and v_to
    order by e.entry_date desc,e.entry_number desc
    limit v_limit
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'scope',jsonb_build_object('from',v_from,'to',v_to,'sourceIntegrationComplete',false,'mode','manual_only'),
    'summary',jsonb_build_object(
      'entryCount',(select count(*) from public.finance_journal_entries e where e.entry_date between v_from and v_to),
      'manualEntryCount',(select count(*) from public.finance_journal_entries e where e.entry_date between v_from and v_to and e.source_type='manual'),
      'reversalEntryCount',(select count(*) from public.finance_journal_entries e where e.entry_date between v_from and v_to and e.source_type='reversal'),
      'totalDebits',coalesce((select sum(debits) from movement),0),
      'totalCredits',coalesce((select sum(credits) from movement),0),
      'difference',round(coalesce((select sum(debits) from movement),0)-coalesce((select sum(credits) from movement),0),2),
      'balanced',round(coalesce((select sum(debits) from movement),0)-coalesce((select sum(credits) from movement),0),2)=0
    ),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'accountType',a.account_type,'normalBalance',a.normal_balance,'systemKey',a.system_key,'active',a.active,'manualPostingAllowed',a.manual_posting_allowed,'sortOrder',a.sort_order) order by a.sort_order,a.code) from public.finance_accounts a),'[]'::jsonb),
    'trialBalance',coalesce((select jsonb_agg(to_jsonb(tb)-'sort_order' order by tb.sort_order,tb.code) from trial_balance tb),'[]'::jsonb),
    'entries',coalesce((select jsonb_agg(to_jsonb(er) order by er.entry_date desc,er.entry_number desc) from entry_rows er),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function private.finance_record_manual_journal_impl(date,text,text,jsonb) from public,anon;
revoke all on function private.finance_reverse_journal_entry_impl(uuid,date,text) from public,anon;
revoke all on function private.finance_get_general_ledger_impl(date,date,integer) from public,anon;
grant execute on function private.finance_record_manual_journal_impl(date,text,text,jsonb) to authenticated,service_role;
grant execute on function private.finance_reverse_journal_entry_impl(uuid,date,text) to authenticated,service_role;
grant execute on function private.finance_get_general_ledger_impl(date,date,integer) to authenticated,service_role;

create or replace function public.record_admin_manual_journal(p_entry_date date,p_reference text,p_memo text,p_lines jsonb)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_record_manual_journal_impl(p_entry_date,p_reference,p_memo,p_lines); $$;
create or replace function public.reverse_admin_journal_entry(p_entry_id uuid,p_reversal_date date,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_reverse_journal_entry_impl(p_entry_id,p_reversal_date,p_reason); $$;
create or replace function public.get_admin_general_ledger(p_from date default null,p_to date default null,p_limit integer default 300)
returns jsonb language sql stable security invoker set search_path=pg_catalog as $$ select private.finance_get_general_ledger_impl(p_from,p_to,p_limit); $$;

revoke all on function public.record_admin_manual_journal(date,text,text,jsonb) from public,anon;
revoke all on function public.reverse_admin_journal_entry(uuid,date,text) from public,anon;
revoke all on function public.get_admin_general_ledger(date,date,integer) from public,anon;
grant execute on function public.record_admin_manual_journal(date,text,text,jsonb) to authenticated,service_role;
grant execute on function public.reverse_admin_journal_entry(uuid,date,text) to authenticated,service_role;
grant execute on function public.get_admin_general_ledger(date,date,integer) to authenticated,service_role;

commit;