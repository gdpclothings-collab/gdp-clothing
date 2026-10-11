-- Edit invoice presentation and payment due date in a single draft-only transaction.
create or replace function public.save_admin_invoice_layout_dates(
 p_order_id uuid, p_meta jsonb, p_due_date date
) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if jsonb_typeof(p_meta) <> 'object' or length(p_meta::text)>8000 then raise exception 'Invalid invoice metadata'; end if;
 if exists(select 1 from public.gdp_invoices where order_id=p_order_id) then raise exception 'Issued invoice cannot be edited'; end if;
 update public.orders set invoice_document_meta=p_meta, invoice_due_date=p_due_date
 where id=p_order_id and status='draft';
 if not found then raise exception 'Only draft invoices can be edited'; end if;
end $$;
revoke all on function public.save_admin_invoice_layout_dates(uuid,jsonb,date) from public,anon;
grant execute on function public.save_admin_invoice_layout_dates(uuid,jsonb,date) to authenticated;
