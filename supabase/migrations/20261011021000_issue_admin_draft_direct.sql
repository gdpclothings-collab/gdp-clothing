-- All-or-nothing conversion + issuance: failures roll back the draft status.
create or replace function public.issue_admin_invoice_from_draft(p_order_id uuid)
returns public.gdp_invoices
language plpgsql security definer set search_path = '' as $$
declare v_status text; v_invoice public.gdp_invoices%rowtype;
begin
  if auth.uid() is null or not public.is_admin() or not public.is_admin_step_up_authorized() then
    raise exception 'Admin MFA step-up authorization required' using errcode='42501';
  end if;
  if p_order_id is null then raise exception 'Order ID required'; end if;
  select status into v_status from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_status='draft' then
    perform public.activate_admin_draft_atomic(p_order_id);
  end if;
  v_invoice := public.issue_admin_order_invoice(p_order_id);
  return v_invoice;
end $$;
revoke all on function public.issue_admin_invoice_from_draft(uuid) from public,anon;
grant execute on function public.issue_admin_invoice_from_draft(uuid) to authenticated;