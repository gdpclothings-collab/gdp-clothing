-- Read-only, bounded metadata listing for safe admin cleanup previews.
-- Storage object deletion MUST continue through Supabase Storage API.
create or replace function public.admin_cleanup_list_storage_files(p_bucket text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $body$
declare
  v_total integer;
  v_files jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service-only operation' using errcode = '42501';
  end if;
  if p_bucket not in ('customer-uploads','dtf-artwork') or p_bucket is null then
    raise exception 'Protected storage bucket' using errcode = '42501';
  end if;
  select count(*) into v_total from storage.objects where bucket_id=p_bucket;
  if v_total > 2000 then
    raise exception 'Too many upload files for safe cleanup preview';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'path', name,
    'created_at', created_at,
    'updated_at', updated_at,
    'bytes', case when (metadata->>'size') ~ '^[0-9]+$'
      then (metadata->>'size')::bigint else 0 end
  ) order by name), '[]'::jsonb)
  into v_files from storage.objects where bucket_id=p_bucket;
  return v_files;
end
$body$;
revoke all on function public.admin_cleanup_list_storage_files(text) from public, anon, authenticated;
grant execute on function public.admin_cleanup_list_storage_files(text) to service_role;