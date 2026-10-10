-- Invoice presentation metadata is editable on drafts only via the guarded draft RPC.
alter table public.orders add column if not exists invoice_document_meta jsonb not null default '{}'::jsonb;
comment on column public.orders.invoice_document_meta is 'Draft invoice display content (header, sender, PO/SO, invoice date, footer); snapshotted on issuance.';

create or replace function public.save_admin_invoice_document_meta(p_order_id uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required'; end if;
  if jsonb_typeof(p_meta) <> 'object' or length(p_meta::text)>8000 then raise exception 'Invalid invoice document metadata'; end if;
  if exists (select 1 from public.gdp_invoices where order_id=p_order_id) then raise exception 'Issued invoice is immutable'; end if;
  update public.orders set invoice_document_meta=p_meta where id=p_order_id and status='draft';
  if not found then raise exception 'Only draft invoice documents can be edited'; end if;
end $$;
revoke all on function public.save_admin_invoice_document_meta(uuid,jsonb) from public,anon;
grant execute on function public.save_admin_invoice_document_meta(uuid,jsonb) to authenticated;
