-- Store invoice draft financial rows and presentation metadata as one transaction.
-- Existing draft validation, RLS/admin checks and immutable-ledger guards remain in their respective RPCs.
create or replace function public.save_admin_invoice_draft_complete(
  p_id uuid, p_order jsonb, p_items jsonb, p_meta jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if jsonb_typeof(p_meta) <> 'object' or length(p_meta::text) > 8000 then
    raise exception 'Invalid invoice metadata';
  end if;
  v_id := public.save_admin_draft_atomic(p_id,p_order,p_items);
  perform public.save_admin_invoice_document_meta(v_id,p_meta);
  return v_id;
end $$;
revoke all on function public.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_admin_invoice_draft_complete(uuid,jsonb,jsonb,jsonb) to authenticated;
