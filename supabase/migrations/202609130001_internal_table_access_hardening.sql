-- Harden server-only operational tables.
-- These tables are accessed by trusted Edge Functions/service-role code only.

revoke all privileges on table public.checkout_rate_limits from anon, authenticated;
revoke all privileges on table public.guest_design_sessions from anon, authenticated;
revoke all privileges on table public.maintenance_access_control from anon, authenticated;

grant select, insert, update, delete on table public.checkout_rate_limits to service_role;
grant select, insert, update, delete on table public.guest_design_sessions to service_role;
grant select, insert, update, delete on table public.maintenance_access_control to service_role;

create policy "deny_client_checkout_rate_limits"
on public.checkout_rate_limits
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_client_guest_design_sessions"
on public.guest_design_sessions
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy "deny_client_maintenance_access_control"
on public.maintenance_access_control
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
