-- Keep Stripe TEST payments isolated from live sellable inventory and coupon usage.
-- Checkout may reserve inventory/coupons before payment confirmation. When a
-- non-commerce test order is marked paid, immediately release those temporary
-- reservations instead of waiting for checkout-session expiry.

create or replace function public.release_noncommerce_test_paid_reservations()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.payment_mode = 'test'
     and new.payment_status = 'paid'
     and coalesce(new.test_inventory_workflow, false) = false
     and old.payment_status is distinct from new.payment_status then
    perform public.release_order_inventory_reservations(new.id, 'released');
    perform public.release_order_coupon_reservation(new.id, 'released');
  end if;

  return new;
end;
$function$;

drop trigger if exists orders_release_noncommerce_test_paid_reservations on public.orders;

create trigger orders_release_noncommerce_test_paid_reservations
after update of payment_status on public.orders
for each row
execute function public.release_noncommerce_test_paid_reservations();
