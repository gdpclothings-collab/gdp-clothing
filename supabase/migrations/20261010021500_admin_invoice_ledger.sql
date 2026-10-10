-- Invoice ledger: additive, private to admins, no checkout or payment changes.
create sequence if not exists public.gdp_invoice_number_seq as bigint start 1;

create table if not exists public.gdp_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  invoice_number text not null unique,
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint gdp_invoices_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);
create index if not exists gdp_invoices_issued_at_idx on public.gdp_invoices(issued_at desc);
alter table public.gdp_invoices enable row level security;

revoke all on public.gdp_invoices from anon, authenticated;
grant select on public.gdp_invoices to authenticated;
drop policy if exists gdp_invoices_admin_read on public.gdp_invoices;
create policy gdp_invoices_admin_read on public.gdp_invoices
  for select to authenticated using (public.is_admin());

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
      'order_number', v_order.order_number, 'order_date', v_order.created_at,
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
revoke all on function public.issue_admin_order_invoice(uuid) from public, anon;
grant execute on function public.issue_admin_order_invoice(uuid) to authenticated;

-- Issued snapshots must not be silently edited or deleted.
create or replace function public.prevent_gdp_invoice_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Issued invoices are immutable; issue a separate credit note instead';
end;
$$;
drop trigger if exists gdp_invoices_immutable on public.gdp_invoices;
create trigger gdp_invoices_immutable before update or delete on public.gdp_invoices
for each row execute function public.prevent_gdp_invoice_mutation();
