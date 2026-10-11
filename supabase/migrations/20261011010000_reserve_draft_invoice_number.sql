-- Reserve one immutable official number for a saved invoice draft.
-- A reserved number is NOT an issued tax invoice. Deleted drafts may leave sequence gaps.
alter table public.orders add column if not exists reserved_invoice_number text;
create unique index if not exists orders_reserved_invoice_number_unique
 on public.orders(reserved_invoice_number) where reserved_invoice_number is not null;

create or replace function public.reserve_admin_invoice_number(p_order_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_number text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found or v_order.status <> 'draft' then raise exception 'Only drafts may reserve invoice numbers'; end if;
 if exists(select 1 from public.gdp_invoices where order_id=p_order_id) then raise exception 'Already issued'; end if;
 if v_order.reserved_invoice_number is not null then return v_order.reserved_invoice_number; end if;
 v_number := 'GDP-INV-' || lpad(nextval('public.gdp_invoice_number_seq'::regclass)::text,6,'0');
 update public.orders set reserved_invoice_number=v_number where id=p_order_id;
 return v_number;
end $$;
revoke all on function public.reserve_admin_invoice_number(uuid) from public,anon;
grant execute on function public.reserve_admin_invoice_number(uuid) to authenticated;

create or replace function public.save_admin_invoice_draft_complete(
  p_id uuid, p_order jsonb, p_items jsonb, p_meta jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if jsonb_typeof(p_meta)<>'object' or length(p_meta::text)>8000 then raise exception 'Invalid invoice metadata'; end if;
 v_id:=public.save_admin_draft_atomic(p_id,p_order,p_items);
 perform public.save_admin_invoice_document_meta(v_id,p_meta);
 perform public.reserve_admin_invoice_number(v_id);
 return v_id;
end $$;

-- Issuance reuses a reserved number, but still demands MFA and locks the ledger snapshot.
create or replace function public.issue_admin_order_invoice(p_order_id uuid)
returns public.gdp_invoices language plpgsql security definer set search_path='' as $$
declare v_order public.orders%rowtype; v_invoice public.gdp_invoices%rowtype; v_items jsonb; v_number text;
begin
 if auth.uid() is null or not public.is_admin() or not public.is_admin_step_up_authorized() then
   raise exception 'Admin MFA step-up authorization required' using errcode='42501';
 end if;
 if p_order_id is null then raise exception 'Order ID required'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 select * into v_invoice from public.gdp_invoices where order_id=p_order_id;
 if found then return v_invoice; end if;
 if v_order.status='draft' then raise exception 'Convert draft order before issuing an invoice'; end if;
 if v_order.status in ('cancelled','refunded','partially_refunded')
    or v_order.payment_status in ('refunded','partially_refunded') then
   raise exception 'Cannot issue invoice for cancelled/refunded order';
 end if;
 if abs(coalesce(v_order.gst_hst_tax,0)+coalesce(v_order.pst_tax,0)-coalesce(v_order.tax,0))>0.01 then
   raise exception 'Order tax breakdown requires review'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'name',i.name,'variant',i.variant,'size',i.size,'color',i.color,
  'quantity',i.quantity,'unit_price',i.unit_price
 ) order by i.id),'[]'::jsonb)
 into v_items from public.order_items i where i.order_id=p_order_id;
 if jsonb_array_length(v_items)=0 then raise exception 'Order has no items'; end if;
 if abs(coalesce(v_order.subtotal,0)-coalesce(v_order.discount,0)+coalesce(v_order.shipping,0)+coalesce(v_order.tax,0)-coalesce(v_order.total,0))>0.01 then
   raise exception 'Order totals inconsistent'; end if;
 v_number:=coalesce(v_order.reserved_invoice_number,
   'GDP-INV-'||lpad(nextval('public.gdp_invoice_number_seq'::regclass)::text,6,'0'));
 insert into public.gdp_invoices(order_id,invoice_number,issued_by,snapshot)
 values(p_order_id,v_number,auth.uid(),jsonb_build_object(
  'invoice_document_meta',v_order.invoice_document_meta,
  'order_number',v_order.order_number,'order_date',v_order.created_at,
  'payment_status_at_issue',v_order.payment_status,
  'customer_name',v_order.customer_name,'customer_email',v_order.customer_email,
  'customer_phone',v_order.customer_phone,'billing_address',v_order.billing_address,
  'subtotal',v_order.subtotal,'discount',v_order.discount,
  'shipping',v_order.shipping,'tax',v_order.tax,
  'gst_hst_tax',v_order.gst_hst_tax,'pst_tax',v_order.pst_tax,
  'total',v_order.total,'currency','CAD','items',v_items
 )) returning * into v_invoice;
 return v_invoice;
end $$;
