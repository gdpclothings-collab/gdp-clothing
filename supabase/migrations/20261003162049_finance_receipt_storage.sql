begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-receipts',
  'finance-receipts',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.finance_expenses
  add column if not exists receipt_file_name text,
  add column if not exists receipt_mime_type text,
  add column if not exists receipt_size_bytes bigint,
  add column if not exists receipt_attached_at timestamptz,
  add column if not exists receipt_attached_by uuid references auth.users(id) on delete set null;

alter table public.finance_expenses
  drop constraint if exists finance_expenses_receipt_path_len,
  add constraint finance_expenses_receipt_path_len check (receipt_path is null or char_length(receipt_path) <= 1024),
  drop constraint if exists finance_expenses_receipt_file_name_len,
  add constraint finance_expenses_receipt_file_name_len check (receipt_file_name is null or char_length(receipt_file_name) <= 255),
  drop constraint if exists finance_expenses_receipt_file_shape,
  add constraint finance_expenses_receipt_file_shape check (
    (
      receipt_path is null and receipt_file_name is null and receipt_mime_type is null and
      receipt_size_bytes is null and receipt_attached_at is null and receipt_attached_by is null
    )
    or
    (
      receipt_path is not null and
      receipt_path like (id::text || '/%') and
      receipt_file_name is not null and
      receipt_mime_type in ('image/jpeg','image/png','image/webp','application/pdf') and
      receipt_size_bytes between 1 and 10485760 and
      receipt_attached_at is not null
    )
  );

create index if not exists finance_expenses_receipt_attached_by_idx
  on public.finance_expenses (receipt_attached_by);

alter table public.finance_expense_events
  drop constraint if exists finance_expense_events_event_type_check,
  add constraint finance_expense_events_event_type_check check (
    event_type in (
      'created','corrected','voided','tax_updated',
      'receipt_attached','receipt_replaced','receipt_removed'
    )
  );

drop policy if exists finance_receipts_admin_insert on storage.objects;
create policy finance_receipts_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'finance-receipts'
  and (select public.is_admin_step_up_authorized())
  and exists (
    select 1
    from public.finance_expenses e
    where e.id::text = (storage.foldername(name))[1]
      and e.status = 'active'
  )
);

drop policy if exists finance_receipts_admin_read on storage.objects;
create policy finance_receipts_admin_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'finance-receipts'
  and (select public.is_admin_step_up_authorized())
);

drop policy if exists finance_receipts_admin_delete on storage.objects;
create policy finance_receipts_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'finance-receipts'
  and (select public.is_admin_step_up_authorized())
);

create or replace function private.finance_set_expense_receipt_impl(
  p_expense_id uuid,
  p_receipt_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_before public.finance_expenses;
  v_after public.finance_expenses;
  v_path text := nullif(trim(coalesce(p_receipt_path,'')), '');
  v_file_name text := nullif(trim(coalesce(p_file_name,'')), '');
  v_mime text := lower(nullif(trim(coalesce(p_mime_type,'')), ''));
  v_event text;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_expense_id is null then raise exception 'expense is required' using errcode = '22023'; end if;
  if v_path is null or v_file_name is null or v_mime is null then raise exception 'receipt file metadata is required' using errcode = '22023'; end if;
  if char_length(v_path) > 1024 or char_length(v_file_name) > 255 then raise exception 'receipt file metadata is too long' using errcode = '22001'; end if;
  if v_path not like (p_expense_id::text || '/%') then raise exception 'receipt path must be scoped to the expense' using errcode = '22023'; end if;
  if v_mime not in ('image/jpeg','image/png','image/webp','application/pdf') then raise exception 'unsupported receipt file type' using errcode = '22023'; end if;
  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 10485760 then raise exception 'receipt file must be 10 MB or smaller' using errcode = '22023'; end if;

  select * into v_before from public.finance_expenses where id = p_expense_id for update;
  if v_before.id is null then raise exception 'expense not found' using errcode = 'P0002'; end if;
  if v_before.status <> 'active' then raise exception 'only active expenses can receive files' using errcode = '22023'; end if;

  v_event := case when v_before.receipt_path is null then 'receipt_attached' else 'receipt_replaced' end;

  update public.finance_expenses
  set receipt_path = v_path,
      receipt_file_name = v_file_name,
      receipt_mime_type = v_mime,
      receipt_size_bytes = p_size_bytes,
      receipt_attached_at = now(),
      receipt_attached_by = auth.uid(),
      updated_at = now()
  where id = p_expense_id
  returning * into v_after;

  insert into public.finance_expense_events (
    expense_id,event_type,reason,before_snapshot,after_snapshot,created_by
  ) values (
    p_expense_id,
    v_event,
    case when v_event = 'receipt_attached' then 'Receipt file attached' else 'Receipt file replaced' end,
    to_jsonb(v_before),to_jsonb(v_after),auth.uid()
  );

  return jsonb_build_object(
    'expense', to_jsonb(v_after),
    'previousPath', v_before.receipt_path,
    'eventType', v_event
  );
end;
$$;

create or replace function private.finance_remove_expense_receipt_impl(p_expense_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_before public.finance_expenses;
  v_after public.finance_expenses;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_expense_id is null then raise exception 'expense is required' using errcode = '22023'; end if;

  select * into v_before from public.finance_expenses where id = p_expense_id for update;
  if v_before.id is null then raise exception 'expense not found' using errcode = 'P0002'; end if;
  if v_before.status <> 'active' then raise exception 'only active expenses can remove files' using errcode = '22023'; end if;
  if v_before.receipt_path is null then raise exception 'expense has no receipt file' using errcode = '22023'; end if;

  update public.finance_expenses
  set receipt_path = null,
      receipt_file_name = null,
      receipt_mime_type = null,
      receipt_size_bytes = null,
      receipt_attached_at = null,
      receipt_attached_by = null,
      updated_at = now()
  where id = p_expense_id
  returning * into v_after;

  insert into public.finance_expense_events (
    expense_id,event_type,reason,before_snapshot,after_snapshot,created_by
  ) values (
    p_expense_id,'receipt_removed','Receipt file removed',to_jsonb(v_before),to_jsonb(v_after),auth.uid()
  );

  return jsonb_build_object(
    'expense', to_jsonb(v_after),
    'previousPath', v_before.receipt_path,
    'eventType', 'receipt_removed'
  );
end;
$$;

create or replace function private.finance_get_expense_controls_impl(
  p_from date default null,
  p_to date default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit integer := greatest(25, least(1000, coalesce(p_limit,500)));
  v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;

  with filtered as (
    select e.*
    from public.finance_expenses e
    where (p_from is null or e.occurred_on >= p_from)
      and (p_to is null or e.occurred_on <= p_to)
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'activeCount', coalesce((select count(*) from filtered where status='active'),0),
      'activeTotal', coalesce((select sum(amount + tax) from filtered where status='active'),0),
      'gstHstTax', coalesce((select sum(gst_hst_tax) from filtered where status='active'),0),
      'pstTax', coalesce((select sum(pst_tax) from filtered where status='active'),0),
      'itcPotential', coalesce((select sum(gst_hst_tax) from filtered where status='active' and gst_hst_itc_eligible),0),
      'receiptReferences', coalesce((select count(*) from filtered where status='active' and nullif(trim(coalesce(receipt_reference,'')),'') is not null),0),
      'receiptFiles', coalesce((select count(*) from filtered where status='active' and receipt_path is not null),0),
      'voidedCount', coalesce((select count(*) from filtered where status='voided'),0)
    ),
    'expenses', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.occurred_on desc, x.created_at desc)
      from (
        select id, occurred_on, vendor, category, description, amount, tax,
          gst_hst_tax, pst_tax, gst_hst_itc_eligible, currency, payment_method,
          receipt_path, receipt_reference, receipt_file_name, receipt_mime_type,
          receipt_size_bytes, receipt_attached_at, notes, status, correction_count,
          last_corrected_at, voided_at, void_reason, created_at, updated_at
        from filtered
        order by occurred_on desc, created_at desc
        limit v_limit
      ) x
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select ev.id, ev.expense_id, ev.event_type, ev.reason, ev.created_at
        from public.finance_expense_events ev
        join filtered e on e.id = ev.expense_id
        order by ev.created_at desc
        limit least(v_limit * 4, 2000)
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function private.finance_set_expense_receipt_impl(uuid,text,text,text,bigint) from public, anon;
revoke all on function private.finance_remove_expense_receipt_impl(uuid) from public, anon;
grant execute on function private.finance_set_expense_receipt_impl(uuid,text,text,text,bigint) to authenticated, service_role;
grant execute on function private.finance_remove_expense_receipt_impl(uuid) to authenticated, service_role;

create or replace function public.set_admin_expense_receipt(
  p_expense_id uuid,
  p_receipt_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.finance_set_expense_receipt_impl(
    p_expense_id,p_receipt_path,p_file_name,p_mime_type,p_size_bytes
  );
$$;

create or replace function public.remove_admin_expense_receipt(p_expense_id uuid)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.finance_remove_expense_receipt_impl(p_expense_id);
$$;

revoke all on function public.set_admin_expense_receipt(uuid,text,text,text,bigint) from public, anon;
revoke all on function public.remove_admin_expense_receipt(uuid) from public, anon;
grant execute on function public.set_admin_expense_receipt(uuid,text,text,text,bigint) to authenticated, service_role;
grant execute on function public.remove_admin_expense_receipt(uuid) to authenticated, service_role;

commit;
