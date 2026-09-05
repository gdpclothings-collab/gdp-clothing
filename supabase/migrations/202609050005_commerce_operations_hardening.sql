-- GDP Clothing commerce operations hardening.

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid,
  p_location_id uuid,
  p_new_available integer,
  p_reason text default 'manual',
  p_note text default null
)
returns public.inventory_levels
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_level public.inventory_levels;
  v_before integer;
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  if p_new_available < 0 then
    raise exception 'inventory cannot be negative';
  end if;

  select available
  into v_before
  from public.inventory_levels
  where location_id = p_location_id
    and variant_id = p_variant_id
  for update;

  v_before := coalesce(v_before, 0);

  insert into public.inventory_levels(location_id, variant_id, available)
  values (p_location_id, p_variant_id, p_new_available)
  on conflict (location_id, variant_id)
  do update set available = excluded.available, updated_at = now()
  returning * into v_level;

  if v_before <> p_new_available then
    insert into public.inventory_adjustments(
      location_id, variant_id, adjustment, before_quantity, after_quantity,
      reason, note, actor_user_id
    )
    values (
      p_location_id, p_variant_id, p_new_available - v_before,
      v_before, p_new_available,
      p_reason, p_note, auth.uid()
    );
  end if;

  select coalesce(sum(available),0)
  into v_total
  from public.inventory_levels
  where variant_id = p_variant_id;

  update public.product_variants
  set stock = v_total, updated_at = now()
  where id = p_variant_id;

  return v_level;
end;
$$;

revoke all on function public.admin_adjust_inventory(uuid, uuid, integer, text, text) from public;
revoke all on function public.admin_adjust_inventory(uuid, uuid, integer, text, text) from anon;
grant execute on function public.admin_adjust_inventory(uuid, uuid, integer, text, text) to authenticated;

create index if not exists checkout_sessions_user_id_idx on public.checkout_sessions(user_id);
create index if not exists checkout_sessions_converted_order_idx on public.checkout_sessions(converted_order_id);
create index if not exists content_pages_created_by_idx on public.content_pages(created_by);
create index if not exists content_pages_updated_by_idx on public.content_pages(updated_by);
create index if not exists customer_segment_members_added_by_idx on public.customer_segment_members(added_by);
create index if not exists customer_tag_assignments_tag_idx on public.customer_tag_assignments(tag_id);
create index if not exists customer_tag_assignments_created_by_idx on public.customer_tag_assignments(created_by);
create index if not exists inventory_adjustments_actor_idx on public.inventory_adjustments(actor_user_id);
create index if not exists inventory_transfer_items_variant_idx on public.inventory_transfer_items(variant_id);
create index if not exists inventory_transfers_from_location_idx on public.inventory_transfers(from_location_id);
create index if not exists inventory_transfers_to_location_idx on public.inventory_transfers(to_location_id);
create index if not exists inventory_transfers_created_by_idx on public.inventory_transfers(created_by);
create index if not exists navigation_items_parent_idx on public.navigation_items(parent_id);
create index if not exists notification_templates_updated_by_idx on public.notification_templates(updated_by);
create index if not exists refunds_return_idx on public.refunds(return_id);
create index if not exists refunds_processed_by_idx on public.refunds(processed_by);
create index if not exists return_items_order_item_idx on public.return_items(order_item_id);
create index if not exists staff_assignments_role_idx on public.staff_assignments(role_id);
create index if not exists staff_assignments_assigned_by_idx on public.staff_assignments(assigned_by);
create index if not exists staff_role_permissions_permission_idx on public.staff_role_permissions(permission_key);
create index if not exists tax_rules_market_idx on public.tax_rules(market_id);

drop policy if exists inventory_locations_admin_write on public.inventory_locations;
create policy inventory_locations_admin_insert on public.inventory_locations
for insert with check (public.is_admin());
create policy inventory_locations_admin_update on public.inventory_locations
for update using (public.is_admin()) with check (public.is_admin());
create policy inventory_locations_admin_delete on public.inventory_locations
for delete using (public.is_admin());

drop policy if exists markets_admin_write on public.markets;
create policy markets_admin_insert on public.markets
for insert with check (public.is_admin());
create policy markets_admin_update on public.markets
for update using (public.is_admin()) with check (public.is_admin());
create policy markets_admin_delete on public.markets
for delete using (public.is_admin());

drop policy if exists shipping_profiles_admin_write on public.shipping_profiles;
create policy shipping_profiles_admin_insert on public.shipping_profiles
for insert with check (public.is_admin());
create policy shipping_profiles_admin_update on public.shipping_profiles
for update using (public.is_admin()) with check (public.is_admin());
create policy shipping_profiles_admin_delete on public.shipping_profiles
for delete using (public.is_admin());

drop policy if exists shipping_rates_admin_write on public.shipping_rates;
create policy shipping_rates_admin_insert on public.shipping_rates
for insert with check (public.is_admin());
create policy shipping_rates_admin_update on public.shipping_rates
for update using (public.is_admin()) with check (public.is_admin());
create policy shipping_rates_admin_delete on public.shipping_rates
for delete using (public.is_admin());

drop policy if exists tax_rules_admin_write on public.tax_rules;
create policy tax_rules_admin_insert on public.tax_rules
for insert with check (public.is_admin());
create policy tax_rules_admin_update on public.tax_rules
for update using (public.is_admin()) with check (public.is_admin());
create policy tax_rules_admin_delete on public.tax_rules
for delete using (public.is_admin());

drop policy if exists content_pages_admin_write on public.content_pages;
create policy content_pages_admin_insert on public.content_pages
for insert with check (public.is_admin());
create policy content_pages_admin_update on public.content_pages
for update using (public.is_admin()) with check (public.is_admin());
create policy content_pages_admin_delete on public.content_pages
for delete using (public.is_admin());

drop policy if exists navigation_menus_admin_write on public.navigation_menus;
create policy navigation_menus_admin_insert on public.navigation_menus
for insert with check (public.is_admin());
create policy navigation_menus_admin_update on public.navigation_menus
for update using (public.is_admin()) with check (public.is_admin());
create policy navigation_menus_admin_delete on public.navigation_menus
for delete using (public.is_admin());

drop policy if exists navigation_items_admin_write on public.navigation_items;
create policy navigation_items_admin_insert on public.navigation_items
for insert with check (public.is_admin());
create policy navigation_items_admin_update on public.navigation_items
for update using (public.is_admin()) with check (public.is_admin());
create policy navigation_items_admin_delete on public.navigation_items
for delete using (public.is_admin());

drop policy if exists checkout_sessions_admin_all on public.checkout_sessions;
create policy checkout_sessions_admin_insert on public.checkout_sessions
for insert with check (public.is_admin());
create policy checkout_sessions_admin_update on public.checkout_sessions
for update using (public.is_admin()) with check (public.is_admin());
create policy checkout_sessions_admin_delete on public.checkout_sessions
for delete using (public.is_admin());
