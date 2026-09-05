-- Remove duplicate permissive SELECT policies from customer-return tables.

drop policy if exists returns_admin_all on public.returns;
create policy returns_admin_insert on public.returns
for insert with check (public.is_admin());
create policy returns_admin_update on public.returns
for update using (public.is_admin()) with check (public.is_admin());
create policy returns_admin_delete on public.returns
for delete using (public.is_admin());

drop policy if exists return_items_admin_all on public.return_items;
create policy return_items_admin_insert on public.return_items
for insert with check (public.is_admin());
create policy return_items_admin_update on public.return_items
for update using (public.is_admin()) with check (public.is_admin());
create policy return_items_admin_delete on public.return_items
for delete using (public.is_admin());

drop policy if exists refunds_admin_all on public.refunds;
create policy refunds_admin_insert on public.refunds
for insert with check (public.is_admin());
create policy refunds_admin_update on public.refunds
for update using (public.is_admin()) with check (public.is_admin());
create policy refunds_admin_delete on public.refunds
for delete using (public.is_admin());
