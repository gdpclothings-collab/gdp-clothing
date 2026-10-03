create table if not exists public.finance_bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null check (char_length(filename) between 1 and 255),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  source_row_count integer not null check (source_row_count > 0 and source_row_count <= 10000),
  submitted_row_count integer not null check (submitted_row_count >= 0 and submitted_row_count <= source_row_count),
  imported_row_count integer not null default 0 check (imported_row_count >= 0 and imported_row_count <= submitted_row_count),
  duplicate_row_count integer not null default 0 check (duplicate_row_count >= 0 and duplicate_row_count <= submitted_row_count),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finance_bank_import_batches_accounting check (imported_row_count + duplicate_row_count <= submitted_row_count)
);

create table if not exists public.finance_bank_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.finance_bank_import_batches(id) on delete restrict,
  bank_entry_id uuid not null references public.finance_bank_entries(id) on delete restrict,
  source_row_number integer not null check (source_row_number > 0),
  row_fingerprint text not null check (row_fingerprint ~ '^[0-9a-f]{32}$'),
  raw_row jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint finance_bank_import_rows_raw_object check (jsonb_typeof(raw_row) = 'object')
);

create unique index if not exists finance_bank_import_rows_active_fingerprint_uidx
  on public.finance_bank_import_rows (row_fingerprint)
  where active;
create index if not exists finance_bank_import_rows_batch_idx on public.finance_bank_import_rows (batch_id, source_row_number);
create index if not exists finance_bank_import_rows_bank_entry_idx on public.finance_bank_import_rows (bank_entry_id);
create index if not exists finance_bank_import_batches_created_at_idx on public.finance_bank_import_batches (created_at desc);
create index if not exists finance_bank_import_batches_created_by_idx on public.finance_bank_import_batches (created_by);

alter table public.finance_bank_import_batches enable row level security;
alter table public.finance_bank_import_rows enable row level security;

drop policy if exists finance_bank_import_batches_admin_read on public.finance_bank_import_batches;
create policy finance_bank_import_batches_admin_read
  on public.finance_bank_import_batches for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

drop policy if exists finance_bank_import_rows_admin_read on public.finance_bank_import_rows;
create policy finance_bank_import_rows_admin_read
  on public.finance_bank_import_rows for select to authenticated
  using ((select public.is_admin_step_up_authorized()));

revoke all on table public.finance_bank_import_batches from public, anon, authenticated;
revoke all on table public.finance_bank_import_rows from public, anon, authenticated;
grant select on table public.finance_bank_import_batches to authenticated;
grant select on table public.finance_bank_import_rows to authenticated;
grant all on table public.finance_bank_import_batches to service_role;
grant all on table public.finance_bank_import_rows to service_role;

create or replace function private.finance_bank_import_row_fingerprint(p_item jsonb)
returns text
language sql
immutable
set search_path = pg_catalog
as $function$
  select pg_catalog.md5(
    COALESCE((p_item->'raw')::text, '{}') || '|' ||
    COALESCE(p_item->>'occurredOn','') || '|' ||
    pg_catalog.lower(pg_catalog.btrim(COALESCE(p_item->>'direction',''))) || '|' ||
    COALESCE(p_item->>'amount','') || '|' ||
    pg_catalog.lower(pg_catalog.btrim(COALESCE(p_item->>'description',''))) || '|' ||
    pg_catalog.lower(pg_catalog.btrim(COALESCE(p_item->>'reference','')))
  );
$function$;

create or replace function private.finance_preview_bank_import_impl(p_rows jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_count integer;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception 'bank import rows must be an array' using errcode = '22023';
  end if;
  v_count := pg_catalog.jsonb_array_length(p_rows);
  if v_count < 1 or v_count > 1000 then
    raise exception 'bank import preview must contain between 1 and 1000 rows' using errcode = '22023';
  end if;

  return (
    select COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'clientKey', x.item->>'clientKey',
      'fingerprint', x.fingerprint,
      'duplicate', (r.id is not null),
      'existingBankEntryId', r.bank_entry_id
    ) order by x.ordinality), '[]'::jsonb)
    from (
      select e.item, e.ordinality, private.finance_bank_import_row_fingerprint(e.item) as fingerprint
      from pg_catalog.jsonb_array_elements(p_rows) with ordinality as e(item, ordinality)
    ) x
    left join public.finance_bank_import_rows r
      on r.row_fingerprint = x.fingerprint and r.active
  );
end;
$function$;

create or replace function private.finance_import_bank_statement_impl(
  p_filename text,
  p_file_sha256 text,
  p_source_row_count integer,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_filename text := NULLIF(pg_catalog.btrim(COALESCE(p_filename,'')), '');
  v_file_sha text := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_file_sha256,'')));
  v_submitted integer;
  v_batch public.finance_bank_import_batches;
  v_item jsonb;
  v_ordinal bigint;
  v_fingerprint text;
  v_bank jsonb;
  v_imported integer := 0;
  v_duplicates integer := 0;
  v_raw jsonb;
  v_source_row_number integer;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if v_filename is null or pg_catalog.char_length(v_filename) > 255 then
    raise exception 'valid CSV filename is required' using errcode = '22023';
  end if;
  if v_file_sha !~ '^[0-9a-f]{64}$' then
    raise exception 'valid SHA-256 file fingerprint is required' using errcode = '22023';
  end if;
  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception 'bank import rows must be an array' using errcode = '22023';
  end if;
  v_submitted := pg_catalog.jsonb_array_length(p_rows);
  if v_submitted < 1 or v_submitted > 500 then
    raise exception 'bank import must contain between 1 and 500 selected rows' using errcode = '22023';
  end if;
  if p_source_row_count is null or p_source_row_count < v_submitted or p_source_row_count > 10000 then
    raise exception 'invalid source row count' using errcode = '22023';
  end if;

  insert into public.finance_bank_import_batches (
    filename, file_sha256, source_row_count, submitted_row_count, created_by
  ) values (
    v_filename, v_file_sha, p_source_row_count, v_submitted, auth.uid()
  ) returning * into v_batch;

  for v_item, v_ordinal in
    select e.item, e.ordinality
    from pg_catalog.jsonb_array_elements(p_rows) with ordinality as e(item, ordinality)
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      raise exception 'every bank import row must be an object' using errcode = '22023';
    end if;
    v_raw := COALESCE(v_item->'raw', '{}'::jsonb);
    if pg_catalog.jsonb_typeof(v_raw) <> 'object' then
      raise exception 'raw bank import row must be an object' using errcode = '22023';
    end if;
    v_fingerprint := private.finance_bank_import_row_fingerprint(v_item);

    if exists (
      select 1 from public.finance_bank_import_rows r
      where r.row_fingerprint = v_fingerprint and r.active
    ) then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    v_bank := private.finance_create_bank_entry_impl(
      (v_item->>'occurredOn')::date,
      v_item->>'direction',
      (v_item->>'amount')::numeric,
      v_item->>'description',
      NULLIF(pg_catalog.btrim(COALESCE(v_item->>'reference','')), ''),
      COALESCE(NULLIF(pg_catalog.btrim(v_item->>'sourceType'), ''), 'other'),
      NULLIF(pg_catalog.btrim(COALESCE(v_item->>'sourceReference','')), ''),
      case when NULLIF(pg_catalog.btrim(COALESCE(v_item->>'expectedAmount','')), '') is null then null else (v_item->>'expectedAmount')::numeric end,
      NULLIF(pg_catalog.btrim(COALESCE(v_item->>'notes','')), '')
    );

    v_source_row_number := case
      when NULLIF(COALESCE(v_item->>'sourceRowNumber',''), '') is null then v_ordinal::integer
      else (v_item->>'sourceRowNumber')::integer
    end;
    if v_source_row_number < 1 then
      raise exception 'source row number must be positive' using errcode = '22023';
    end if;

    insert into public.finance_bank_import_rows (
      batch_id, bank_entry_id, source_row_number, row_fingerprint, raw_row, active
    ) values (
      v_batch.id,
      (v_bank->>'id')::uuid,
      v_source_row_number,
      v_fingerprint,
      v_raw,
      true
    );
    v_imported := v_imported + 1;
  end loop;

  update public.finance_bank_import_batches
  set imported_row_count = v_imported,
      duplicate_row_count = v_duplicates
  where id = v_batch.id
  returning * into v_batch;

  return pg_catalog.jsonb_build_object(
    'batchId', v_batch.id,
    'filename', v_batch.filename,
    'sourceRows', v_batch.source_row_count,
    'submittedRows', v_batch.submitted_row_count,
    'importedRows', v_batch.imported_row_count,
    'duplicateRows', v_batch.duplicate_row_count,
    'createdAt', v_batch.created_at
  );
end;
$function$;

create or replace function private.finance_get_bank_import_history_impl(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_limit integer := GREATEST(10, LEAST(100, COALESCE(p_limit,50)));
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object(
    'batches', COALESCE((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.created_at desc)
      from (
        select b.id, b.filename, b.file_sha256, b.source_row_count,
          b.submitted_row_count, b.imported_row_count, b.duplicate_row_count,
          b.created_at
        from public.finance_bank_import_batches b
        order by b.created_at desc
        limit v_limit
      ) x
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function private.finance_void_bank_entry_impl(
  p_bank_entry_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_before public.finance_bank_entries;
  v_after public.finance_bank_entries;
  v_reason text := NULLIF(pg_catalog.btrim(COALESCE(p_reason,'')), '');
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode = '42501';
  end if;
  if p_bank_entry_id is null then
    raise exception 'bank entry is required' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'void reason is required' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_reason) > 500 then
    raise exception 'void reason is too long' using errcode = '22001';
  end if;

  select * into v_before from public.finance_bank_entries where id = p_bank_entry_id for update;
  if v_before.id is null then
    raise exception 'bank entry not found' using errcode = 'P0002';
  end if;
  if v_before.status <> 'active' then
    raise exception 'bank entry is already voided' using errcode = '22023';
  end if;

  update public.finance_bank_entries
  set status='voided', voided_at=pg_catalog.now(), voided_by=auth.uid(), void_reason=v_reason, updated_at=pg_catalog.now()
  where id=p_bank_entry_id
  returning * into v_after;

  update public.finance_bank_import_rows
  set active = false
  where bank_entry_id = p_bank_entry_id and active;

  insert into public.finance_bank_entry_events (bank_entry_id, event_type, reason, snapshot, created_by)
  values (v_after.id, 'voided', v_reason, pg_catalog.to_jsonb(v_after), auth.uid());

  return pg_catalog.to_jsonb(v_after);
end;
$function$;

create or replace function public.preview_admin_bank_statement_import(p_rows jsonb)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $function$
  select private.finance_preview_bank_import_impl(p_rows);
$function$;

create or replace function public.import_admin_bank_statement(
  p_filename text,
  p_file_sha256 text,
  p_source_row_count integer,
  p_rows jsonb
) returns jsonb
language sql
set search_path = pg_catalog
as $function$
  select private.finance_import_bank_statement_impl(p_filename,p_file_sha256,p_source_row_count,p_rows);
$function$;

create or replace function public.get_admin_bank_import_history(p_limit integer default 50)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $function$
  select private.finance_get_bank_import_history_impl(p_limit);
$function$;

revoke all on function public.preview_admin_bank_statement_import(jsonb) from public, anon;
revoke all on function public.import_admin_bank_statement(text,text,integer,jsonb) from public, anon;
revoke all on function public.get_admin_bank_import_history(integer) from public, anon;
grant execute on function public.preview_admin_bank_statement_import(jsonb) to authenticated;
grant execute on function public.import_admin_bank_statement(text,text,integer,jsonb) to authenticated;
grant execute on function public.get_admin_bank_import_history(integer) to authenticated;

revoke all on function private.finance_bank_import_row_fingerprint(jsonb) from public, anon, authenticated;
revoke all on function private.finance_preview_bank_import_impl(jsonb) from public, anon;
revoke all on function private.finance_import_bank_statement_impl(text,text,integer,jsonb) from public, anon;
revoke all on function private.finance_get_bank_import_history_impl(integer) from public, anon;
grant execute on function private.finance_preview_bank_import_impl(jsonb) to authenticated;
grant execute on function private.finance_import_bank_statement_impl(text,text,integer,jsonb) to authenticated;
grant execute on function private.finance_get_bank_import_history_impl(integer) to authenticated;
