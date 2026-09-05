begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter function public.set_updated_at() set search_path = public;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.is_admin();
$$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

revoke all on function private.current_user_role() from public;
grant execute on function private.current_user_role() to authenticated;

create or replace function public.current_user_role()
returns text
language sql
stable
security invoker
set search_path = public, private
as $$
  select private.current_user_role();
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

drop function if exists public.handle_new_user();

create index if not exists collection_products_product_id_idx on public.collection_products(product_id);
create index if not exists custom_designs_product_id_idx on public.custom_designs(product_id);
create index if not exists design_proofs_approved_by_idx on public.design_proofs(approved_by);
create index if not exists design_proofs_custom_design_id_idx on public.design_proofs(custom_design_id);
create index if not exists design_proofs_order_id_idx on public.design_proofs(order_id);
create index if not exists design_proofs_order_item_id_idx on public.design_proofs(order_item_id);
create index if not exists order_items_custom_design_id_idx on public.order_items(custom_design_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_items_variant_id_idx on public.order_items(variant_id);
create index if not exists order_status_events_actor_user_id_idx on public.order_status_events(actor_user_id);
create index if not exists proof_versions_created_by_idx on public.proof_versions(created_by);
create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists saved_designs_custom_design_id_idx on public.saved_designs(custom_design_id);
create index if not exists support_tickets_order_id_idx on public.support_tickets(order_id);
create index if not exists support_tickets_user_id_idx on public.support_tickets(user_id);
create index if not exists wishlist_items_product_id_idx on public.wishlist_items(product_id);

commit;
