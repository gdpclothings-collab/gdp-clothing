create or replace function public.issue_admin_order_invoice(p_order_id uuid)
returns public.gdp_invoices
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_invoice public.gdp_invoices%rowtype;
  v_items jsonb;
  v_next bigint;
begin
  if auth.uid() is null or not public.is_admin() or not public.is_admin_step_up_authorized() then
    raise exception 'Admin MFA step-up authorization required';
  end if;
  if p_order_id is null then raise exception 'Order ID required'; end if;

  -- Serialize concurrent invoice creation for the same order.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select * into v_invoice from public.gdp_invoices where order_id = p_order_id;
  if found then return v_invoice; end if;

  if v_order.status = 'draft' then
    raise exception 'Convert draft order before issuing an invoice';
  end if;
  if v_order.status in ('cancelled', 'refunded', 'partially_refunded') or v_order.payment_status in ('refunded', 'partially_refunded') then
    raise exception 'Cannot issue an invoice for a cancelled or refunded order; review credit-note workflow';
  end if;
  if abs(coalesce(v_order.gst_hst_tax,0) + coalesce(v_order.pst_tax,0) - coalesce(v_order.tax,0)) > 0.01 then
    raise exception 'Order tax breakdown requires review before issuing an invoice';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', i.name, 'variant', i.variant, 'size', i.size,
    'color', i.color, 'quantity', i.quantity, 'unit_price', i.unit_price
  ) order by i.id), '[]'::jsonb)
  into v_items from public.order_items i where i.order_id = p_order_id;
  if jsonb_array_length(v_items) = 0 then raise exception 'Order has no items'; end if;
  if abs(coalesce(v_order.subtotal,0) - coalesce(v_order.discount,0) + coalesce(v_order.shipping,0) + coalesce(v_order.tax,0) - coalesce(v_order.total,0)) > 0.01 then
    raise exception 'Order totals are inconsistent; review before issuing an invoice';
  end if;

  v_next := nextval('public.gdp_invoice_number_seq'::regclass);
  insert into public.gdp_invoices(order_id, invoice_number, issued_by, snapshot)
  values (p_order_id, 'GDP-INV-' || lpad(v_next::text, 6, '0'), auth.uid(),
    jsonb_build_object(
      'invoice_document_meta', v_order.invoice_document_meta, 'order_number', v_order.order_number, 'order_date', v_order.created_at,
      'payment_status_at_issue', v_order.payment_status,
      'customer_name', v_order.customer_name, 'customer_email', v_order.customer_email,
      'customer_phone', v_order.customer_phone, 'billing_address', v_order.billing_address,
      'subtotal', v_order.subtotal, 'discount', v_order.discount,
      'shipping', v_order.shipping, 'tax', v_order.tax,
      'gst_hst_tax', v_order.gst_hst_tax, 'pst_tax', v_order.pst_tax,
      'total', v_order.total, 'currency', 'CAD', 'items', v_items
    ))
  returning * into v_invoice;
  return v_invoice;
end;
$$;
