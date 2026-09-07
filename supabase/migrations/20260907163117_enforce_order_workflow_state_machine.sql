-- Enforce coherent design, production, fulfillment, and completion states.

begin;

create or replace function public.validate_order_workflow()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  is_custom boolean;
  is_pickup boolean;
begin
  select exists (
    select 1 from public.order_items oi
    where oi.order_id = new.id and oi.is_custom = true
  ) into is_custom;

  is_pickup := lower(coalesce(new.shipping_method, '')) in (
    'pickup', 'local_pickup', 'local pickup', 'store_pickup', 'store pickup'
  );

  -- The customer-facing order status is derived from the furthest valid
  -- workflow stage. Cancellation/refund and a valid manual close stay explicit.
  if new.status not in ('cancelled', 'refunded', 'partially_refunded', 'completed') then
    new.status := case
      when new.payment_status = 'failed' then 'payment_failed'
      when new.payment_status = 'pending' then 'pending_payment'
      when new.fulfillment_status = 'delivered' then 'delivered'
      when new.fulfillment_status = 'out_for_delivery' then 'out_for_delivery'
      when new.fulfillment_status = 'shipped' then 'shipped'
      when new.fulfillment_status = 'ready_for_pickup' then 'ready_for_pickup'
      when new.fulfillment_status = 'picked_up' then 'completed'
      when new.production_status = 'completed' then 'packing'
      when new.production_status = 'ready' then 'packing'
      when new.production_status = 'packing' then 'packing'
      when new.production_status = 'quality_control' then 'quality_control'
      when new.production_status = 'printing' then 'printing'
      when new.production_status = 'queued' then 'production_queue'
      when new.design_status = 'approved' then 'approved'
      when new.design_status in (
        'artwork_needed', 'design_in_progress', 'proof_ready',
        'awaiting_approval', 'revision_requested'
      ) then new.design_status
      else 'paid'
    end;
  end if;

  if new.production_status <> 'not_started'
     and new.payment_status not in ('paid', 'partially_refunded') then
    raise exception using
      errcode = '23514',
      message = 'Production cannot start until payment is confirmed.';
  end if;

  if is_custom
     and new.production_status <> 'not_started'
     and new.design_status <> 'approved' then
    raise exception using
      errcode = '23514',
      message = 'Approve the customer artwork before starting production.';
  end if;

  if new.production_status in ('queued', 'printing', 'quality_control', 'packing', 'ready', 'completed')
     and new.design_status not in ('not_required', 'approved') then
    raise exception using
      errcode = '23514',
      message = 'Design approval is required before production can move forward.';
  end if;

  if new.fulfillment_status in ('ready_for_pickup', 'shipped', 'out_for_delivery', 'delivered', 'picked_up')
     and new.production_status <> 'completed' then
    raise exception using
      errcode = '23514',
      message = 'Complete production and quality control before fulfillment.';
  end if;

  if new.fulfillment_status = 'ready_for_pickup' and not is_pickup then
    raise exception using
      errcode = '23514',
      message = 'Ready for pickup is only valid for pickup orders.';
  end if;

  if new.fulfillment_status = 'picked_up' and not is_pickup then
    raise exception using
      errcode = '23514',
      message = 'Picked up is only valid for pickup orders.';
  end if;

  if new.fulfillment_status in ('shipped', 'out_for_delivery', 'delivered') then
    if is_pickup then
      raise exception using
        errcode = '23514',
        message = 'Pickup orders cannot be marked as shipped.';
    end if;
    if nullif(btrim(coalesce(new.carrier, '')), '') is null
       or nullif(btrim(coalesce(new.tracking_number, '')), '') is null then
      raise exception using
        errcode = '23514',
        message = 'Add both the carrier and tracking number before marking this order as shipped.';
    end if;
  end if;

  if new.status = 'completed' then
    if new.production_status <> 'completed' then
      raise exception using
        errcode = '23514',
        message = 'Production must be completed before closing the order.';
    end if;
    if new.fulfillment_status not in ('delivered', 'picked_up') then
      raise exception using
        errcode = '23514',
        message = 'An order can only be completed after delivery or pickup.';
    end if;
  end if;

  if new.status = 'delivered' and new.fulfillment_status <> 'delivered' then
    raise exception using
      errcode = '23514',
      message = 'The delivered status requires confirmed delivery.';
  end if;

  if new.status in ('shipped', 'out_for_delivery')
     and new.fulfillment_status <> new.status then
    raise exception using
      errcode = '23514',
      message = 'The customer order status must match the fulfillment stage.';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_validate_workflow on public.orders;
create trigger orders_validate_workflow
before insert or update of status, payment_status, design_status, production_status,
  fulfillment_status, shipping_method, carrier, tracking_number
on public.orders
for each row execute function public.validate_order_workflow();

drop policy if exists order_activity_events_customer_read on public.order_activity_events;
create policy order_activity_events_customer_read
on public.order_activity_events for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_activity_events.order_id
      and o.user_id = (select auth.uid())
  )
);

-- Repair legacy impossible combinations without guessing shipment details.
update public.orders
set status = 'packing',
    fulfillment_status = 'unfulfilled'
where status = 'completed'
  and fulfillment_status not in ('delivered', 'picked_up');

commit;
