-- Constrain fulfillment vocabulary and prevent fulfillment before production.

begin;

alter table public.orders
  drop constraint if exists orders_fulfillment_status_check;

alter table public.orders
  add constraint orders_fulfillment_status_check
  check (fulfillment_status is null or fulfillment_status in (
    'draft', 'pending_payment', 'unfulfilled', 'on_hold',
    'partially_fulfilled', 'fulfilled', 'ready_for_pickup',
    'shipped', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled'
  ));

alter table public.orders
  drop constraint if exists orders_fulfillment_requires_production_check;

alter table public.orders
  add constraint orders_fulfillment_requires_production_check
  check (
    fulfillment_status not in (
      'partially_fulfilled', 'fulfilled', 'ready_for_pickup',
      'shipped', 'out_for_delivery', 'delivered', 'picked_up'
    ) or production_status = 'completed'
  );

commit;
